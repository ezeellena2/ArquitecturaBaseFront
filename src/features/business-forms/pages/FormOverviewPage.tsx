import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/auth/usePermissions";
import { useSystemPresentation } from "@/shared/api/presentation";
import { usePagination } from "@/shared/hooks/usePagination";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Banner } from "@/shared/ui/Banner";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { FilterBar } from "@/shared/ui/FilterBar";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { Pagination } from "@/shared/ui/Pagination";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Surface } from "@/shared/ui/Surface";
import type { FormOverviewRow } from "../api/overview";
import { approvalStateVariant } from "../approvals";
import { useFormOverview } from "../hooks/useFormOverview";
import { useResponseFeedback } from "../hooks/useResponseQueries";

export function FormOverviewPage() {
  const { t, i18n } = useTranslation("forms");
  const [params] = useSearchParams();
  const update = useQueryUpdate();
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true);
  const state = params.get("state") === "Deactivated" ? "Deactivated" : "Active";
  // The server owns the row set; a shared URL cannot grant decision filters.
  const { has } = usePermissions();
  const both = has("formrecords.read") && has("formapprovals.decide");
  const pendingOnly = both && params.get("pendingOnly") === "true";
  const { scope, query, forbidden } = useFormOverview({ page: pagination.page, pageSize: pagination.pageSize,
    search: pagination.search, state, pendingOnly }, pagination.ready);
  useResponseFeedback(query.error, "forms:overview:" + scope.owner, query.refetch);
  if (!scope.allowed || forbidden) return <ForbiddenPage/>;
  const data = query.data;
  const formPath = (id: string) => "/formularios/" + id + "/respuestas";
  const columns: Column<FormOverviewRow>[] = [
    { id: "name", header: t("formColumn"), cell: row => <Link to={formPath(row.id)} className="font-medium text-[var(--color-brand-700)] underline">{row.name}</Link> },
    ...(scope.canDecide ? [{ id: "pending", header: t("overview.pendingColumn"), cell: (row: FormOverviewRow) => row.pendingApprovalCount ? <Link to={formPath(row.id)} aria-label={t("overview.pendingFor", { name: row.name, count: row.pendingApprovalCount })}><Badge variant="warning">{row.pendingApprovalCount}</Badge></Link> : "—" }] : []),
    ...(scope.canRead ? [
      { id: "responses", header: t("overview.responses"), cell: (row: FormOverviewRow) => row.responseCount ?? "—" },
      { id: "lastResponse", header: t("overview.lastResponse"), cell: (row: FormOverviewRow) => row.lastResponse ? <div className="inline-flex items-center gap-2 whitespace-nowrap"><Link to={formPath(row.id) + "/" + row.lastResponse.id} className="font-medium text-[var(--color-brand-700)] underline">{row.lastResponse.number}</Link><time className="text-xs text-[var(--color-content-muted)]" dateTime={row.lastResponse.submittedAtUtc}>{formatDateTimeInZone(row.lastResponse.submittedAtUtc, i18n.language, scope.user?.timeZoneId)}</time><Badge variant={approvalStateVariant(row.lastResponse.state)}>{t("approvals.states." + row.lastResponse.state)}</Badge></div> : <span className="text-sm text-[var(--color-content-muted)]">{t("overview.noResponses")}</span> },
    ] : []),
  ];
  return <Page title={t("overview.title")}>
    <FilterBar><div className="flex flex-wrap items-center gap-3"><div className="w-full sm:w-72"><SearchInput maxLength={100} label={t("overview.search")} value={pagination.search ?? ""} onChange={pagination.setSearch}/></div><div className="max-w-full overflow-x-auto">
      <SegmentedControl aria-label={t("overview.state")} options={[
        { key: "Active", label: t("active") + " (" + (data?.filterCounts.active ?? "—") + ")", pressed: state === "Active", onSelect: () => update({ state: undefined, page: undefined }) },
        { key: "Deactivated", label: t("deactivated") + " (" + (data?.filterCounts.deactivated ?? "—") + ")", pressed: state === "Deactivated", onSelect: () => update({ state: "Deactivated", page: undefined }) },
      ]}/></div>
      {both ? <CheckboxField label={t("overview.pendingOnly")} checked={pendingOnly} onCheckedChange={checked => update({ pendingOnly: checked ? "true" : undefined, page: undefined })}/> : null}
    </div></FilterBar>
    <div className="flex flex-col gap-4">
      {state === "Deactivated" ? <Banner>{t("overview.deactivatedHint")}</Banner> : null}
      {state === "Active" && !!data?.filterCounts.deactivatedPending ? <Banner action={<Button variant="outline" aria-label={t("overview.viewDeactivated")} onClick={() => update({ state: "Deactivated", pendingOnly: undefined, page: undefined })}>{t("common:actions.view")}</Button>}>{t("overview.deactivatedPending", { count: data.filterCounts.deactivatedPending })}</Banner> : null}
      <Surface><DataTable columns={columns} rows={data?.forms.items ?? []} rowKey={row => row.id}
        isLoading={query.isPending} hasData={!!data} error={query.error ? t("loadFailed") : undefined} onRetry={() => void query.refetch()}
        emptyTitle={t(pagination.search || pendingOnly ? "noMatches" : "responses.noForms")} emptyDescription={t("responses.noFormsHint")}/>
        {data ? <Pagination {...data.forms} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}/> : null}
      </Surface>
    </div>
  </Page>;
}
