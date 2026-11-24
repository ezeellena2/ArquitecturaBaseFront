import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { assistantDraftState, canAskAssistant } from "@/shared/hooks/assistantDraftState";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useSystemPresentation } from "@/shared/api/presentation";
import { usePagination } from "@/shared/hooks/usePagination";
import { toggledSort } from "@/shared/lib/sort";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { formatDateInZone, formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { FilterBar } from "@/shared/ui/FilterBar";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { Pagination } from "@/shared/ui/Pagination";
import { Picker } from "@/shared/ui/Picker";
import { BanIcon, FolderIcon, PencilIcon, PlusIcon, RefreshIcon, TrashIcon } from "@/shared/ui/icons";
import { RowActions } from "@/shared/ui/RowActions";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SortMenu } from "@/shared/ui/SortMenu";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { formActorKey, formScopeKey, useFormDefinitions, type FormReadScope } from "../hooks/useFormQueries";
import { useFormOverview, useFormOverviewScope } from "../hooks/useFormOverview";
import { useResponseScope } from "../hooks/useResponseQueries";
import { deprecationDateUtc, deprecationStateKey } from "../lifecyclePresentation";
import { publicationLabelKey } from "../publicationPresentation";
import { administrativeName } from "../editorModel";
import { FormDeletionDialog } from "../components/FormDeletionDialog";
import { FormDeactivationDialog } from "../components/FormDeactivationDialog";
import { FolderFilter } from "../components/FolderFilter";
import { ItemFoldersDialog } from "../components/ItemFoldersDialog";
import { folderListQuery } from "../folderTree";
import { folderActorKey, useFolderEmpty, useListingFolders } from "../hooks/useFormFolders";
import type { FormListQuery, FormSortField } from "../api/forms";
import type { readFormPage } from "../api/response";

// Without an order chosen the server orders by name: it is a column, so its arrow shows and the first touch inverts it (OT1-C).
const usualSort = "name";
// Each state of the filter and its word; «Activos», without one in the address, is the published and the drafts. «Con algo por
// aprobar» (FU4) only for whoever decides approvals, and it mixes active and deactivated forms.
const publicationFilters = [["Active", "active"], ["Published", "published"], ["Drafts", "drafts"], ["Pending", "overview.pendingOnly"], ["Deactivated", "deactivated"]] as const;
type Row = ReturnType<typeof readFormPage>["items"][number];
export function FormsPage() {
  const { t, i18n } = useTranslation(["forms", "formFolders", "formEntries"]);
  const { data: user } = useCurrentUser();
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true, usualSort);
  // CM3: the «Carpeta» filter of the address filters the listing and its counts, with its subfolders, before paging.
  const folders = useListingFolders("designs");
  const [foldersOf, setFoldersOf] = useState<{ id: string; name: string } | null>(null);
  const [params] = useSearchParams();
  const location = useLocation();
  const update = useQueryUpdate();
  const navigate = useNavigate();
  const client = useQueryClient();
  const responseScope = useResponseScope();
  const overviewScope = useFormOverviewScope();
  const host = useRef<HTMLDivElement>(null);
  const focusFallback = useRef<HTMLElement | null>(null);
  const [action, setAction] = useState<{ row: Row; owner: string; kind: "deactivate" | "delete" } | null>(null);
  const filter = params.get("publicationFilter");
  const canDecide = !!user?.permissions.includes("formapprovals.decide");
  const publicationFilter = filter === "Published" || filter === "Drafts" || filter === "Deactivated" || filter === "Pending" && canDecide ? filter : "Active";
  const scope: FormReadScope = { actorId: pagination.ready ? user?.id ?? null : null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
  // SA3-A and SA5: where each form is completed, only with a form channel installed; without one, every form is of the app.
  const channels = presentation.data?.installedFeatures ? presentation.data.installedFeatures.includes("form-channels") : true;
  // Every column with a datum orders in the server (OT1-C), with the backend's field as its id. Two show nothing to order by and
  // the server keeps the usual order for them: «Respuestas» without «Ver respuestas», where every row says «—», and «Estado»
  // among the deactivated and in «Con algo por aprobar», which mixes them, where it shows the withdrawal from the channel. An order
  // this view does not offer is left out.
  const sortsByResponses = scope.permissions.includes("formrecords.read");
  const sortsByState = publicationFilter !== "Deactivated" && publicationFilter !== "Pending";
  const sortFields: FormSortField[] = ["name", "questionCount", ...(sortsByState ? ["displayState" as const] : []), ...(channels ? ["completedIn" as const] : []),
    "activeVersion", ...(canDecide ? ["pendingDecisionCount" as const] : []), ...(sortsByResponses ? ["responseCount" as const] : []), "lastChangedAtUtc", "lastChangedBy"];
  const sort = sortFields.flatMap(field => [field, `-${field}` as const]).find(value => value === pagination.sort);
  const query: FormListQuery = { page: Number.isSafeInteger(pagination.page) && pagination.page > 0 ? pagination.page : 1,
    pageSize: Number.isSafeInteger(pagination.pageSize) && pagination.pageSize >= 1 && pagination.pageSize <= 100 ? pagination.pageSize : presentation.data?.defaultPageSize ?? 20,
    search: pagination.search, sort, publicationFilter, ...folderListQuery(folders.selection) };
  const { list } = useFormDefinitions(scope, query);
  const actionOwner = JSON.stringify(formScopeKey(scope));
  if (action && action.owner !== actionOwner) setAction(null);
  const canManage = !!user?.permissions.includes("formtemplates.manage");
  const canLoad = !!user?.permissions.includes("formrecords.create");
  // FU4: whoever decides is still told about the deactivated forms with something to approve, as in «Formularios».
  const warnsDeactivated = canDecide && publicationFilter === "Active";
  const { query: deactivatedPending } = useFormOverview({ page: 1, pageSize: 1, search: query.search, state: "Active" }, warnsDeactivated && pagination.ready);
  const deactivatedPendingCount = warnsDeactivated ? deactivatedPending.data?.filterCounts.deactivatedPending ?? 0 : 0;
  const hasFilters = !!query.search || publicationFilter !== "Active";
  const folderEmpty = useFolderEmpty(folders, "forms", hasFilters);
  // «Con algo por aprobar» with nothing says so, as in «Formularios», without inviting to clear anything.
  const pendingEmpty = publicationFilter === "Pending" && !query.search && !folderEmpty;
  const feedbackId = `forms:list:${scope.actorId}:${scope.culture}`;
  useEffect(() => () => { dismissNotification(feedbackId); }, [feedbackId]);
  useEffect(() => {
    const error = list.error;
    if (!error) { dismissNotification(feedbackId); return; }
    if (["cancelled", "session", "forbidden"].includes(errorFeedback(error).kind)) return;
    notify({ id: feedbackId, kind: "error", message: readErrorMessage(error, t) });
  }, [list.error, list.data, feedbackId, t]);
  if (!user?.permissions.includes("formtemplates.read") || (list.error instanceof ApiError && list.error.status === 403)) return <ForbiddenPage title={t("title")} />;
  const clearFilters = () => update({ search: undefined, publicationFilter: undefined, page: undefined });
  const canPublish = scope.permissions.includes("formtemplates.publish");
  const chooseAction = (row: Row, kind: "deactivate" | "delete") => { focusFallback.current = host.current?.querySelector<HTMLInputElement>("input") ?? null; setAction({ row, kind, owner: JSON.stringify(formScopeKey(scope)) }); };
  const refresh = async () => { await Promise.all([client.invalidateQueries({ queryKey: formActorKey(scope.actorId) }), client.invalidateQueries({ queryKey: folderActorKey(scope.actorId) }), client.invalidateQueries({ queryKey: ["form-overview", overviewScope.owner] }), client.invalidateQueries({ queryKey: ["form-responses", responseScope.owner] })]); };
  const columns: Column<Row>[] = [
    { id: "name", header: t("formColumn"), sortable: true, sortKind: "text", cell: row => <Link to={`/formularios/${row.id}`} className="font-medium text-[var(--color-brand-700)] underline-offset-2 hover:underline">{administrativeName(row.name, scope.culture)}</Link> },
    { id: "questionCount", header: t("countColumn"), sortable: true, sortKind: "number", numeric: true, cell: row => row.questionCount },
    // One piece of data per column (UD2): the state goes alone, the version that stays active and who changed it go apart.
    { id: "displayState", header: t("stateColumn"), ...(sortsByState ? { sortable: true as const, sortKind: "state" as const } : { sortable: false as const }), cell: row => {
      if (!row.lifecycle.deactivatedAtUtc) return t(publicationLabelKey(row.displayState, true));
      const key = deprecationStateKey(row.lifecycle);
      return key ? t(key) : "—";
    } },
    // SA3-A: where the active version is completed and, without one, where the draft will be; one piece of data per column (UD).
    ...(channels ? [{ id: "completedIn", header: t("completedIn.label"), sortable: true as const, sortKind: "state" as const, cell: (row: Row) => t(row.appOnly ? "completedIn.app" : "completedIn.channels") }] : []),
    // «Dado de baja» is what the filter already says: here, how the withdrawal goes in WhatsApp and its date.
    ...(publicationFilter === "Deactivated" ? [{ sortable: false as const, id: "deprecation", header: t("lifecycle.deprecationColumn"), cell: (row: Row) => {
      const at = deprecationDateUtc(row.lifecycle);
      return at ? <time dateTime={at}>{formatDateTimeInZone(at, i18n.language, user?.timeZoneId)}</time> : "—";
    } }] : []),
    { id: "activeVersion", header: t("activeVersionColumn"), sortable: true, sortKind: "number", numeric: true, cell: row => row.activeVersionNumber ?? "—" },
    // FU2-A: what awaits the decision of whoever looks, as the number of the menu; it opens the sheet, which starts on «Por aprobar».
    ...(canDecide ? [{ id: "pendingDecisionCount", header: t("overview.pendingColumn"), sortable: true as const, sortKind: "number" as const, numeric: true, cell: (row: Row) => row.pendingDecisionCount
      ? <Link to={`/formularios/${row.id}/respuestas`} aria-label={t("overview.pendingFor", { name: administrativeName(row.name, scope.culture), count: row.pendingDecisionCount })} className="font-medium text-[var(--color-brand-700)] underline">{row.pendingDecisionCount}</Link> : "—" }] : []),
    // The number of responses opens the sheet of the form (FU2-A); a form never published has none to open.
    { id: "responseCount", header: t("responseCountColumn"), ...(sortsByResponses ? { sortable: true as const, sortKind: "number" as const } : { sortable: false as const }), numeric: true, cell: row => row.lifecycle.responseCount !== null && row.activeVersionNumber !== null
      ? <Link to={`/formularios/${row.id}/respuestas`} aria-label={t("overview.responsesOf", { name: administrativeName(row.name, scope.culture) })} className="font-medium text-[var(--color-brand-700)] underline">{row.lifecycle.responseCount}</Link>
      : row.lifecycle.responseCount ?? "—" },
    { id: "lastChangedAtUtc", header: t("changedColumn"), sortable: true, sortKind: "date", cell: row => formatDateInZone(row.lastChangedAtUtc, i18n.language, user?.timeZoneId) },
    { id: "lastChangedBy", header: t("changedByColumn"), sortable: true, sortKind: "text", cell: row => row.lastChangedBy?.displayName ?? "—" },
    { sortable: false, id: "actions", header: t("actionsColumn"), align: "right", cell: row => <RowActions actions={[{ hidden: !canLoad || row.activeVersionNumber === null || !!row.lifecycle.deactivatedAtUtc, label: t("formEntries:load"), accessibleName: t("formEntries:loadForm", { name: administrativeName(row.name, scope.culture) }), icon: PlusIcon, to: `/formularios/${row.id}/cargar`, state: { from: "list", list: "/formularios" + location.search } }, { hidden: !canManage || !row.canEdit, label: t("edit"), accessibleName: `${t("edit")} ${administrativeName(row.name, scope.culture)}`, icon: PencilIcon, onSelect: () => { void navigate(`/formularios/${row.id}`); } }, { hidden: !canManage, label: t("formFolders:item.action"), accessibleName: t("formFolders:item.actionFor", { name: administrativeName(row.name, scope.culture) }), icon: FolderIcon, onSelect: () => setFoldersOf({ id: row.id, name: administrativeName(row.name, scope.culture) }) }, { hidden: !canPublish || !row.lifecycle.canDeactivate, label: t("lifecycle.deactivate"), accessibleName: t("lifecycle.deactivate") + " " + administrativeName(row.name, scope.culture), icon: BanIcon, onSelect: () => chooseAction(row, "deactivate") }, { hidden: !canPublish || !row.lifecycle.canReactivate, label: t("lifecycle.reactivate"), accessibleName: t("lifecycle.reactivate") + " " + administrativeName(row.name, scope.culture), icon: RefreshIcon, onSelect: () => { void navigate("/formularios/" + row.id, { state: { reactivateFormId: row.id } }); } }, { hidden: !canManage || !row.lifecycle.canDelete || row.lifecycle.deletionUnavailableReason === "HasResponses" || row.lifecycle.responseCount !== null && row.lifecycle.responseCount > 0, label: t("lifecycle.delete"), accessibleName: t("lifecycle.delete") + " " + administrativeName(row.name, scope.culture), icon: TrashIcon, destructive: true, onSelect: () => chooseAction(row, "delete") }]} /> },
  ];
  return <div ref={host}><Page title={t("title")} actions={canManage ? <>{canAskAssistant(presentation.data?.installedFeatures, user?.permissions) ? <Button asChild variant="outline"><Link to="/" state={assistantDraftState(t("assistantProposals.entries.form"))}>{t("assistantProposals.entries.label")}</Link></Button> : null}<Button asChild><Link to="/formularios/nuevo">{t("new")}</Link></Button></> : undefined}>
    <FilterBar><div className="flex flex-wrap items-center gap-3"><div className="w-full sm:w-72"><SearchInput value={query.search ?? ""} onChange={pagination.setSearch} label={t("search")} /></div>{/* The state is the only piece to choose with the button of the bar (DS1-A, also the filters since 2026-11-22), without
      counts (FO1-A); choosing the one it has changes nothing (it would go back to page 1). */}
    <Picker trigger="button" label={t("filter")} options={publicationFilters.filter(([id]) => id !== "Pending" || canDecide).map(([id, label]) => ({ id, label: t(label) }))} value={publicationFilter}
      onChange={id => { if (id !== publicationFilter) update({ publicationFilter: id === "Active" ? undefined : id, page: undefined }); }} /><FolderFilter folders={folders} />
    {/* Last in the bar, apart from the filters: it takes no rows out, and «Limpiar filtros» keeps it (OT1-C). */}
    <SortMenu columns={columns} sort={sort ?? usualSort} onSortChange={pagination.setSort} /></div></FilterBar>
    {deactivatedPendingCount > 0 ? <div className="mb-4"><Banner action={<Button variant="outline" aria-label={t("overview.viewDeactivated")} onClick={() => update({ publicationFilter: "Deactivated", page: undefined })}>{t("common:actions.view")}</Button>}>{t("overview.deactivatedPending", { count: deactivatedPendingCount })}</Banner></div> : null}
    {/* Searching, filtering, sorting or paging keeps the previous rows in sight: the table says it reads again until they arrive. */}
    <Surface><DataTable columns={columns} rows={list.data?.items ?? []} hasData={list.data !== undefined} rowKey={row => row.id} isLoading={list.isPending} refreshing={list.isPlaceholderData} error={list.error ? t("loadFailed") : undefined} onRetry={() => { void list.refetch(); }} sort={sort ?? usualSort}
      // From the order shown: one left out of the request (the state among the deactivated) does not count for the first touch.
      onSortChange={(field, kind) => pagination.setSort(toggledSort(sort ?? usualSort, field, kind))}
      emptyTitle={folderEmpty?.title ?? t(pendingEmpty ? "overview.noPending" : hasFilters ? "noMatches" : "emptyTitle")} emptyDescription={hasFilters && !folderEmpty && !pendingEmpty ? t("noMatchesDescription") : undefined}
      emptyAction={folderEmpty?.searchAll ? <div className="flex flex-wrap justify-center gap-2"><Button type="button" variant="outline" onClick={folderEmpty.searchAll.run}>{folderEmpty.searchAll.label}</Button><Button type="button" variant="outline" onClick={clearFilters}>{t("clearFilters")}</Button></div>
        : folderEmpty || pendingEmpty ? undefined : hasFilters ? <Button type="button" variant="outline" onClick={clearFilters}>{t("clearFilters")}</Button> : canManage ? <Button asChild><Link to="/formularios/nuevo">{t("new")}</Link></Button> : undefined} />
      {list.data ? <Pagination {...list.data} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /> : null}
    </Surface>
  </Page>{canManage && foldersOf ? <ItemFoldersDialog kind="definitions" id={foldersOf.id} name={foldersOf.name} onClose={() => setFoldersOf(null)} /> : null}{canPublish && action?.owner === actionOwner && action.kind === "deactivate" ? <FormDeactivationDialog key={action.row.id} id={action.row.id} name={administrativeName(action.row.name, scope.culture)} scope={scope} appOnly={action.row.appOnly === true} onComplete={refresh} onObserved={refresh} onClose={() => setAction(null)} focusFallback={focusFallback} timeZoneId={user?.timeZoneId} /> : canManage && action?.owner === actionOwner && action.kind === "delete" ? <FormDeletionDialog id={action.row.id} name={administrativeName(action.row.name, scope.culture)} prefix={action.row.prefix} hasPublishedVersion={action.row.activeVersionNumber !== null && !action.row.lifecycle.publishedOnlyInApp} revision={action.row.lifecycle.revision} scope={scope} onChanged={() => { void refresh(); }} onDeleted={async () => { client.removeQueries({ queryKey: [...formScopeKey(scope), "detail", action.row.id] }); await refresh(); }} onClose={() => setAction(null)} focusFallback={focusFallback} /> : null}</div>;
}
