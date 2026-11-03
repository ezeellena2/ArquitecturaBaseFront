import { useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { Link, Navigate, useMatch, useNavigate, useParams } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { NativeSelect } from "@/shared/ui/NativeSelect";
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
import { Page } from "@/shared/ui/Page";
import { Badge } from "@/shared/ui/badge";
import { approvalStateVariant } from "../approvals";
import { Surface } from "@/shared/ui/Surface";
import { CellText } from "@/shared/ui/CellText";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { Pagination } from "@/shared/ui/Pagination";
import { FilterBar } from "@/shared/ui/FilterBar";
import { SearchInput } from "@/shared/ui/SearchInput";
import { Button } from "@/shared/ui/button";
import { PublicWhatsAppIcon } from "@/shared/ui/icons";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { notify } from "@/shared/ui/notifications";
import { useResponsePanelNavigation } from "../hooks/useResponsePanelNavigation";
import { IconButton } from "@/shared/ui/IconButton";
import { useResponseFeedback, useResponseSheet } from "../hooks/useResponseQueries";
import { useRereadSignal } from "../hooks/useRereadSignal";
import { useResponseRouteQuery } from "../hooks/useResponseRouteQuery";
import { ResponseWorkspaceContext } from "../hooks/useResponseWorkspace";
import { FilterChip } from "@/shared/ui/FilterChip";
import { Spinner } from "@/shared/ui/Spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { useFormPendingApprovals } from "../hooks/useFormPendingApprovals";
import { responseCatalogFieldCellText, responseFiles, responseFilterLabels, visibleResponseColumnDescriptors, visibleResponseColumns } from "../responses";
import { isNumericType } from "../catalogValues";
import type { ResponseRow } from "../api/responses";
import { responseFullPath } from "../responseNavigationPaths";
import { ResponseValue } from "../components/ResponseValue";
import { ResponseColumnsMenu } from "../components/ResponseColumnsMenu";
import { ResponseFiltersMenu } from "../components/ResponseFiltersMenu";
import { ResponseExportDialog } from "../components/ResponseExportDialog";
import { FormEntryPanel } from "../components/FormEntryPanel";
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
  const readAgain = () => { reread.mark(); void query.refetch(); };
  const canCreate = !!scope.user?.permissions.includes("formrecords.create");
  const addResponse = () => mobile
    ? navigate("/formularios/" + formId + "/cargar", { state: { from: "sheet" } })
    : navigate({ pathname: "/formularios/" + formId + "/respuestas/nueva", search: route.params.toString() });
  const [panel, setPanel] = useState<"export" | null>(null);
  const workspace = useContext(ResponseWorkspaceContext);
  // Who sees responses and approves has two tabs (board PL1-A): «Por aprobar (N)», the same query as its table, and «Todas».
  // The sheet opens in «Por aprobar» when there is something to decide and otherwise in «Todas»; the tab goes in the address.
  const decide = !!scope.user?.permissions.includes("formapprovals.decide");
  const pending = useFormPendingApprovals(formId, Math.max(1, Number(route.params.get("approvalPage") ?? 1) || 1),
    Math.max(1, Number(route.params.get("approvalPageSize") ?? 20) || 20), route.params.get("approval") ?? undefined, decide);
  const pendingCount = pending.query.data?.totalCount;
  const tabs = decide && !pending.forbidden;
  const view = route.params.get("view") ?? (route.params.get("approval") ? "pending" : pendingCount !== undefined ? pendingCount > 0 ? "pending" : "all" : pending.query.isError ? "all" : undefined);
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
  const visibleCatalogFields = displayColumns.flatMap(column => column.catalogField ? [{ questionId: column.question.fieldId, fieldId: column.catalogField.fieldId }] : []);
  const hasFilters =
    !!route.query.state ||
    route.query.enteredInApp != null ||
    !!route.query.search ||
    !!route.query.conditions?.length ||
    !!route.query.actorIds?.length ||
    !!route.query.versionIds?.length ||
    !!route.query.receivedFromUtc ||
    !!route.query.receivedToUtc;
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
      const result = await client.fetchQuery({ queryKey: ["form-responses", scope.owner, "sheet", formId, filter], queryFn: ({ signal }) => fetchResponseSheet(formId, filter, signal), gcTime: 0, meta: { errorOwner: "local" } });
      return { ids: result.records.items.map(row => row.id), totalCount: result.records.totalCount };
    },
    onNavigate: (id, page) => { rememberSheet(id, page); update({ page: page === 1 ? undefined : String(page) }, { pathname: "/formularios/" + formId + "/respuestas/" + id, replace: true }); },
  });
  if (
    !scope.allowed ||
    (query.error instanceof ApiError && query.error.status === 403)
  )
    return <ForbiddenPage />;
  const recordPath = (id: string) => { const params = new URLSearchParams(route.params); params.delete("approval"); return mobile ? responseFullPath(formId, id, params.toString()) : `/formularios/${formId}/respuestas/${id}?${params}`; };
  const columns: Column<ResponseRow>[] = [
    {
      id: "number",
      header: t("responses.number"),
      sortable: true,
      cell: (row) => (
        <Link
          data-response-id={row.id}
          to={recordPath(row.id)}
          onClick={event => { if (!event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { rememberSheet(row.id); if (row.id === recordId) setFocusRequest(value => value + 1); } }}
          className="font-medium text-[var(--color-brand-700)] underline"
        >
          {row.number}
        </Link>
      ),
    },
    {
      id: "submittedAtUtc",
      header: t("responses.received"),
      sortable: true,
      cell: (row) =>
        formatDateTimeInZone(
          row.submittedAtUtc,
          i18n.language,
          scope.user?.timeZoneId,
        ),
    },
    {
      id: "actor",
      header: t("responses.actor"),
      sortable: true,
      cell: (row) => row.actor.displayName ?? t("responses.unknownPerson"),
    },
    {
      id: "channel",
      header: t("formEntries:sheet.channel"),
      cell: (row) => <span className="inline-flex items-center gap-1.5">{row.channel === "phone" ? <PublicWhatsAppIcon aria-hidden="true" className="size-4 shrink-0" /> : null}
        {row.channel === "app" ? t("formEntries:sheet.channels.app") : row.channel === "phone" ? t("responses.whatsapp") : "—"}</span>,
    },
    ...(data?.hasApproval ? [{ id: "state", header: t("approvals.state"), cell: (row: ResponseRow) => <Badge variant={approvalStateVariant(row.state)}>{t("approvals.states." + row.state)}</Badge> }] : []),
    ...(data?.records.items.some(row => row.hasPdf) ? [{ id: "pdf", header: t("detail.pdf"), cell: (row: ResponseRow) => row.hasPdf ? <IconButton label={t("detail.rowPdf", { number: row.number })} onClick={() => { rememberSheet(row.id, undefined, "pdf"); if (mobile) navigate(responseFullPath(formId, row.id, route.params.toString())); else update({ tab: "pdf" }, { pathname: "/formularios/" + formId + "/respuestas/" + row.id, replace: false }); }}><DocumentIcon className="size-4"/></IconButton> : null }] : []),
    ...displayColumns.map(({ id, question: column, catalogField }) => ({
      id,
      header: catalogField ? `${column.label} · ${catalogField.label}` : column.label + (column.introducedInVersion > 1 ? " " + t("responses.sinceVersion", { version: column.introducedInVersion }) : ""),
      sortable: !catalogField && column.type !== "multiChoice",
      numeric: isNumericType(catalogField?.type ?? column.type),
      cell: (row: ResponseRow) => catalogField ? <span className="block max-w-64 whitespace-normal break-words"><CellText text={responseCatalogFieldCellText(row.cells.find(cell => cell.fieldId === column.fieldId)!, catalogField.fieldId, i18n.language, t("responses.yes"), t("responses.no"))} /></span> : <ResponseValue
          cell={row.cells.find(cell => cell.fieldId === column.fieldId)!}
          actor={scope.user!.id} recordId={row.id} number={row.number} label={column.label}
          viewerFiles={row.cells.filter(cell => cell.type === "photo").flatMap(cell => responseFiles(cell))}
          onForbidden={deny} onError={onFileError} detailLink={recordPath(row.id)} onOpenDetail={() => rememberSheet(row.id)}
        />,
    })),
  ];
  const appliedFilters = responseFilterLabels(route.query, data?.columns ?? [], t, i18n.language, scope.user?.timeZoneId, data?.versions, route.names);
  const sort = route.query.sort?.replace(
    "field",
    route.query.sortFieldId ?? "field",
  );
  // The search, the channel and the state stay in sight, side by side; the rest goes in «Filtros», which applies each change
  // at once, and what is applied is a chip under the bar with «Limpiar todo», as in Usuarios. The count is at the foot.
  const sheet = <>
    <FilterBar className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {!data || data.columns.some((column) => column.type === "longText") ? (
          <div className="w-full sm:w-72">
            <SearchInput maxLength={100} value={route.query.search ?? ""} label={t("responses.search")}
              onChange={(search) => route.setFilter({ ...route.query, search: search || undefined })}/>
          </div>
        ) : null}
        {/* «Canal» is one more quick filter (CW6-A): App or WhatsApp. */}
        <div className="w-full sm:w-44"><NativeSelect aria-label={t("formEntries:sheet.channel")} value={route.query.enteredInApp == null ? "" : String(route.query.enteredInApp)}
          onChange={event => route.setFilter({ ...route.query, enteredInApp: event.target.value === "" ? undefined : event.target.value === "true" })}>
          <option value="">{t("formEntries:sheet.allChannels")}</option>
          <option value="true">{t("formEntries:sheet.channels.app")}</option>
          <option value="false">{t("responses.whatsapp")}</option>
        </NativeSelect></div>
        {data?.hasApproval ? <div className="w-full sm:w-44"><NativeSelect aria-label={t("approvals.state")} value={route.query.state ?? ""} onChange={event => route.setFilter({ ...route.query, state: (event.target.value || undefined) as typeof route.query.state })}><option value="">{t("approvals.allStates")}</option>{(["Received", "PendingApproval", "Approved", "Rejected"] as const).map(state => <option key={state} value={state}>{t("approvals.states." + state)}</option>)}</NativeSelect></div> : null}
        <ResponseFiltersMenu formId={formId} query={route.query} columns={data?.columns ?? []} zone={scope.user?.timeZoneId ?? "UTC"} names={route.names} disabled={!data} onApply={route.setFilter}/>
        <div className="sm:ml-auto">
          <ResponseColumnsMenu columns={data?.columns ?? []} visible={visible} visibleCatalogFields={visibleCatalogFields}
            onChange={(ids) => route.setColumns(data?.columns ?? [], ids)}/>
        </div>
      </div>
      {hasFilters ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--color-border)] pt-3">
          {appliedFilters.map(filter => <FilterChip key={filter.key} removeLabel={t("responses.remove", { name: filter.label })} onRemove={() => {
            if (filter.key === "version") route.setFilter(route.query, []);
            else if (filter.key === "state") route.setFilter({ ...route.query, state: undefined });
            else if (filter.key === "channel") route.setFilter({ ...route.query, enteredInApp: undefined });
            else if (filter.key === "actor") route.setFilter({ ...route.query, actorIds: [] });
            else if (filter.key === "received") route.setFilter({ ...route.query, receivedFromUtc: undefined, receivedToUtc: undefined });
            else if (filter.key === "search") route.setFilter({ ...route.query, search: undefined });
            else route.setFilter({ ...route.query, conditions: route.query.conditions?.filter(item => item.fieldId !== filter.key) });
          }}>{filter.label}</FilterChip>)}
          <Button type="button" variant="muted-link" size="inline" onClick={() => route.setFilter({}, [])}>{t("responses.clear")}</Button>
        </div>
      ) : null}
    </FilterBar>
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
        sort={sort}
        onSortChange={route.toggleSort}
        emptyTitle={t(hasFilters ? "responses.noMatches" : "responses.empty")}
        // An empty sheet does not explain how responses arrive (decision of 2026-10-31): its title and the way out.
        emptyAction={
          hasFilters ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => route.setFilter({}, [])}
            >
              {t("responses.clear")}
            </Button>
          ) : canCreate ? <Button type="button" variant="outline" onClick={addResponse}>{t("formEntries:addResponse")}</Button> : undefined
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
      {/* Changing tab closes a chosen task, but keeps the page of each one. Both stay mounted: losing the permission to
          decide takes the tabs away and leaves the notice of the queue, with the response being read, over the sheet. */}
      {decide ? <Tabs value={view ?? ""} onValueChange={next => update({ view: next, approval: undefined, tab: undefined })}>
        {tabs ? <TabsList aria-label={t("responses.title")}>
          <TabsTrigger value="pending">{pendingCount === undefined ? t("overview.pendingColumn") : t("responses.tabs.pending", { count: pendingCount })}</TabsTrigger>
          <TabsTrigger value="all">{t("responses.tabs.all")}</TabsTrigger>
        </TabsList> : null}
        {tabs && view === undefined ? <Spinner/> : null}
        <TabsContent value="pending" forceMount hidden={tabs && view !== "pending"}><FormPendingApprovals formId={formId} onDecided={readAgain} inTab={tabs} pending={pending}/></TabsContent>
        <TabsContent value="all" forceMount hidden={tabs && view !== "all"}>{sheet}</TabsContent>
      </Tabs> : sheet}
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
    {recordId ? <FormResponseDetailPage key={scope.owner + ":" + formId} formId={formId} recordId={recordId} navigation={{ selectionId: recordId, focusRequest, previous: index > 0 || index === 0 && !!data?.records.hasPrevious, next: index >= 0 && (index < (data?.records.items.length ?? 0) - 1 || !!data?.records.hasNext), busy: motion.busy, position: index >= 0 && data ? (data.records.page - 1) * data.records.pageSize + index + 1 : undefined, count: data?.records.totalCount, onMove: direction => { void motion.move(direction); }, onClose: () => update({ tab: undefined }, { pathname: "/formularios/" + formId + "/respuestas", replace: false }), error: query.error ?? motion.error, onRetry: motion.error ? motion.retry : query.refetch, retrying: query.isError && query.isFetching }} onDecided={readAgain}/> : null}
    </div>
  );
}
