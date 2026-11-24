import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { assistantDraftState, canAskAssistant } from "@/shared/hooks/assistantDraftState";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useSystemPresentation } from "@/shared/api/presentation";
import { useFilters } from "@/shared/hooks/useFilters";
import { usePagination } from "@/shared/hooks/usePagination";
import { toggledSort } from "@/shared/lib/sort";
import { Button } from "@/shared/ui/button";
import { FilterBar } from "@/shared/ui/FilterBar";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { Picker } from "@/shared/ui/Picker";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SortMenu } from "@/shared/ui/SortMenu";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import type { CatalogListQuery } from "../api/catalogs";
import { catalogOriginKey } from "../catalogOrigin";
import { CatalogListTable } from "../components/CatalogListTable";
import { catalogListColumns, type CatalogListActions } from "../components/catalogListColumns";
import { FolderFilter } from "../components/FolderFilter";
import { ItemFoldersDialog } from "../components/ItemFoldersDialog";
import { folderListQuery } from "../folderTree";
import { useFolderEmpty, useListingFolders } from "../hooks/useFormFolders";
import { CatalogOriginDialog } from "../components/CatalogOriginDialog";
import { useCatalogPage } from "../hooks/useCatalogQueries";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";

const filterKeys = ["kind", "state"] as const;
const catalogStates = ["Active", "Inactive", "Unavailable"] as const;
const catalogKinds = ["Manual", "Filters", "External"] as const;
const sortFields = ["name", "-name", "kind", "-kind", "revision", "-revision", "optionsCount", "-optionsCount", "usageCount", "-usageCount", "state", "-state"] as const;
// Without an order chosen the server orders by name: it is a column, so its arrow shows and the first touch inverts it (OT1-C).
const usualSort = "name";
export function CatalogsPage() {
  const { t, i18n } = useTranslation("forms");
  const { data: user } = useCurrentUser();
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true, usualSort);
  const navigate = useNavigate();
  const filters = useFilters(filterKeys);
  const state = catalogStates.find(value => value === filters.values.state);
  const kind = catalogKinds.find(value => value === filters.values.kind);
  const [choosingOrigin, setChoosingOrigin] = useState(false);
  // CM3: the «Carpeta» filter of the address filters the listing, with its subfolders, before paging.
  const folders = useListingFolders("catalogs");
  const [foldersOf, setFoldersOf] = useState<{ id: string; name: string } | null>(null);
  const scope: CatalogReadScope = { actorId: pagination.ready ? user?.id ?? null : null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
  const query: CatalogListQuery = { page: pagination.page, pageSize: pagination.pageSize, search: pagination.search, sort: sortFields.find(field => field === pagination.sort), kind, state, ...folderListQuery(folders.selection) };
  const list = useCatalogPage(scope, query);
  const hasFilters = !!query.search || kind !== undefined || state !== undefined;
  const folderEmpty = useFolderEmpty(folders, "catalogs", hasFilters);
  const visiblePage = list.data ? { ...list.data, items: list.data.items.map(row => ({ ...row, stateReason: row.state === "Unavailable" && row.stateReason ? t("catalogs.unavailableReason") : null })) } : undefined;
  const canManage = !!user?.permissions.includes("formcatalogs.manage");
  const rowActions: CatalogListActions = { canManage, onEdit: id => { void navigate("/catalogos/" + id); }, onViewUsage: id => { void navigate("/catalogos/" + id); },
    onFolders: row => setFoldersOf({ id: row.id, name: row.name }) };
  // The catalogs a module keeps (External) are a choice only when the server counts some, or when the address already chose them.
  const kindOptions = ["Manual", "Filters", ...(list.data?.filterCounts.byKind.external !== undefined || kind === "External" ? ["External"] as const : [])] as const;
  const feedbackId = `catalogs:list:${scope.actorId}:${scope.culture}`;
  useEffect(() => () => { dismissNotification(feedbackId); }, [feedbackId]);
  useEffect(() => {
    if (!list.error) { dismissNotification(feedbackId); return; }
    if (["cancelled", "session", "forbidden"].includes(errorFeedback(list.error).kind)) return;
    notify({ id: feedbackId, kind: "error", message: readErrorMessage(list.error, t) });
  }, [list.error, list.data, feedbackId, t]);
  if (!user?.permissions.includes("formcatalogs.read") || (list.error instanceof ApiError && list.error.status === 403)) return <ForbiddenPage title={t("catalogs.title")} />;
  // «Armar con la IA» goes before «Nuevo catálogo» and opens Home with the request begun (IA4).
  const newAction = canManage ? <>{canAskAssistant(presentation.data?.installedFeatures, user?.permissions) ? <Button asChild variant="outline"><Link to="/" state={assistantDraftState(t("assistantProposals.entries.catalog"))}>{t("assistantProposals.entries.label")}</Link></Button> : null}<Button type="button" onClick={() => setChoosingOrigin(true)}>{t("catalogs.new")}</Button></> : undefined;
  return <Page title={t("catalogs.title")} actions={newAction}>
    <FilterBar><div className="flex flex-wrap items-center gap-3"><div className="w-full sm:w-72"><SearchInput value={query.search ?? ""} onChange={pagination.setSearch} label={t("catalogs.search")} /></div>{/* The origin and the state are the only piece to choose with the button of the bar (DS1-A, also the filters since 2026-11-22),
      as the role of Usuarios, without counts (FO1-A): «Todos» and «Todos los estados» first and apart, which take the filter out;
      choosing the one it has changes nothing (it would go back to page 1). */}
    <Picker trigger="button" label={t("catalogs.columns.origin")} first={{ id: "", label: t("all") }}
      options={kindOptions.map(value => ({ id: value, label: t(catalogOriginKey(value)) }))}
      value={kind ?? ""} onChange={id => { if (id !== (kind ?? "")) filters.setFilter("kind", id || undefined); }} />
    <Picker trigger="button" label={t("catalogs.columns.state")} first={{ id: "", label: t("catalogs.allStates") }}
      options={catalogStates.map(value => ({ id: value, label: t("catalogs.state." + value) }))}
      value={state ?? ""} onChange={id => { if (id !== (state ?? "")) filters.setFilter("state", id || undefined); }} /><FolderFilter folders={folders} />
    {/* Last in the bar, apart from the filters: it takes no rows out, and «Limpiar» keeps it (OT1-C). */}
    <SortMenu columns={catalogListColumns(t, rowActions)} sort={query.sort ?? usualSort} onSortChange={pagination.setSort} /></div></FilterBar>
    <CatalogListTable {...rowActions} page={visiblePage} loading={list.isPending} refreshing={list.isPlaceholderData} error={list.error ? t("catalogs.loadFailed") : undefined}
      onRetry={() => { void list.refetch(); }} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
      sort={query.sort ?? usualSort}
      // From the order shown: an old order by origin, left out of the request, does not count for the first touch.
      onSortChange={(field, kind) => pagination.setSort(toggledSort(query.sort ?? usualSort, field, kind))} hasFilters={hasFilters}
      emptyTitle={folderEmpty?.title}
      emptyAction={folderEmpty?.searchAll ? <div className="flex flex-wrap justify-center gap-2"><Button type="button" variant="outline" onClick={folderEmpty.searchAll.run}>{folderEmpty.searchAll.label}</Button><Button type="button" variant="outline" onClick={filters.clear}>{t("clearFilters")}</Button></div>
        : folderEmpty ? undefined : hasFilters ? <Button type="button" variant="outline" onClick={filters.clear}>{t("clearFilters")}</Button> : newAction} />
    {foldersOf && canManage ? <ItemFoldersDialog kind="catalogs" id={foldersOf.id} name={foldersOf.name} onClose={() => setFoldersOf(null)} /> : null}
    {choosingOrigin && canManage ? <CatalogOriginDialog onOpenChange={setChoosingOrigin} onSelect={(origin, valueType) => { void navigate(origin === "Filters" ? "/catalogos/nuevo?kind=Filters" : "/catalogos/nuevo" + (valueType === "Text" ? "" : "?valueType=" + valueType)); }} /> : null}
  </Page>;
}
