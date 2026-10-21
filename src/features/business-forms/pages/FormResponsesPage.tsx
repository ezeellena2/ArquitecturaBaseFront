import { useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import { Link, useMatch, useNavigate, useParams } from "react-router";
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
import { useResponseRouteQuery } from "../hooks/useResponseRouteQuery";
import { ResponseWorkspaceContext } from "../hooks/useResponseWorkspace";
import { FilterChip } from "@/shared/ui/FilterChip";
import { ResponseChoiceMenu } from "../components/ResponseChoiceMenu";
import { replaceResponseCondition, responseFilterLabels, visibleResponseColumns } from "../responses";
import type { ResponseRow } from "../api/responses";
import { responseFullPath } from "../responseNavigationPaths";
import { ResponseValue } from "../components/ResponseValue";
import { ResponseColumnsMenu } from "../components/ResponseColumnsMenu";
import { ResponseFiltersPanel } from "../components/ResponseFiltersPanel";
import { ResponseExportDialog } from "../components/ResponseExportDialog";
export function FormResponsesPage() {
  const { formId = "" } = useParams();
  const { t, i18n } = useTranslation("forms");
  const route = useResponseRouteQuery(formId);
  const { query, scope } = useResponseSheet(formId, route.query, route.ready);
  const mobile = useMediaQuery("(width < 640px)");
  const baseMatch = useMatch("/formularios/:formId/respuestas");
  const recordId = useMatch("/formularios/:formId/respuestas/:recordId")?.params.recordId;
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
  const [panel, setPanel] = useState<"filters" | "export" | null>(null);
  const [initialField, setInitialField] = useState<string | undefined>();
  const workspace = useContext(ResponseWorkspaceContext);
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
  const hasFilters =
    !!route.query.state ||
    !!route.query.search ||
    !!route.query.conditions?.length ||
    !!route.query.actorIds?.length ||
    !!route.query.versionIds?.length ||
    !!route.query.receivedFromUtc ||
    !!route.query.receivedToUtc;
  const rememberSheet = (recordId: string, page?: number) => {
    const params = new URLSearchParams(route.params); params.delete("approval");
    if (page !== undefined) { if (page === 1) params.delete("page"); else params.set("page", String(page)); }
    workspace?.setNavigation(formId, { origin: "sheet", selection: { recordId }, search: params.toString() });
    if (mobile) workspace?.prepareFull(formId, recordId);
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
      cell: (row) => (
        <span className="flex items-center gap-2">
          {row.channel === "phone" ? (
            <PublicWhatsAppIcon className="size-4 shrink-0" />
          ) : null}
          <span className="sr-only">
            {row.channel === "phone"
              ? t("responses.whatsapp")
              : t("responses.unknownChannel")}
          </span>
          {row.actor.displayName ?? t("responses.unknownPerson")}
        </span>
      ),
    },
    ...(data?.hasApproval ? [{ id: "state", header: t("approvals.state"), cell: (row: ResponseRow) => <Badge variant={approvalStateVariant(row.state)}>{t("approvals.states." + row.state)}</Badge> }] : []),
    ...(data?.records.items.some(row => row.hasPdf) ? [{ id: "pdf", header: t("detail.pdf"), cell: (row: ResponseRow) => row.hasPdf ? <IconButton label={t("detail.rowPdf", { number: row.number })} onClick={() => { rememberSheet(row.id); if (mobile) navigate(responseFullPath(formId, row.id, route.params.toString())); else update({ tab: "pdf" }, { pathname: "/formularios/" + formId + "/respuestas/" + row.id, replace: false }); }}><DocumentIcon className="size-4"/></IconButton> : null }] : []),
    ...visible.map((column) => ({
      id: column.fieldId,
      header:
        column.label +
        (column.introducedInVersion > 1
          ? " " +
            t("responses.sinceVersion", { version: column.introducedInVersion })
          : ""),
      sortable: true,
      cell: (row: ResponseRow) => (
        <ResponseValue
          cell={row.cells.find((cell) => cell.fieldId === column.fieldId)!}
          actor={scope.user!.id}
          recordId={row.id}
          number={row.number}
          label={column.label}
          viewerFiles={row.cells
            .filter((cell) => cell.type === "photo")
            .flatMap((cell) => (Array.isArray(cell.value) ? cell.value : []))}
          onForbidden={deny}
          onError={onFileError}
          detailLink={recordPath(row.id)}
          onOpenDetail={() => rememberSheet(row.id)}
        />
      ),
    })),
  ];
  const appliedFilters = responseFilterLabels(route.query, data?.columns ?? [], t, scope.user?.timeZoneId, data?.versions);
  const firstChoice = data?.columns.find((column) => column.type === "choice");
  const sort = route.query.sort?.replace(
    "field",
    route.query.sortFieldId ?? "field",
  );
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
        scope.user?.permissions.includes("formrecords.export") ? (
          <Button
            type="button"
            variant="outline"
            disabled={!canExport}
            onClick={() => setPanel("export")}
          >
            {t("responses.export")}
          </Button>
        ) : undefined
      }
    >
      {scope.user?.permissions.includes("formapprovals.decide") ? <FormPendingApprovals formId={formId} onDecided={() => { void query.refetch(); }}/> : null}
      <FilterBar>
        <div className="flex flex-wrap items-center gap-3">
          {!data ||
          data.columns.some((column) => column.type === "longText") ? (
            <div className="w-full sm:w-72">
              <SearchInput
                maxLength={100}
                value={route.query.search ?? ""}
                label={t("responses.search")}
                onChange={(search) =>
                  route.setFilter({
                    ...route.query,
                    search: search || undefined,
                  })
                }
              />
            </div>
          ) : null}
          {data?.hasApproval ? <NativeSelect aria-label={t("approvals.state")} value={route.query.state ?? ""} onChange={event => route.setFilter({ ...route.query, state: (event.target.value || undefined) as typeof route.query.state })}><option value="">{t("approvals.allStates")}</option>{(["Received", "PendingApproval", "Approved", "Rejected"] as const).map(state => <option key={state} value={state}>{t("approvals.states." + state)}</option>)}</NativeSelect> : null}
          {firstChoice ? (
            <ResponseChoiceMenu
              formId={formId}
              filter={route.query}
              column={firstChoice}
              onChange={(ids) =>
                route.setFilter({
                  ...route.query,
                  conditions: replaceResponseCondition(
                    route.query.conditions ?? [],
                    firstChoice.fieldId,
                    "in",
                    ids,
                  ),
                })
              }
              onMore={() => {
                setInitialField(firstChoice.fieldId);
                setPanel("filters");
              }}
            />
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={!data}
            onClick={() => {
              setInitialField(undefined);
              setPanel("filters");
            }}
          >
            {t("responses.received")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!data}
            onClick={() => {
              setInitialField(undefined);
              setPanel("filters");
            }}
          >
            {t("responses.filters")}
          </Button>
          <span className="text-sm text-[var(--color-content-muted)]">
            {data
              ? t("responses.count", { count: data.records.totalCount })
              : "…"}
          </span>
          <ResponseColumnsMenu
            columns={data?.columns ?? []}
            visible={visible}
            onChange={(ids) => route.setColumns(data?.columns ?? [], ids)}
          />
          {hasFilters ? (
            <Button
              type="button"
              variant="link"
              onClick={() => route.setFilter({}, [])}
            >
              {t("responses.clear")}
            </Button>
          ) : null}
        </div>
        {hasFilters ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {appliedFilters.map(filter => <FilterChip key={filter.key} removeLabel={t("responses.remove", { name: filter.label })} onRemove={() => {
              if (filter.key === "version") route.setFilter(route.query, []);
              else if (filter.key === "state") route.setFilter({ ...route.query, state: undefined });
              else if (filter.key === "actor") route.setFilter({ ...route.query, actorIds: [] });
              else if (filter.key === "received") route.setFilter({ ...route.query, receivedFromUtc: undefined, receivedToUtc: undefined });
              else if (filter.key === "search") route.setFilter({ ...route.query, search: undefined });
              else route.setFilter({ ...route.query, conditions: route.query.conditions?.filter(item => item.fieldId !== filter.key) });
            }}>{filter.label}</FilterChip>)}

          </div>
        ) : null}
      </FilterBar>
      <Surface>
        <DataTable
          columns={columns}
          rows={data?.records.items ?? []}
          rowKey={(row) => row.id}
          selectedRowKey={recordId ?? (workspace?.navigation?.origin === "sheet" ? workspace.navigation.selection.recordId : undefined)}
          onRowClick={row => { rememberSheet(row.id); if (row.id === recordId) setFocusRequest(value => value + 1); navigate(recordPath(row.id)); }}
          isLoading={query.isPending}
          hasData={!!data}
          error={query.error ? t(query.error instanceof ApiError && query.error.status === 404 ? "responses.unavailableForm" : "responses.loadFailed") : undefined}
          onRetry={query.error instanceof ApiError && query.error.status === 404 ? undefined : () => {
            void query.refetch();
          }}
          sort={sort}
          onSortChange={route.toggleSort}
          emptyTitle={t(hasFilters ? "responses.noMatches" : "responses.empty")}
          emptyDescription={t(
            hasFilters ? "responses.noMatchesHint" : "responses.emptyHint",
          )}
          emptyAction={
            hasFilters ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => route.setFilter({}, [])}
              >
                {t("responses.clear")}
              </Button>
            ) : undefined
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
      {panel === "filters" && data ? (
        <ResponseFiltersPanel
          initialFieldId={initialField}
          formId={formId}
          query={route.query}
          columns={data.columns}
          zone={scope.user?.timeZoneId ?? "UTC"}
          onApply={route.setFilter}
          onClose={() => setPanel(null)}
        />
      ) : null}
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
          onForbidden={() => {
            setPanel(null);
            notify({ id: `responses:export-permission:${scope.owner}:${formId}`, kind: "error", message: t("responses.exportNoPermission") });
          }}
          filterLabels={appliedFilters.map(item => item.label)}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </Page></div>
    {recordId ? <FormResponseDetailPage key={scope.owner + ":" + formId} formId={formId} recordId={recordId} navigation={{ selectionId: recordId, focusRequest, previous: index > 0 || index === 0 && !!data?.records.hasPrevious, next: index >= 0 && (index < (data?.records.items.length ?? 0) - 1 || !!data?.records.hasNext), busy: motion.busy, position: index >= 0 && data ? (data.records.page - 1) * data.records.pageSize + index + 1 : undefined, count: data?.records.totalCount, onMove: direction => { void motion.move(direction); }, onClose: () => update({ tab: undefined }, { pathname: "/formularios/" + formId + "/respuestas", replace: false }), error: query.error ?? motion.error, onRetry: motion.error ? motion.retry : query.refetch }} onDecided={() => { void query.refetch(); }}/> : null}
    </div>
  );
}
