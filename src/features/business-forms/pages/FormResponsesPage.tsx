import { lazy, Suspense, useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate, useMatch, useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { DocumentIcon } from "@/shared/ui/icons";
import { fetchResponseSheet } from "../api/responses";
import { FormPendingApprovals } from "../components/FormPendingApprovals";
import { FormResponseDetailPage } from "./FormResponseDetailPage";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { parseSort, type SortKind } from "@/shared/lib/sort";
import { Page } from "@/shared/ui/Page";
import { Badge } from "@/shared/ui/badge";
import { approvalStateVariant } from "../approvals";
import { Surface } from "@/shared/ui/Surface";
import { CellText } from "@/shared/ui/CellText";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { Pagination } from "@/shared/ui/Pagination";
import { SortMenu } from "@/shared/ui/SortMenu";
import { Button } from "@/shared/ui/button";
import { PublicWhatsAppIcon } from "@/shared/ui/icons";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { notify } from "@/shared/ui/notifications";
import { useResponsePanelNavigation } from "../hooks/useResponsePanelNavigation";
import { IconButton } from "@/shared/ui/IconButton";
import { responseSheetKeyRoot, useResponseFeedback, useResponseSheet } from "../hooks/useResponseQueries";
import { useRereadSignal } from "../hooks/useRereadSignal";
import { useResponseRouteQuery } from "../hooks/useResponseRouteQuery";
import { ResponseWorkspaceContext } from "../hooks/useResponseWorkspace";
import { formDashboardKeyRoot } from "../hooks/formDashboardKey";
import { Spinner } from "@/shared/ui/Spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { useFormPendingApprovals } from "../hooks/useFormPendingApprovals";
import { responseCatalogFieldCellText, responseFiles, responseFilterLabels, responseHasFilters, responseColumnSortKind, responseResultColumnId, visibleResponseColumnDescriptors, visibleResponseColumns, visibleResponseResultColumns } from "../responses";
import { responseResultColumnLabel, responseResultText } from "../responseResults";
import { isNumericType } from "../catalogValues";
import type { ResponseRow } from "../api/responses";
import { responseFullPath } from "../responseNavigationPaths";
import { ResponseValue } from "../components/ResponseValue";
import { ResponseColumnsMenu } from "../components/ResponseColumnsMenu";
import { ResponseFilterBar } from "../components/ResponseFilterBar";
import { DashboardFilterBar } from "../components/dashboard/DashboardFilterBar";
import { DashboardSkeleton } from "../components/dashboard/DashboardSkeleton";
import { dashboardFrame } from "../components/dashboard/dashboardLayout";
import { ResponseExportDialog } from "../components/ResponseExportDialog";
import { FormEntryPanel } from "../components/FormEntryPanel";
// A column that orders declares its kind and one that does not, `sortable: false` (OT1-C).
const sortableAs = (sortKind: SortKind | null) => sortKind ? { sortable: true as const, sortKind } : { sortable: false as const };
// The dashboard (DOC7-A) loads when its tab opens: the sheet does not pay for its charts. Its bar is not in that chunk: while
// the charts arrive the page draws it over the skeleton, as the dashboard does, so nothing jumps on the first open.
const FormDashboard = lazy(async () => ({ default: (await import("../components/dashboard/FormDashboard")).FormDashboard }));
export function FormResponsesPage() {
  const { formId = "" } = useParams();
  const { t, i18n } = useTranslation(["forms", "formEntries"]);
  const route = useResponseRouteQuery(formId);
  const { query, scope } = useResponseSheet(formId, route.query, route.ready);
  const mobile = useMediaQuery("(width < 640px)");
  const baseMatch = useMatch("/formularios/:formId/respuestas");
  // «nueva» is the loading panel (CW2-B), not a response.
  const adding = !!useMatch("/formularios/:formId/respuestas/nueva");
  const matchedRecord = useMatch("/formularios/:formId/respuestas/:recordId")?.params.recordId;
  const recordId = adding ? undefined : matchedRecord;
  const [savedRecord, setSavedRecord] = useState<string | undefined>();
  const navigate = useNavigate();
  const update = useQueryUpdate();
  const client = useQueryClient();
  const container = useRef<HTMLDivElement | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const lastRecord = useRef<string | undefined>(recordId);
  const contextKey = JSON.stringify([scope.owner, formId, recordId, route.query]);
  useLayoutEffect(() => {
    if (recordId) lastRecord.current = recordId;
    else if (lastRecord.current) { (container.current?.querySelector<HTMLElement>('[data-response-id="' + lastRecord.current + '"]') ?? container.current)?.focus(); lastRecord.current = undefined; }
  }, [recordId]);
  useResponseFeedback(recordId && !(query.error instanceof ApiError && query.error.status === 403) ? null : query.error, `responses:sheet:${scope.owner}:${formId}`, query.refetch);
  const exportCooldown = useCountdown(0);
  const canExport = !!query.data && !query.isFetching && !query.isPending && !query.isPlaceholderData && !query.isError;
  // The rows in sight dim under a running line while the sheet reads again (board LC2-A): another search, filter, order or
  // page, Reintentar after a failure with rows in sight, and the read that follows a decision or a saved response. Without
  // rows, Reintentar goes back to the first load's spinner.
  const reread = useRereadSignal(query);
  const refreshing = query.isPlaceholderData || query.isError && query.isFetching || reread.rereading;
  // A decision or a saved response also changes what the dashboard adds up (DOC7-A).
  const readAgain = () => { reread.mark(); void query.refetch(); void client.invalidateQueries({ queryKey: formDashboardKeyRoot(scope.owner, formId) }); };
  const canCreate = !!scope.user?.permissions.includes("formrecords.create");
  const addResponse = () => mobile
    ? navigate("/formularios/" + formId + "/cargar", { state: { from: "sheet" } })
    : navigate({ pathname: "/formularios/" + formId + "/respuestas/nueva", search: route.params.toString() });
  const [panel, setPanel] = useState<"export" | null>(null);
  const workspace = useContext(ResponseWorkspaceContext);
  // Who sees responses and approves has two tabs (board PL1-A): «Por aprobar (N)», the same query as its table, and «Todas».
  // The sheet opens in «Por aprobar» when there is something to decide and otherwise in «Todas»; the tab goes in the address.
  // «Tablero» follows (DOC7-A): for whoever reads or loads; next to «Respuestas (N)» when there is nothing to approve.
  // «Por resolver (N)» (F2, option B) goes after «Por aprobar»: the same sheet with only the responses whose rules have an action to
  // resolve, while the server counts some (only for whoever manages rules and sees every response) or it is the chosen tab, so
  // resolving the last one shows its empty state. It is never where the sheet opens.
  const decide = !!scope.user?.permissions.includes("formapprovals.decide");
  const pending = useFormPendingApprovals(formId, Math.max(1, Number(route.params.get("approvalPage") ?? 1) || 1),
    Math.max(1, Number(route.params.get("approvalPageSize") ?? 20) || 20), route.params.get("approval") ?? undefined, decide);
  const pendingCount = pending.query.data?.totalCount;
  const tabs = decide && !pending.forbidden;
  const chosen = route.params.get("view");
  const view = chosen === "dashboard" || chosen === "unresolved" ? chosen : !tabs ? "all"
    : chosen ?? (route.params.get("approval") ? "pending" : pendingCount !== undefined ? pendingCount > 0 ? "pending" : "all" : pending.query.isError ? "all" : undefined);
  const unresolvedCount = query.data?.unresolvedActionCount;
  const unresolvedTab = view === "unresolved" || unresolvedCount !== undefined && unresolvedCount > 0;
  // «Respuestas (N)» counts every response with the bar's filters. In «Por resolver» the sheet counts only those: the tab keeps the
  // count last read with the same filters, or goes without a number.
  const totalKey = JSON.stringify([scope.owner, formId, { ...route.query, page: 0, pageSize: 0, sort: "", sortFieldId: "", sortCatalogFieldId: "", sortResultId: "", unresolvedActions: undefined }]);
  const [total, setTotal] = useState<{ key: string; count: number } | null>(null);
  if (query.data && !query.isPlaceholderData && !route.query.unresolvedActions && (total?.key !== totalKey || total.count !== query.data.records.totalCount))
    setTotal({ key: totalKey, count: query.data.records.totalCount });
  const responsesCount = !route.query.unresolvedActions ? query.data?.records.totalCount : total?.key === totalKey ? total.count : undefined;
  // The dashboard opens without a response or a load beside it; going back to the sheet without approvals takes `view` away.
  // «Por resolver» and «Todas» share the sheet's page in the address: going in or out of it starts on the first one.
  const changeView = (next: string) => {
    const page = next === "unresolved" || view === "unresolved" ? { page: undefined } : {};
    if (next === "dashboard") update({ view: next, approval: undefined, tab: undefined, ...page }, { pathname: "/formularios/" + formId + "/respuestas" });
    else update({ view: next === "all" && !tabs ? undefined : next, approval: undefined, tab: undefined, ...page });
  };
  useBreadcrumbLeaf(query.data?.name);
  useLayoutEffect(() => {
    if (!baseMatch || recordId || workspace?.fullEntry?.locationKey === null || workspace?.navigation?.origin !== "sheet" || !workspace.fullEntry || !query.data || query.isPlaceholderData) return;
    const link = container.current?.querySelector<HTMLElement>('[data-response-id="' + workspace.navigation.selection.recordId + '"]');
    (link ?? container.current)?.focus();
    workspace.finishFull();
  }, [baseMatch, recordId, workspace, query.data, query.isPlaceholderData]);
  const deny = useCallback(() => workspace?.deny(), [workspace]);
  const onFileError = useCallback(
    (error: unknown) =>
      notify({
        id: `responses:files:${scope.owner}:${formId}`,
        kind: "error",
        message: readErrorMessage(error, t),
      }),
    [scope.owner, formId, t],
  );
  const data = query.data;
  const visible = visibleResponseColumns(data?.columns ?? [], route.selection);
  const displayColumns = visibleResponseColumnDescriptors(data?.columns ?? [], route.selection);
  // RE1-A: a column per datum an external action left, after the questions; a dash in a response without it.
  const resultColumns = visibleResponseResultColumns(data?.resultColumns, route.selection);
  const visibleCatalogFields = displayColumns.flatMap(column => column.catalogField ? [{ questionId: column.question.fieldId, fieldId: column.catalogField.fieldId }] : []);
  const hasFilters = responseHasFilters(route.query);
  const rememberSheet = (recordId: string, page?: number, intent?: "pdf") => {
    const params = new URLSearchParams(route.params); params.delete("approval");
    if (page !== undefined) { if (page === 1) params.delete("page"); else params.set("page", String(page)); }
    workspace?.setNavigation(formId, { origin: "sheet", selection: { recordId }, search: params.toString() });
    if (mobile) workspace?.prepareFull(formId, recordId, intent);
  };
  const index = query.data?.records.items.findIndex(row => row.id === recordId) ?? -1;
  const motion = useResponsePanelNavigation({ contextKey, ids: data?.records.items.map(row => row.id) ?? [], index, page: data?.records.page ?? route.query.page ?? 1, disabled: !data || query.isPlaceholderData,
    loadPage: async page => {
      const filter = { ...route.query, page };
      const result = await client.fetchQuery({ queryKey: [...responseSheetKeyRoot(scope.owner, formId), filter], queryFn: ({ signal }) => fetchResponseSheet(formId, filter, signal), gcTime: 0, meta: { errorOwner: "local" } });
      return { ids: result.records.items.map(row => row.id), totalCount: result.records.totalCount };
    },
    onNavigate: (id, page) => { rememberSheet(id, page); update({ page: page === 1 ? undefined : String(page) }, { pathname: "/formularios/" + formId + "/respuestas/" + id, replace: true }); },
  });
  if (
    !scope.allowed ||
    (query.error instanceof ApiError && query.error.status === 403)
  )
    return <ForbiddenPage />;
  // OT1-C: every column with one datum orders in the server. One shown only when the page has one keeps its place while it orders
  // the sheet: ordering «Corregida» with «No» first leaves the corrected ones on another page.
  const sortedBy = parseSort(route.sort)?.field;
  const recordPath = (id: string) => { const params = new URLSearchParams(route.params); params.delete("approval"); return mobile ? responseFullPath(formId, id, params.toString()) : `/formularios/${formId}/respuestas/${id}?${params}`; };
  const columns: Column<ResponseRow>[] = [
    {
      id: "number",
      header: t("responses.number"),
      sortable: true,
      sortKind: "number",
      cell: (row) => (
        <><Link
          data-response-id={row.id}
          to={recordPath(row.id)}
          onClick={event => { if (!event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { rememberSheet(row.id); if (row.id === recordId) setFocusRequest(value => value + 1); } }}
          className="font-medium text-[var(--color-brand-700)] underline"
        >
          {row.number}
        </Link></>
      ),
    },
    // A correction says so in its own column, only when the page has one (UD4, instead of next to its number as in CW10-A).
    ...(data?.records.items.some(row => row.corrected) || sortedBy === "corrected" ? [{ id: "corrected", header: t("detail.corrected"), sortable: true as const, sortKind: "yesNo" as const, cell: (row: ResponseRow) => row.corrected ? t("responses.yes") : "—" }] : []),
    {
      id: "submittedAtUtc",
      header: t("responses.received"),
      sortable: true,
      sortKind: "date",
      cell: (row) =>
        formatDateTimeInZone(
          row.submittedAtUtc,
          i18n.language,
          scope.user?.timeZoneId,
        ),
    },
    // Whoever only loads sees the same sheet with only what they loaded, without «Cargó» (CW6-C).
    ...(scope.ownOnly ? [] : [{
      id: "actor",
      header: t("responses.actor"),
      sortable: true as const,
      sortKind: "text" as const,
      cell: (row: ResponseRow) => row.actor.displayName ?? t("responses.unknownPerson"),
    }]),
    // The app goes first and a response passed from a document, which shows «—», last.
    {
      id: "channel",
      header: t("formEntries:sheet.channel"),
      sortable: true,
      sortKind: "state",
      cell: (row) => <span className="inline-flex items-center gap-1.5">{row.channel === "phone" ? <PublicWhatsAppIcon aria-hidden="true" className="size-4 shrink-0" /> : null}
        {row.channel === "app" ? t("formEntries:sheet.channels.app") : row.channel === "phone" ? t("responses.whatsapp") : "—"}</span>,
    },
    ...(data?.hasApproval || route.query.state === "Voided" ? [{ id: "state", header: t("approvals.state"), sortable: true as const, sortKind: "state" as const, cell: (row: ResponseRow) => <Badge variant={approvalStateVariant(row.state)}>{t("approvals.states." + row.state)}</Badge> }] : []),
    // F2: a response with actions to resolve says so in its own column after «Estado», only when the page has one or in its tab.
    ...(view === "unresolved" || data?.records.items.some(row => row.hasUnresolvedActions === true) || sortedBy === "rules" ? [{ id: "rules", header: t("responses.rules"), sortable: true as const, sortKind: "yesNo" as const, cell: (row: ResponseRow) => row.hasUnresolvedActions === true ? <Badge variant="warning">{t("responses.unresolved")}</Badge> : "—" }] : []),
    ...(data?.records.items.some(row => row.hasPdf) ? [{ sortable: false as const, id: "pdf", header: t("detail.pdf"), cell: (row: ResponseRow) => row.hasPdf ? <IconButton label={t("detail.rowPdf", { number: row.number })} onClick={() => { rememberSheet(row.id, undefined, "pdf"); if (mobile) navigate(responseFullPath(formId, row.id, route.params.toString())); else update({ tab: "pdf" }, { pathname: "/formularios/" + formId + "/respuestas/" + row.id, replace: false }); }}><DocumentIcon className="size-4"/></IconButton> : null }] : []),
    ...displayColumns.map(({ id, question: column, catalogField }) => ({
      id,
      // A header names one thing (UD4): since which version a question is asked is said in «Columnas».
      header: catalogField ? `${column.label} · ${catalogField.label}` : column.label,
      ...sortableAs(responseColumnSortKind(column, catalogField)),
      numeric: isNumericType(catalogField?.type ?? column.type),
      cell: (row: ResponseRow) => catalogField ? <span className="block max-w-64 whitespace-normal break-words"><CellText text={responseCatalogFieldCellText(row.cells.find(cell => cell.fieldId === column.fieldId)!, catalogField.fieldId, i18n.language, t("responses.yes"), t("responses.no"))} /></span> : <ResponseValue
          cell={row.cells.find(cell => cell.fieldId === column.fieldId)!}
          actor={scope.user!.id} recordId={row.id} label={column.label}
          viewerFiles={row.cells.filter(cell => cell.type === "photo").flatMap(cell => responseFiles(cell))}
          onForbidden={deny} onError={onFileError} detailLink={recordPath(row.id)} onOpenDetail={() => rememberSheet(row.id)}
        />,
    })),
    // A result orders as a number when it is a number or an amount, otherwise as text.
    ...resultColumns.map(column => ({
      id: responseResultColumnId(column.id),
      header: responseResultColumnLabel(column, data?.resultColumns ?? []),
      sortable: true as const,
      sortKind: column.kind === "number" || column.kind === "amount" ? "number" as const : "text" as const,
      numeric: column.kind === "number" || column.kind === "amount",
      cell: (row: ResponseRow) => responseResultText(column.kind, row.results?.[column.id], i18n.language) ?? t("responses.resultEmpty"),
    })),
  ];
  const appliedFilters = responseFilterLabels(route.query, data?.columns ?? [], t, i18n.language, scope.user?.timeZoneId, data?.versions, route.names);
  // The filters are the ones «Tablero» shares (ResponseFilterBar); «Columnas» and «Ordenar por» go at the end, the order last: it
  // takes no rows out (OT1-C). The count is at the foot.
  const sheet = <>
    <ResponseFilterBar formId={formId} route={route} columns={data?.columns ?? []} loaded={!!data} versions={data?.versions} hasApproval={!!data?.hasApproval}
      zone={scope.user?.timeZoneId ?? "UTC"} trailing={<div className="flex flex-wrap items-center gap-2 max-sm:w-full sm:ml-auto">
        <ResponseColumnsMenu columns={data?.columns ?? []} visible={visible} visibleCatalogFields={visibleCatalogFields}
          resultColumns={data?.resultColumns} visibleResults={resultColumns}
          onChange={(ids) => route.setColumns(data?.columns ?? [], ids, data?.resultColumns)}/>
        <SortMenu columns={columns} sort={route.sort} onSortChange={route.setSort}/>
      </div>}/>
    <Surface>
      <DataTable
        columns={columns}
        rows={data?.records.items ?? []}
        rowKey={(row) => row.id}
        selectedRowKey={recordId ?? (adding ? savedRecord : undefined) ?? (workspace?.navigation?.origin === "sheet" ? workspace.navigation.selection.recordId : undefined)}
        onRowClick={row => { rememberSheet(row.id); if (row.id === recordId) setFocusRequest(value => value + 1); navigate(recordPath(row.id)); }}
        isLoading={query.isPending}
        refreshing={refreshing}
        hasData={!!data}
        error={query.error ? t(query.error instanceof ApiError && query.error.status === 404 ? "responses.unavailableForm" : "responses.loadFailed") : undefined}
        onRetry={query.error instanceof ApiError && query.error.status === 404 ? undefined : () => {
          void query.refetch();
        }}
        sort={route.sort}
        onSortChange={route.toggleSort}
        emptyTitle={t(hasFilters ? "responses.noMatches" : view === "unresolved" ? "responses.noUnresolved" : "responses.empty")}
        // An empty sheet does not explain how responses arrive (decision of 2026-10-31): its title and the way out. Adding a
        // response resolves nothing: «Por resolver» empty has only its title.
        emptyAction={
          hasFilters ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => route.setFilter({}, [])}
            >
              {t("responses.clear")}
            </Button>
          ) : canCreate && view !== "unresolved" ? <Button type="button" variant="outline" onClick={addResponse}>{t("formEntries:addResponse")}</Button> : undefined
        }
      />
      {data ? (
        <Pagination
          {...data.records}
          onPageChange={route.pagination.setPage}
          onPageSizeChange={route.pagination.setPageSize}
        />
      ) : null}
    </Surface>
  </>;
  return (
    <div ref={container} tabIndex={-1} className="relative h-full min-h-0 outline-none">
    <div inert={mobile && !!recordId} className="h-full overflow-y-auto"><Page
      title={data?.name ?? t("responses.title")}
      status={
        data
          ? t("responses.publishedVersion", {
              version: data.activeVersionNumber,
            })
          : undefined
      }
      actions={
        scope.user?.permissions.includes("formrecords.export") || scope.user?.permissions.includes("formrecords.create") ? <>
          {scope.user?.permissions.includes("formrecords.export") ? (
          <Button
            type="button"
            variant="outline"
            disabled={!canExport}
            onClick={() => setPanel("export")}
          >
            {t("responses.export")}
          </Button>
          ) : null}
          {canCreate ? <Button type="button" onClick={addResponse}>{t("formEntries:addResponse")}</Button> : null}
        </> : undefined
      }
    >
      {/* Changing tab closes a chosen task, but keeps the page of each one. The approvals and the sheet stay mounted: losing the
          permission to decide takes their tabs away and leaves the notice of the queue, with the response being read, over the
          sheet. «Tablero» reads only while it is open (DOC7-A). */}
      <Tabs value={view ?? ""} onValueChange={changeView}>
        <TabsList aria-label={t("responses.title")}>
          {tabs ? <TabsTrigger value="pending">{pendingCount === undefined ? t("overview.pendingColumn") : t("responses.tabs.pending", { count: pendingCount })}</TabsTrigger> : null}
          {unresolvedTab ? <TabsTrigger value="unresolved">{unresolvedCount === undefined ? t("responses.unresolved") : t("responses.tabs.unresolved", { count: unresolvedCount })}</TabsTrigger> : null}
          <TabsTrigger value="all">{tabs ? t("responses.tabs.all") : responsesCount !== undefined ? t("responses.tabs.responses", { count: responsesCount }) : t("responses.title")}</TabsTrigger>
          <TabsTrigger value="dashboard">{t("responses.tabs.dashboard")}</TabsTrigger>
        </TabsList>
        {tabs && view === undefined ? <Spinner/> : null}
        {decide ? <TabsContent value="pending" forceMount hidden={view === "dashboard" || tabs && view !== "pending"}><FormPendingApprovals formId={formId} onDecided={readAgain} inTab={tabs} pending={pending}/></TabsContent> : null}
        {/* «Por resolver» is the same sheet, mounted once: its panel takes the value of the tab in sight. */}
        <TabsContent value={view === "unresolved" ? "unresolved" : "all"} forceMount hidden={view !== "all" && view !== "unresolved"}>{sheet}</TabsContent>
        <TabsContent value="dashboard">{view === "dashboard" ? <Suspense fallback={<div className={dashboardFrame}><DashboardFilterBar formId={formId} route={route} sheet={data}/><DashboardSkeleton/></div>}>
          <FormDashboard formId={formId} route={route} sheet={data}/>
        </Suspense> : null}</TabsContent>
      </Tabs>
      {panel === "export" && data ? (
        <ResponseExportDialog
          formId={formId}
          prefix={data.prefix}
          filter={route.query}
          total={data.records.totalCount}
          ready={canExport}
          cooldown={exportCooldown}
          columns={data.columns}
          visible={visible}
          visibleCatalogFields={visibleCatalogFields}
          resultColumns={data.resultColumns}
          visibleResults={resultColumns}
          onForbidden={() => {
            setPanel(null);
            notify({ id: `responses:export-permission:${scope.owner}:${formId}`, kind: "error", message: t("responses.exportNoPermission") });
          }}
          filterLabels={appliedFilters.map(item => item.label)}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </Page></div>
    {adding && !mobile ? <FormEntryPanel key={scope.owner + ":" + formId} formId={formId} formName={data?.name}
      onClose={() => navigate({ pathname: "/formularios/" + formId + "/respuestas", search: route.params.toString() })}
      onSaved={id => { setSavedRecord(id); readAgain(); }}/> : null}
    {adding && mobile ? <Navigate to={"/formularios/" + formId + "/cargar"} state={{ from: "sheet" }} replace/> : null}
    {/* D2 corrects in its own panel (VF1-A, decision 5): once saved, the sheet reads again and opens the correction. */}
    {recordId ? <FormResponseDetailPage key={scope.owner + ":" + formId} formId={formId} recordId={recordId}
      onCorrected={id => { readAgain(); navigate({ pathname: "/formularios/" + formId + "/respuestas/" + id, search: route.params.toString() }); }}
      onVoided={() => { readAgain(); update({ tab: undefined }, { pathname: "/formularios/" + formId + "/respuestas", replace: false }); }} navigation={{ selectionId: recordId, focusRequest, previous: index > 0 || index === 0 && !!data?.records.hasPrevious || motion.gap !== null && (motion.gap > 0 || !!data?.records.hasPrevious), next: index >= 0 && (index < (data?.records.items.length ?? 0) - 1 || !!data?.records.hasNext) || motion.gap !== null && (motion.gap < (data?.records.items.length ?? 0) || !!data?.records.hasNext), busy: motion.busy, position: index >= 0 && data ? (data.records.page - 1) * data.records.pageSize + index + 1 : undefined, count: data?.records.totalCount, onMove: direction => { void motion.move(direction); }, onClose: () => update({ tab: undefined }, { pathname: "/formularios/" + formId + "/respuestas", replace: false }), error: query.error ?? motion.error, onRetry: motion.error ? motion.retry : query.refetch, retrying: query.isError && query.isFetching }} onDecided={readAgain}/> : null}
    </div>
  );
}
