import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { notify } from "@/shared/ui/notifications";
import type { MenuIconName } from "@/shared/ui/menuIcons";
import { createFolder, deleteFolder, fetchFolderDeletion, fetchFolderForms, fetchFolderTree, fetchFormMenu, fetchItemFolders, saveFolderForms, saveItemFolders, updateFolder,
  type FolderItemKind, type FolderListing, type FormFolderTree } from "../api/folders";
import { fetchFormDefinitions } from "../api/forms";
import { folderParamOf, parseFolderParam, type FolderSelection } from "../folderTree";
import { shapeFormMenu } from "../formMenu";
import type { FormCulture } from "../model";
import { catalogActorKey } from "./useCatalogQueries";
import { formActorKey, formScopeKey } from "./useFormQueries";

/// Folders only order: whoever reads a listing reads its tree, and administering them asks to manage forms (CM1 a CM6).
export interface FolderScope { readonly actorId: string | null; readonly culture: FormCulture; readonly permissions: readonly string[] }
export const folderActorKey = (actorId: string | null) => ["form-folders", actorId] as const;
export const folderScopeKey = (scope: FolderScope) => [...folderActorKey(scope.actorId), [...new Set(scope.permissions)].sort().join(","), scope.culture] as const;
const openForms = ["formrecords.read", "formapprovals.decide", "formrecords.create"] as const;
const manageForms = "formtemplates.manage";
const listingPermissions: Readonly<Record<FolderListing, readonly string[]>> = { designs: ["formtemplates.read"], catalogs: ["formcatalogs.read"] };
export const canReadFolders = (scope: FolderScope, listing: FolderListing) => scope.actorId !== null && listingPermissions[listing].some(permission => scope.permissions.includes(permission));
/// For the experience only: the tree says `canManage` and the server decides.
export const mayManageFolders = (scope: FolderScope) => scope.permissions.includes(manageForms);

export function useFolderScope(): FolderScope {
  const { data: user } = useCurrentUser();
  const { i18n } = useTranslation();
  return { actorId: user?.id ?? null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
}

export function useFolderTree(scope: FolderScope, listing: FolderListing) {
  return useQuery({ queryKey: [...folderScopeKey(scope), "tree", listing], queryFn: ({ signal }) => fetchFolderTree(listing, signal), enabled: canReadFolders(scope, listing) });
}

/// The folder of the address (`?carpeta=`). A folder that is no longer in the tree goes back to «Todas» with a notice (CP4);
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

/// The tree of a listing and the folder its «Carpeta» filter shows (CM3). While the tree cannot be read the listing goes on with
/// «Todas» (CP4).
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
/// coincidencias en «Facturación»» with «Buscar en todas», which keeps what was written. Null in «Todas».
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

/// What changes after a write: the trees and the menu, and the listings with the «Carpeta» filter (Diseñar formularios and
/// Catálogos), whose items may change with it. Formularios has no folders (CM3).
export function useFolderRefresh(scope: FolderScope) {
  const client = useQueryClient();
  const actorId = scope.actorId;
  const folders = useCallback(() => client.invalidateQueries({ queryKey: folderActorKey(actorId) }), [client, actorId]);
  const listings = useCallback(() => Promise.all([
    client.invalidateQueries({ queryKey: formActorKey(actorId), predicate: query => query.queryKey[4] === "list" }),
    client.invalidateQueries({ queryKey: catalogActorKey(actorId), predicate: query => query.queryKey[4] === "list" }),
  ]), [client, actorId]);
  const all = useCallback(() => Promise.all([folders(), listings()]), [folders, listings]);
  return { folders, listings, all };
}

/// Creating, editing, moving and deleting a folder (CM2, CM4). A folder of the first level carries its icon; a subfolder, none.
export function useFolderWrites(scope: FolderScope) {
  const { folders, all } = useFolderRefresh(scope);
  const create = useWrite(useCallback(async (parentId: string | null, name: string, icon: MenuIconName | null = null) => {
    const folder = await createFolder({ parentId, name, icon });
    await all();
    return folder;
  }, [all]));
  const update = useWrite(useCallback(async (id: string, expectedRevision: number, name: string, parentId: string | null, icon: MenuIconName | null) => {
    const folder = await updateFolder(id, { expectedRevision, name, parentId, icon });
    await all();
    return folder;
  }, [all]));
  const remove = useWrite(useCallback(async (id: string, expectedRevision: number) => {
    await deleteFolder(id, expectedRevision);
    await all();
  }, [all]));
  return { create, update, remove, reread: folders };
}

export function useFolderDeletion(scope: FolderScope, id: string) {
  return useQuery({ queryKey: [...folderScopeKey(scope), "deletion", id], queryFn: ({ signal }) => fetchFolderDeletion(id, signal),
    enabled: scope.actorId !== null && mayManageFolders(scope), staleTime: 0, gcTime: 0 });
}

/// The folders of one form or catalog (CP2-A): read with the item's read permission, saved whole with the set that was read.
export function useItemFolders(scope: FolderScope, kind: FolderItemKind, id: string) {
  const { all } = useFolderRefresh(scope);
  const client = useQueryClient();
  // A serialized key keeps the save callback stable across renders of the same owner and item.
  const stamp = JSON.stringify([...folderScopeKey(scope), "item", kind, id]);
  const key = useMemo(() => JSON.parse(stamp) as readonly unknown[], [stamp]);
  const canRead = scope.actorId !== null && scope.permissions.includes(kind === "definitions" ? "formtemplates.read" : "formcatalogs.read");
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchItemFolders(kind, id, signal), enabled: canRead && id !== "", staleTime: 0, gcTime: 0 });
  const save = useWrite(useCallback(async (expectedFolderIds: readonly string[], folderIds: readonly string[]) => {
    const saved = await saveItemFolders(kind, id, { expectedFolderIds, folderIds });
    client.setQueryData(key, saved);
    await all();
    return saved;
  }, [kind, id, client, key, all]));
  return { query, save };
}

/// The forms right in one folder (CM2), for whoever administers forms: saved whole with the set that was read, so a set that
/// someone changed in between is a 409 and nothing is lost.
export function useFolderForms(scope: FolderScope, id: string) {
  const { all } = useFolderRefresh(scope);
  const client = useQueryClient();
  const stamp = JSON.stringify([...folderScopeKey(scope), "forms", id]);
  const key = useMemo(() => JSON.parse(stamp) as readonly unknown[], [stamp]);
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchFolderForms(id, signal), enabled: scope.actorId !== null && mayManageFolders(scope) && id !== "", staleTime: 0, gcTime: 0 });
  const save = useWrite(useCallback(async (expectedFormIds: readonly string[], formIds: readonly string[]) => {
    const saved = await saveFolderForms(id, { expectedFormIds, formIds });
    client.setQueryData(key, saved);
    await all();
    return saved;
  }, [id, client, key, all]));
  return { query, save };
}

/// The forms that «Formularios de «Compras»» offers (CM2): the listing of «Diseñar formularios» without the deactivated ones,
/// alphabetical, a page at a time. It is a listing of forms, so a change of forms reads it again.
export const folderFormChoicesPageSize = 50;
export function useFolderFormChoices(scope: FolderScope, search: string) {
  return useInfiniteQuery({
    queryKey: [...formScopeKey(scope), "list", "folder-choices", search],
    queryFn: ({ pageParam, signal }) => fetchFormDefinitions({ page: pageParam, pageSize: folderFormChoicesPageSize, search: search || undefined, sort: "name", publicationFilter: "Active" }, signal),
    initialPageParam: 1,
    getNextPageParam: last => last.hasNext ? last.page + 1 : undefined,
    enabled: scope.actorId !== null && scope.permissions.includes("formtemplates.read") && mayManageFolders(scope),
    gcTime: 0,
    meta: { errorOwner: "local" },
  });
}

/// Whether the side menu has folders to read (CM1): for whoever can open forms or administers them.
export const canReadFormMenu = (permissions: readonly string[]) => [...openForms, manageForms].some(permission => permissions.includes(permission));

/// The folders of the side menu (CM1), each form with where it leads; everyone else gets nothing without asking.
export function useFormMenu() {
  const scope = useFolderScope();
  const enabled = scope.actorId !== null && canReadFormMenu(scope.permissions);
  const query = useQuery({ queryKey: [...folderScopeKey(scope), "menu"], queryFn: ({ signal }) => fetchFormMenu(signal), enabled, meta: { errorOwner: "local" } });
  const links = useMemo(() => query.data ? shapeFormMenu(query.data, scope.permissions) : undefined, [query.data, scope.permissions]);
  return { query, links, enabled };
}
