import { Link, useLocation, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/auth/usePermissions";
import { useSystemPresentation } from "@/shared/api/presentation";
import { usePagination } from "@/shared/hooks/usePagination";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { formatNumber } from "@/shared/lib/numberFormat";
import { parseSort } from "@/shared/lib/sort";
import { Banner } from "@/shared/ui/Banner";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { FilterBar } from "@/shared/ui/FilterBar";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { PlusIcon } from "@/shared/ui/icons";
import { Page } from "@/shared/ui/Page";
import { Pagination } from "@/shared/ui/Pagination";
import { Picker } from "@/shared/ui/Picker";
import { RowActions } from "@/shared/ui/RowActions";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SortMenu } from "@/shared/ui/SortMenu";
import { Surface } from "@/shared/ui/Surface";
import { formOverviewSortFields, type FormOverviewRow } from "../api/overview";
import { approvalStateVariant } from "../approvals";
import { useFormOverview } from "../hooks/useFormOverview";
import { useResponseFeedback } from "../hooks/useResponseQueries";

export function FormOverviewPage() {
  const { t, i18n } = useTranslation(["forms", "formEntries"]);
  const [params] = useSearchParams();
  const location = useLocation();
  const update = useQueryUpdate();
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true);
  // FU4: the same filter as the list of whoever designs (`publicationFilter`), «Con algo por aprobar» included.
  const filter = params.get("publicationFilter");
  const state = filter === "Deactivated" ? "Deactivated" : "Active";
  // The server owns the row set; a shared URL cannot grant decision filters.
  const { has } = usePermissions();
  const both = has("formrecords.read") && has("formapprovals.decide");
  const pendingOnly = both && filter === "Pending";
  // Every column orders (OT1-C), by its header and by «Ordenar por», in the server; a field it does not order by is left out.
  // Without one, the usual order is composite (what awaits approval, the last received, the name): no arrow.
  const sort = formOverviewSortFields.includes(parseSort(pagination.sort)?.field ?? "") ? pagination.sort : undefined;
  // CM3: no folders here, neither a panel nor a filter: they are the side menu, and an old `?carpeta=` is ignored.
  const { scope, query, forbidden } = useFormOverview({ page: pagination.page, pageSize: pagination.pageSize,
    search: pagination.search, sort, state, pendingOnly }, pagination.ready);
  useResponseFeedback(query.error, "forms:overview:" + scope.owner, query.refetch);
  if (!scope.allowed || forbidden) return <ForbiddenPage/>;
  const data = query.data;
  // An empty list says what is missing with its title only, without explaining how it works (decision of 2026-10-31).
  const emptyTitle = pagination.search ? "noMatches"
    : !scope.canRead && !scope.canCreate || pendingOnly ? "overview.noPending"
    : state === "Deactivated" ? "overview.noDeactivated"
    : "responses.noForms";
  // Whoever only completes forms opens the sheet of their own (CW6-C), without the filter of deactivated forms.
  const canOpen = scope.canRead || scope.canDecide || scope.canCreate;
  const own = scope.canCreate && !scope.canRead;
  const formPath = (id: string) => "/formularios/" + id + "/respuestas";
  // One piece of data per column (UD1). The filter shows one state at a time; the views without one in use (pendingOnly,
  // or whoever only loads) mix active and deactivated forms, and then the state of each form goes in its own column.
  const mixed = (!(scope.canRead || scope.canDecide) || pendingOnly) && !!data?.forms.items.some(row => row.deactivatedAtUtc);
  const lastNumber = (row: FormOverviewRow) => row.lastResponse
    ? <Link to={formPath(row.id) + "/" + row.lastResponse.id} className="font-medium text-[var(--color-brand-700)] underline">{row.lastResponse.number}</Link> : "—";
  const received = (row: FormOverviewRow) => row.lastResponse
    ? <time dateTime={row.lastResponse.submittedAtUtc}>{formatDateTimeInZone(row.lastResponse.submittedAtUtc, i18n.language, scope.user?.timeZoneId)}</time> : "—";
  // Each column's id is the server's field to order by (OT1-C).
  const columns: Column<FormOverviewRow>[] = [
    { id: "name", header: t("formColumn"), sortable: true, sortKind: "text", cell: row => canOpen ? <Link to={formPath(row.id)} className="font-medium text-[var(--color-brand-700)] underline">{row.name}</Link> : <span className="font-medium">{row.name}</span> },
    ...(mixed ? [{ id: "formState", header: t("overview.formState"), sortable: true as const, sortKind: "state" as const, cell: (row: FormOverviewRow) => t(row.deactivatedAtUtc ? "overview.formStates.Deactivated" : "overview.formStates.Active") }] : []),
    ...(scope.canDecide ? [{ id: "pendingApprovalCount", header: t("overview.pendingColumn"), sortable: true as const, sortKind: "number" as const, numeric: true, cell: (row: FormOverviewRow) => row.pendingApprovalCount ? <Link to={formPath(row.id)} aria-label={t("overview.pendingFor", { name: row.name, count: row.pendingApprovalCount })}><Badge variant="warning">{formatNumber(row.pendingApprovalCount, i18n.language)}</Badge></Link> : "—" }] : []),
    ...(scope.canRead ? [
      { id: "responseCount", header: t("overview.responses"), sortable: true as const, sortKind: "number" as const, numeric: true, cell: (row: FormOverviewRow) => row.responseCount ?? "—" },
      { id: "lastResponseNumber", header: t("overview.lastResponse"), sortable: true as const, sortKind: "text" as const, cell: lastNumber },
      { id: "lastSubmittedAtUtc", header: t("responses.received"), sortable: true as const, sortKind: "date" as const, cell: received },
      { id: "lastResponseState", header: t("approvals.state"), sortable: true as const, sortKind: "state" as const, cell: (row: FormOverviewRow) => row.lastResponse
        ? <Badge variant={approvalStateVariant(row.lastResponse.state)}>{t("approvals.states." + row.lastResponse.state)}</Badge> : "—" },
    ] : []),
    // Whoever only loads counts their own responses and sees their last one, without its state (CW9).
    ...(own ? [
      { id: "responseCount", header: t("overview.myEntries"), sortable: true as const, sortKind: "number" as const, numeric: true, cell: (row: FormOverviewRow) => row.responseCount || "—" },
      { id: "lastResponseNumber", header: t("overview.myLastEntry"), sortable: true as const, sortKind: "text" as const, cell: lastNumber },
      { id: "lastSubmittedAtUtc", header: t("responses.received"), sortable: true as const, sortKind: "date" as const, cell: received },
    ] : []),
    // A table row carries no text buttons: loading is an icon with its name in the tooltip, and a link, since it goes elsewhere.
    ...(scope.canCreate ? [{ id: "load", header: t("actionsColumn"), sortable: false as const, align: "right" as const, cell: (row: FormOverviewRow) => <RowActions actions={[{
      hidden: !!row.deactivatedAtUtc, label: t("formEntries:load"), accessibleName: t("formEntries:loadForm", { name: row.name }), icon: PlusIcon,
      to: "/formularios/" + row.id + "/cargar", state: { from: "overview", list: "/formularios" + location.search } }]}/> }] : []),
  ];
  return <Page title={t("overview.title")}>
    <FilterBar><div className="flex flex-wrap items-center gap-3"><div className="w-full sm:w-72"><SearchInput maxLength={100} label={t("overview.search")} value={pagination.search ?? ""} onChange={pagination.setSearch}/></div>{scope.canRead || scope.canDecide
      // The state is the only piece to choose with the button of the bar (DS1-A, also the filters since 2026-11-22), without
      // counts (FO1-A). «Con algo por aprobar» is one more option (FU4): it mixes both states.
      ? <Picker trigger="button" label={t("overview.state")} value={pendingOnly ? "Pending" : state}
        options={[{ id: "Active", label: t("active") }, ...(both ? [{ id: "Pending", label: t("overview.pendingOnly") }] : []), { id: "Deactivated", label: t("deactivated") }]}
        // Choosing the one it has changes nothing: it would go back to page 1.
        onChange={id => { if (id !== (pendingOnly ? "Pending" : state)) update({ publicationFilter: id === "Active" ? undefined : id, page: undefined }); }}/> : null}
      {/* Last in the bar, apart from the filters: it takes no rows out (OT1-C). */}
      <SortMenu columns={columns} sort={sort} onSortChange={pagination.setSort}/>
    </div></FilterBar>
    <div className="flex flex-col gap-4">
      {!pendingOnly && state === "Active" && !!data?.filterCounts.deactivatedPending ? <Banner action={<Button variant="outline" aria-label={t("overview.viewDeactivated")} onClick={() => update({ publicationFilter: "Deactivated", page: undefined })}>{t("common:actions.view")}</Button>}>{t("overview.deactivatedPending", { count: data.filterCounts.deactivatedPending })}</Banner> : null}
      {/* Searching, filtering or paginating keeps the previous rows dimmed under a running line (board LC2-A), as does
          Reintentar after a failed read with rows in sight; without rows it goes back to the first load's spinner. */}
      <Surface><DataTable columns={columns} rows={data?.forms.items ?? []} rowKey={row => row.id}
        isLoading={query.isPending} refreshing={query.isPlaceholderData || query.isError && query.isFetching} hasData={!!data} error={query.error ? t("loadFailed") : undefined} onRetry={() => void query.refetch()}
        emptyTitle={t(emptyTitle)} sort={sort} onSortChange={pagination.toggleSort}/>
        {data ? <Pagination {...data.forms} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}/> : null}
      </Surface>
    </div>
  </Page>;
}
