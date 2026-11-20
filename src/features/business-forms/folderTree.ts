import { menuIconNames, type MenuIconName } from "@/shared/ui/menuIcons";
import { folderMaxDepth, type FormFolder } from "./api/folders";

/// What the listings show (CP1-A): everything, what has no folder, or a folder with its subfolders.
export type FolderSelection = { kind: "all" } | { kind: "none" } | { kind: "folder"; id: string };
/// `?carpeta=` carries a folder id, or this for «Sin carpeta».
export const withoutFolderParam = "sin-carpeta";
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseFolderParam(value: string | null): FolderSelection {
  if (value === withoutFolderParam) return { kind: "none" };
  return value !== null && guidPattern.test(value) ? { kind: "folder", id: value } : { kind: "all" };
}
export function folderParamOf(selection: FolderSelection): string | undefined {
  return selection.kind === "all" ? undefined : selection.kind === "none" ? withoutFolderParam : selection.id;
}
/// The listing filter the server takes: a folder with its subfolders, or the items without one, never both.
export function folderListQuery(selection: FolderSelection): { folderId?: string; withoutFolder?: true } {
  return selection.kind === "folder" ? { folderId: selection.id } : selection.kind === "none" ? { withoutFolder: true } : {};
}

export interface FolderEntry { readonly folder: FormFolder; readonly depth: number; readonly hasChildren: boolean }

function childrenOf(folders: readonly FormFolder[]) {
  const children = new Map<string | null, FormFolder[]>();
  for (const folder of folders) children.set(folder.parentId, [...children.get(folder.parentId) ?? [], folder]);
  return children;
}

/// The folders in the order of the tree, each one under its parent and with its level, keeping the server's alphabetical order.
export function treeOrder(folders: readonly FormFolder[]): FolderEntry[] {
  const children = childrenOf(folders);
  const entries: FolderEntry[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const folder of children.get(parentId) ?? []) {
      entries.push({ folder, depth, hasChildren: (children.get(folder.id)?.length ?? 0) > 0 });
      visit(folder.id, depth + 1);
    }
  };
  visit(null, 1);
  return entries;
}

/// The folders above one, from the top.
export function ancestorIds(folders: readonly FormFolder[], id: string): string[] {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const ancestors: string[] = [];
  for (let parent = byId.get(id)?.parentId ?? null; parent !== null && ancestors.length < folderMaxDepth; parent = byId.get(parent)?.parentId ?? null) ancestors.unshift(parent);
  return ancestors;
}

/// The names from the top down to the folder; empty when it is not in the tree.
export function folderPath(folders: readonly FormFolder[], id: string): string[] {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const folder = byId.get(id);
  return folder ? [...ancestorIds(folders, id).map(ancestor => byId.get(ancestor)?.name ?? ""), folder.name] : [];
}

const depthOf = (folders: readonly FormFolder[], id: string) => ancestorIds(folders, id).length + 1;

/// «Nueva subcarpeta» only in a folder of the first level: there are two levels (CM4).
export function canAddSubfolder(folders: readonly FormFolder[], id: string): boolean {
  return depthOf(folders, id) < folderMaxDepth;
}

/// A folder with subfolders cannot go into another: it would make a third level (CM4).
export function hasSubfolders(folders: readonly FormFolder[], id: string): boolean {
  return folders.some(folder => folder.parentId === id);
}

/// The icon a new folder of the first level starts with: the first of the twelve that no folder of the first level uses, or the
/// folder once all of them are taken.
export function firstFreeIcon(folders: readonly FormFolder[]): MenuIconName {
  const taken = new Set(folders.flatMap(folder => folder.parentId === null && folder.icon !== null ? [folder.icon] : []));
  return menuIconNames.find(name => !taken.has(name)) ?? "folder";
}
