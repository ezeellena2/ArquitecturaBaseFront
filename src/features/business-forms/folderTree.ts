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

function subtree(folders: readonly FormFolder[], id: string): Set<string> {
  const children = childrenOf(folders);
  const found = new Set([id]);
  const pending = [id];
  for (let current = pending.pop(); current !== undefined; current = pending.pop()) {
    for (const child of children.get(current) ?? []) if (!found.has(child.id)) { found.add(child.id); pending.push(child.id); }
  }
  return found;
}

// The levels a folder carries with its subfolders: 1 for a folder without them.
function heightOf(folders: readonly FormFolder[], id: string): number {
  const inside = subtree(folders, id);
  const base = depthOf(folders, id);
  return Math.max(...[...inside].map(member => depthOf(folders, member) - base + 1));
}

/// «Agregar subcarpeta» goes up to the fifth level (CP4).
export function canAddSubfolder(folders: readonly FormFolder[], id: string): boolean {
  return depthOf(folders, id) < folderMaxDepth;
}

/// Where «Mover a…» can take a folder: «Arriba de todo» (null) and every folder that is not itself or below it and keeps the
/// moved folder within five levels, in the order of the tree.
export function moveTargets(folders: readonly FormFolder[], id: string): { id: string | null; depth: number }[] {
  const inside = subtree(folders, id);
  const height = heightOf(folders, id);
  return [{ id: null, depth: 0 }, ...treeOrder(folders)
    .filter(entry => !inside.has(entry.folder.id) && entry.depth + height <= folderMaxDepth)
    .map(entry => ({ id: entry.folder.id, depth: entry.depth }))];
}
