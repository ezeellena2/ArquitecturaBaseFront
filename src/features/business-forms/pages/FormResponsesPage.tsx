import { useCallback, useContext, useState } from "react";
import { Link, useParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { Pagination } from "@/shared/ui/Pagination";
import { FilterBar } from "@/shared/ui/FilterBar";
import { SearchInput } from "@/shared/ui/SearchInput";
import { Button } from "@/shared/ui/button";
import { PublicWhatsAppIcon } from "@/shared/ui/icons";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { notify } from "@/shared/ui/notifications";
import { useResponseSheet } from "../hooks/useResponseQueries";
import { useResponseRouteQuery } from "../hooks/useResponseRouteQuery";
import { ResponseWorkspaceContext } from "../hooks/useResponseWorkspace";
import { FilterChip } from "@/shared/ui/FilterChip";
import { ResponseChoiceMenu } from "../components/ResponseChoiceMenu";
import { replaceResponseCondition, responseFilterLabels, visibleResponseColumns } from "../responses";
import type { ResponseRow } from "../api/responses";
import { ResponseValue } from "../components/ResponseValue";
import { ResponseColumnsMenu } from "../components/ResponseColumnsMenu";
import { ResponseFiltersPanel } from "../components/ResponseFiltersPanel";
import { ResponseExportDialog } from "../components/ResponseExportDialog";
export function FormResponsesPage() {
  const { formId = "" } = useParams();
  const { t, i18n } = useTranslation("forms");
  const route = useResponseRouteQuery(formId);
  const { query, scope } = useResponseSheet(formId, route.query, route.ready);
  const [panel, setPanel] = useState<"filters" | "export" | null>(null);
  const [initialField, setInitialField] = useState<string | undefined>();
  const workspace = useContext(ResponseWorkspaceContext);
  useBreadcrumbLeaf(query.data?.name);
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
    !!route.query.search ||
    !!route.query.conditions?.length ||
    !!route.query.actorIds?.length ||
    !!route.query.versionIds?.length ||
    !!route.query.receivedFromUtc ||
    !!route.query.receivedToUtc;
  if (
    !scope.allowed ||
    (query.error instanceof ApiError && query.error.status === 403)
  )
    return <ForbiddenPage />;
  const recordPath = (id: string) =>
    `/formularios/${formId}/respuestas/${id}?${route.params}`;
  const columns: Column<ResponseRow>[] = [
    {
      id: "number",
      header: t("responses.number"),
      sortable: true,
      cell: (row) => (
        <Link
          to={recordPath(row.id)}
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
    <Page
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
            disabled={!data}
            onClick={() => setPanel("export")}
          >
            {t("responses.export")}
          </Button>
        ) : undefined
      }
    >
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
    </Page>
  );
}
