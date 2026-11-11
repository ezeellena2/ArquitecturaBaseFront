import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { notify } from "@/shared/ui/notifications";
import { createFolder, deleteFolder, fetchFolderDeletion, fetchFolderTree, fetchFormMenu, fetchItemFolders, saveItemFolders, setFolderMenu, updateFolder,
  type FolderItemKind, type FolderListing, type FormFolderTree, type MenuPlacement } from "../api/folders";
import { folderParamOf, parseFolderParam, type FolderSelection } from "../folderTree";
import { shapeFormMenu } from "../formMenu";
import type { FormCulture } from "../model";
import { catalogActorKey } from "./useCatalogQueries";
import { formActorKey } from "./useFormQueries";

/// Folders only order (CP1-A): whoever reads a listing reads its tree, and administering them asks to manage forms or catalogs.
export interface FolderScope { readonly actorId: string | null; readonly culture: FormCulture; readonly permissions: readonly string[] }
export const folderActorKey = (actorId: string | null) => ["form-folders", actorId] as const;
export const folderScopeKey = (scope: FolderScope) => [...folderActorKey(scope.actorId), [...new Set(scope.permissions)].sort().join(","), scope.culture] as const;
const openForms = ["formrecords.read", "formapprovals.decide", "formrecords.create"] as const;
const listingPermissions: Readonly<Record<FolderListing, readonly string[]>> = { forms: openForms, designs: ["formtemplates.read"], catalogs: ["formcatalogs.read"] };
export const canReadFolders = (scope: FolderScope, listing: FolderListing) => scope.actorId !== null && listingPermissions[listing].some(permission => scope.permissions.includes(permission));
/// For the experience only: the tree says `canManage` and the server decides.
export const mayManageFolders = (scope: FolderScope) => scope.permissions.includes("formtemplates.manage") || scope.permissions.includes("formcatalogs.manage");

export function useFolderScope(): FolderScope {
  const { data: user } = useCurrentUser();
  const { i18n } = useTranslation();
  return { actorId: user?.id ?? null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
}

export function useFolderTree(scope: FolderScope, listing: FolderListing) {
  return useQuery({ queryKey: [...folderScopeKey(scope), "tree", listing], queryFn: ({ signal }) => fetchFolderTree(listing, signal), enabled: canReadFolders(scope, listing) });
}

/// The folder of the address (`?carpeta=`). A folder that is no longer in the tree goes back to «Todos» with a notice (CP4);
/// choosing one goes back to page 1 and keeps the search and the other filters.
export function useFolderSelection(tree: FormFolderTree | undefined) {
  const { t } = useTranslation("formFolders");
  const [params] = useSearchParams();
  const update = useQueryUpdate();
  const parsed = parseFolderParam(params.get("carpeta"));
  const missing = parsed.kind === "folder" && tree !== undefined && !tree.folders.some(folder => folder.id === parsed.id);
  const selection: FolderSelection = missing ? { kind: "all" } : parsed;
  const select = useCallback((next: FolderSelection) => update({ carpeta: folderParamOf(next), page: undefined }), [update]);
  useEffect(() => {
    if (!missing) return;
    update({ carpeta: undefined, page: undefined });
    notify({ id: "form-folders:missing", kind: "info", message: t("missing") });
  }, [missing, update, t]);
  return { selection, select };
}

/// The tree of a listing and the folder it shows (CP1-A). While the tree cannot be read the listing goes on with «Todos» (CP4).
export function useListingFolders(listing: FolderListing) {
  const { t } = useTranslation("formFolders");
  const scope = useFolderScope();
  const tree = useFolderTree(scope, listing);
  const failed = tree.isError && tree.data === undefined;
  const chosen = useFolderSelection(tree.data);
  const selection: FolderSelection = failed ? { kind: "all" } : chosen.selection;
  const label = selection.kind === "none" ? t("withoutFolder")
    : selection.kind === "folder" ? tree.data?.folders.find(folder => folder.id === selection.id)?.name : undefined;
  return { listing, scope, tree, selection, select: chosen.select, label };
}
export type ListingFolders = ReturnType<typeof useListingFolders>;

/// The empty listing inside a folder (CP4): «No hay catálogos en «Siembra y cosecha»», or, with a search or a filter, «No hay
/// coincidencias en «Facturación»» with «Buscar en todas», which keeps what was written. Null in «Todos».
export function useFolderEmpty(folders: ListingFolders, items: "forms" | "catalogs", hasFilters: boolean) {
  const { t } = useTranslation("formFolders");
  const name = folders.label;
  const { select } = folders;
  if (name === undefined) return null;
  return hasFilters
    ? { title: t("empty.matchesIn", { name }), searchAll: { label: t("empty.searchAll"), run: () => select({ kind: "all" }) } }
    : { title: t(items === "catalogs" ? "empty.catalogsIn" : "empty.formsIn", { name }), searchAll: null };
}

/// A write of its own, outside MutationCache: who started it shows the wait and owns its result.
function useWrite<TArgs extends unknown[], TResult>(write: (...args: TArgs) => Promise<TResult>) {
  const [pending, setPending] = useState(false);
  const run = useCallback(async (...args: TArgs) => {
    setPending(true);
    try { return await write(...args); } finally { setPending(false); }
  }, [write]);
  return { pending, run };
}

/// What changes after a write: the trees and the menu always; the listings when the items under a folder may change.
export function useFolderRefresh(scope: FolderScope) {
  const client = useQueryClient();
  const actorId = scope.actorId;
  const folders = useCallback(() => client.invalidateQueries({ queryKey: folderActorKey(actorId) }), [client, actorId]);
  const listings = useCallback(() => Promise.all([
    client.invalidateQueries({ queryKey: formActorKey(actorId), predicate: query => query.queryKey[4] === "list" }),
    client.invalidateQueries({ queryKey: catalogActorKey(actorId), predicate: query => query.queryKey[4] === "list" }),
    client.invalidateQueries({ queryKey: ["form-overview"] }),
  ]), [client, actorId]);
  return { folders, listings };
}

export function useFolderWrites(scope: FolderScope) {
  const { folders, listings } = useFolderRefresh(scope);
  const create = useWrite(useCallback(async (parentId: string | null, name: string) => {
    const folder = await createFolder({ parentId, name });
    await folders();
    return folder;
  }, [folders]));
  // Moving changes what is under the folder that was above it, so the listings read again too.
  const update = useWrite(useCallback(async (id: string, expectedRevision: number, name: string, parentId: string | null) => {
    const folder = await updateFolder(id, { expectedRevision, name, parentId });
    await Promise.all([folders(), listings()]);
    return folder;
  }, [folders, listings]));
  // `deleted` runs before reading again, so a listing that showed the folder leaves it before the tree says it is gone.
  const remove = useWrite(useCallback(async (id: string, expectedRevision: number, deleted?: () => void) => {
    await deleteFolder(id, expectedRevision);
    deleted?.();
    await Promise.all([folders(), listings()]);
  }, [folders, listings]));
  const menu = useWrite(useCallback(async (id: string, expectedRevision: number, placement: MenuPlacement, icon: string | null) => {
    const folder = await setFolderMenu(id, { expectedRevision, placement, icon });
    await folders();
    return folder;
  }, [folders]));
  return { create, update, remove, menu, reread: folders };
}

export function useFolderDeletion(scope: FolderScope, id: string) {
  return useQuery({ queryKey: [...folderScopeKey(scope), "deletion", id], queryFn: ({ signal }) => fetchFolderDeletion(id, signal),
    enabled: scope.actorId !== null && mayManageFolders(scope), staleTime: 0, gcTime: 0 });
}

/// The folders of one form or catalog (CP2-A): read with the item's read permission, saved whole with the set that was read.
export function useItemFolders(scope: FolderScope, kind: FolderItemKind, id: string) {
  const { folders, listings } = useFolderRefresh(scope);
  const client = useQueryClient();
  // A serialized key keeps the save callback stable across renders of the same owner and item.
  const stamp = JSON.stringify([...folderScopeKey(scope), "item", kind, id]);
  const key = useMemo(() => JSON.parse(stamp) as readonly unknown[], [stamp]);
  const canRead = scope.actorId !== null && scope.permissions.includes(kind === "definitions" ? "formtemplates.read" : "formcatalogs.read");
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchItemFolders(kind, id, signal), enabled: canRead && id !== "", staleTime: 0, gcTime: 0 });
  const save = useWrite(useCallback(async (expectedFolderIds: readonly string[], folderIds: readonly string[]) => {
    const saved = await saveItemFolders(kind, id, { expectedFolderIds, folderIds });
    client.setQueryData(key, saved);
    await Promise.all([folders(), listings()]);
    return saved;
  }, [kind, id, client, key, folders, listings]));
  return { query, save };
}

/// The folders of the side menu (CP5-A), for whoever can open forms; everyone else gets nothing without asking.
export function useFormMenu() {
  const scope = useFolderScope();
  const enabled = scope.actorId !== null && openForms.some(permission => scope.permissions.includes(permission));
  const query = useQuery({ queryKey: [...folderScopeKey(scope), "menu"], queryFn: ({ signal }) => fetchFormMenu(signal), enabled, meta: { errorOwner: "local" } });
  const links = useMemo(() => query.data ? shapeFormMenu(query.data, scope.permissions) : undefined, [query.data, scope.permissions]);
  return { query, links, enabled };
}
