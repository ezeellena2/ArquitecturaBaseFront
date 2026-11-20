import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { menuIconNames, type MenuIconName } from "@/shared/ui/menuIcons";

/// The listings with the «Carpeta» filter, which read the folder tree: «Diseñar formularios» and «Catálogos» (CM3).
export const folderListings = ["designs", "catalogs"] as const;
export type FolderListing = (typeof folderListings)[number];
export const folderNameMaxLength = 80;
/// Two levels (CM1 a CM6, 2026-11-20): a folder of the first level is a menu of the side menu and always has one of the twelve
/// icons; a subfolder is a group of its panel and has none. There is no third level.
export const folderMaxDepth = 2;
/// The folders of one form or catalog travel whole, up to the server's limit.
export const maxFoldersPerItem = 100;
/// The forms of one folder travel whole, up to the server's limit.
export const maxFormsPerFolder = 1000;

const guid = z.string().uuid();
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const folderName = z.string().min(1).max(folderNameMaxLength).refine(name => name === name.trim());
const icon = z.enum(menuIconNames);
const uniqueIds = (ids: readonly string[]) => new Set(ids).size === ids.length;
// The icon goes with the first level and only with it.
const folderSchema = z.strictObject({ id: guid, parentId: guid.nullable(), name: folderName, revision, icon: icon.nullable() })
  .refine(folder => (folder.parentId === null) === (folder.icon !== null));
export type FormFolder = z.infer<typeof folderSchema>;

// The tree comes whole: unique folders, and each subfolder under a folder of the first level that is in the list (a pruned tree
// keeps the parents).
const treeSchema = z.strictObject({ folders: z.array(folderSchema), canManage: z.boolean() }).refine(({ folders }) => {
  const parents = new Map(folders.map(folder => [folder.id, folder.parentId]));
  return parents.size === folders.length
    && folders.every(folder => folder.parentId === null || parents.has(folder.parentId) && parents.get(folder.parentId) === null);
});
export type FormFolderTree = z.infer<typeof treeSchema>;

const deletionSchema = z.strictObject({ revision, subfolderCount: count, formCount: count, catalogCount: count });
export type FormFolderDeletion = z.infer<typeof deletionSchema>;

const itemFoldersSchema = z.strictObject({ folderIds: z.array(guid).max(maxFoldersPerItem) }).refine(({ folderIds }) => uniqueIds(folderIds));
export type ItemFolders = z.infer<typeof itemFoldersSchema>;

/// The forms right in one folder (not those of its subfolders): drafts and deactivated ones too.
const folderFormsSchema = z.strictObject({ formIds: z.array(guid).max(maxFormsPerFolder) }).refine(({ formIds }) => uniqueIds(formIds));
export type FolderForms = z.infer<typeof folderFormsSchema>;

const menuForm = z.strictObject({ id: guid, name: z.string().min(1).max(120) });
const menuGroup = z.strictObject({ folderId: guid, name: folderName, revision, forms: z.array(menuForm) });
const menuSection = z.strictObject({ folderId: guid, name: folderName, icon, revision, catalogCount: count, forms: z.array(menuForm), groups: z.array(menuGroup) });
// Whoever administers forms gets every folder, also the empty ones, with its catalogs. Anyone else gets nothing empty and no
// catalogs.
const menuSchema = z.strictObject({ canManage: z.boolean(), menus: z.array(menuSection) }).refine(({ canManage, menus }) => canManage
  || menus.every(menu => menu.catalogCount === 0 && (menu.forms.length > 0 || menu.groups.length > 0) && menu.groups.every(group => group.forms.length > 0)));
export type FormMenu = z.infer<typeof menuSchema>;
export type FormMenuSection = z.infer<typeof menuSection>;
export type FormMenuGroup = z.infer<typeof menuGroup>;

export class UnsupportedFolderResponse extends Error {
  constructor() { super("Unsupported form folder response."); this.name = "UnsupportedFolderResponse"; }
}

// The issues are not kept: they could carry names of folders and forms.
function read<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new UnsupportedFolderResponse();
  return result.data;
}
export const readFolderTree = (body: unknown) => read(treeSchema, body);
export const readFolder = (body: unknown, expectedId?: string) => {
  const folder = read(folderSchema, body);
  if (expectedId !== undefined && folder.id !== expectedId) throw new UnsupportedFolderResponse();
  return folder;
};
export const readFolderDeletion = (body: unknown) => read(deletionSchema, body);
export const readItemFolders = (body: unknown) => read(itemFoldersSchema, body);
export const readFolderForms = (body: unknown) => read(folderFormsSchema, body);
export const readFormMenu = (body: unknown) => read(menuSchema, body);

function folderId(id: string): string {
  if (!guid.safeParse(id).success) throw new Error("Invalid folder id.");
  return id;
}
export type FolderItemKind = "definitions" | "catalogs";
const itemPath = (kind: FolderItemKind, id: string) => `/api/forms/${kind}/${folderId(id)}/folders`;

export const fetchFolderTree = async (listing: FolderListing, signal?: AbortSignal) =>
  readFolderTree(await api.get<unknown>(`/api/forms/folders?${new URLSearchParams({ kind: listing })}`, { signal, cache: "no-store" }));
/// A folder of the first level takes the icon it gets, or the server gives it the first free one; a subfolder takes none.
export const createFolder = async (body: { parentId: string | null; name: string; icon?: MenuIconName | null }, signal?: AbortSignal) =>
  readFolder(await api.post<unknown>("/api/forms/folders", { parentId: body.parentId, name: body.name, icon: body.icon ?? null }, { signal }));
/// Renames, moves and changes the icon. Without an icon, a folder that stays in the first level keeps its own and one that comes
/// up from being a subfolder takes the first free one; a folder that goes into another always goes without.
export const updateFolder = async (id: string, body: { expectedRevision: number; name: string; parentId: string | null; icon?: MenuIconName | null }, signal?: AbortSignal) =>
  readFolder(await api.put<unknown>(`/api/forms/folders/${folderId(id)}`, { expectedRevision: body.expectedRevision, name: body.name, parentId: body.parentId, icon: body.icon ?? null }, { signal }), id);
export const fetchFolderDeletion = async (id: string, signal?: AbortSignal) =>
  readFolderDeletion(await api.get<unknown>(`/api/forms/folders/${folderId(id)}/deletion`, { signal, cache: "no-store" }));
export const deleteFolder = (id: string, expectedRevision: number, signal?: AbortSignal) =>
  api.delete<void>(`/api/forms/folders/${folderId(id)}`, { body: JSON.stringify({ expectedRevision }), signal });
export const fetchItemFolders = async (kind: FolderItemKind, id: string, signal?: AbortSignal) =>
  readItemFolders(await api.get<unknown>(itemPath(kind, id), { signal, cache: "no-store" }));
export const saveItemFolders = async (kind: FolderItemKind, id: string, body: { expectedFolderIds: readonly string[]; folderIds: readonly string[] }, signal?: AbortSignal) =>
  readItemFolders(await api.put<unknown>(itemPath(kind, id), body, { signal }));
export const fetchFolderForms = async (id: string, signal?: AbortSignal) =>
  readFolderForms(await api.get<unknown>(`/api/forms/folders/${folderId(id)}/forms`, { signal, cache: "no-store" }));
/// Replaces the forms right in the folder with the set it read: a set that changed in between is a 409 `Forms.Folder.SetChanged`.
export const saveFolderForms = async (id: string, body: { expectedFormIds: readonly string[]; formIds: readonly string[] }, signal?: AbortSignal) =>
  readFolderForms(await api.put<unknown>(`/api/forms/folders/${folderId(id)}/forms`, body, { signal }));
export const fetchFormMenu = async (signal?: AbortSignal) => readFormMenu(await api.get<unknown>("/api/forms/menu", { signal, cache: "no-store" }));
