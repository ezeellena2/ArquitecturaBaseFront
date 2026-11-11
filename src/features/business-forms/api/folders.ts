import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { menuIconNames } from "@/shared/ui/menuIcons";

/// The three listings that show the folder tree (CP1-A): «Formularios», «Diseñar formularios» and «Catálogos».
export const folderListings = ["forms", "designs", "catalogs"] as const;
export type FolderListing = (typeof folderListings)[number];
/// Where a folder goes in the side menu (CP5-A).
export const menuPlacements = ["None", "Own", "Forms", "Administration"] as const;
export type MenuPlacement = (typeof menuPlacements)[number];
export const folderNameMaxLength = 80;
export const folderMaxDepth = 5;
/// The folders of one form or catalog travel whole, up to the server's limit.
export const maxFoldersPerItem = 100;

const guid = z.string().uuid();
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const folderName = z.string().min(1).max(folderNameMaxLength).refine(name => name === name.trim());
const folderSchema = z.strictObject({
  id: guid, parentId: guid.nullable(), name: folderName, revision,
  menuPlacement: z.enum(menuPlacements), menuIcon: z.enum(menuIconNames).nullable(),
}).refine(folder => (folder.menuPlacement === "Own") === (folder.menuIcon !== null));
export type FormFolder = z.infer<typeof folderSchema>;

// The tree comes whole: unique folders, every parent in the list (a pruned tree keeps the parents) and five levels at most.
const treeSchema = z.strictObject({ folders: z.array(folderSchema), canManage: z.boolean() }).refine(({ folders }) => {
  const parents = new Map(folders.map(folder => [folder.id, folder.parentId]));
  if (parents.size !== folders.length) return false;
  return folders.every(folder => {
    let depth = 1;
    for (let parent = folder.parentId; parent !== null; parent = parents.get(parent) ?? null) {
      if (!parents.has(parent) || ++depth > folderMaxDepth) return false;
    }
    return true;
  });
});
export type FormFolderTree = z.infer<typeof treeSchema>;

const deletionSchema = z.strictObject({ revision, subfolderCount: count, formCount: count, catalogCount: count });
export type FormFolderDeletion = z.infer<typeof deletionSchema>;

const itemFoldersSchema = z.strictObject({ folderIds: z.array(guid).max(maxFoldersPerItem) })
  .refine(({ folderIds }) => new Set(folderIds).size === folderIds.length);
export type ItemFolders = z.infer<typeof itemFoldersSchema>;

const menuForm = z.strictObject({ id: guid, name: z.string().min(1).max(120) });
// The server sends nothing empty: a group has forms and a menu of its own has forms or groups.
const menuGroup = z.strictObject({ folderId: guid, name: folderName, forms: z.array(menuForm).min(1) });
const menuSection = z.strictObject({ folderId: guid, name: folderName, icon: z.enum(menuIconNames), forms: z.array(menuForm), groups: z.array(menuGroup) })
  .refine(section => section.forms.length > 0 || section.groups.length > 0);
const menuSchema = z.strictObject({ menus: z.array(menuSection), forms: z.array(menuGroup), administration: z.array(menuGroup) });
export type FormMenu = z.infer<typeof menuSchema>;
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
export const readFormMenu = (body: unknown) => read(menuSchema, body);

function folderId(id: string): string {
  if (!guid.safeParse(id).success) throw new Error("Invalid folder id.");
  return id;
}
export type FolderItemKind = "definitions" | "catalogs";
const itemPath = (kind: FolderItemKind, id: string) => `/api/forms/${kind}/${folderId(id)}/folders`;

export const fetchFolderTree = async (listing: FolderListing, signal?: AbortSignal) =>
  readFolderTree(await api.get<unknown>(`/api/forms/folders?${new URLSearchParams({ kind: listing })}`, { signal, cache: "no-store" }));
export const createFolder = async (body: { parentId: string | null; name: string }, signal?: AbortSignal) =>
  readFolder(await api.post<unknown>("/api/forms/folders", body, { signal }));
/// Renames and moves: the same parent renames it and the same name moves it.
export const updateFolder = async (id: string, body: { expectedRevision: number; name: string; parentId: string | null }, signal?: AbortSignal) =>
  readFolder(await api.put<unknown>(`/api/forms/folders/${folderId(id)}`, body, { signal }), id);
export const fetchFolderDeletion = async (id: string, signal?: AbortSignal) =>
  readFolderDeletion(await api.get<unknown>(`/api/forms/folders/${folderId(id)}/deletion`, { signal, cache: "no-store" }));
export const deleteFolder = (id: string, expectedRevision: number, signal?: AbortSignal) =>
  api.delete<void>(`/api/forms/folders/${folderId(id)}`, { body: JSON.stringify({ expectedRevision }), signal });
export const setFolderMenu = async (id: string, body: { expectedRevision: number; placement: MenuPlacement; icon: string | null }, signal?: AbortSignal) =>
  readFolder(await api.put<unknown>(`/api/forms/folders/${folderId(id)}/menu`, body, { signal }), id);
export const fetchItemFolders = async (kind: FolderItemKind, id: string, signal?: AbortSignal) =>
  readItemFolders(await api.get<unknown>(itemPath(kind, id), { signal, cache: "no-store" }));
export const saveItemFolders = async (kind: FolderItemKind, id: string, body: { expectedFolderIds: readonly string[]; folderIds: readonly string[] }, signal?: AbortSignal) =>
  readItemFolders(await api.put<unknown>(itemPath(kind, id), body, { signal }));
export const fetchFormMenu = async (signal?: AbortSignal) => readFormMenu(await api.get<unknown>("/api/forms/menu", { signal, cache: "no-store" }));
