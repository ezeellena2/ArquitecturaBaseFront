import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useSystemPresentation } from "@/shared/api/presentation";
import { usePagination } from "@/shared/hooks/usePagination";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { formatDateInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { FilterBar } from "@/shared/ui/FilterBar";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { Pagination } from "@/shared/ui/Pagination";
import { PencilIcon } from "@/shared/ui/icons";
import { RowActions } from "@/shared/ui/RowActions";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { useFormDefinitions, type FormReadScope } from "../hooks/useFormQueries";
import { publicationLabelKey } from "../publicationPresentation";
import { administrativeName } from "../editorModel";
import type { FormListQuery } from "../api/forms";
import type { readFormPage } from "../api/response";

const sortFields = ["name", "-name", "questionCount", "-questionCount", "lastChangedAtUtc", "-lastChangedAtUtc"] as const;
type Row = ReturnType<typeof readFormPage>["items"][number];
export function FormsPage() {
  const { t, i18n } = useTranslation("forms");
  const { data: user } = useCurrentUser();
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true);
  const [params] = useSearchParams();
  const update = useQueryUpdate();
  const navigate = useNavigate();
  const filter = params.get("publicationFilter");
  const publicationFilter = filter === "Published" || filter === "Drafts" ? filter : "All";
  const scope: FormReadScope = { actorId: pagination.ready ? user?.id ?? null : null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
  const query: FormListQuery = { page: Number.isSafeInteger(pagination.page) && pagination.page > 0 ? pagination.page : 1,
    pageSize: Number.isSafeInteger(pagination.pageSize) && pagination.pageSize >= 1 && pagination.pageSize <= 100 ? pagination.pageSize : presentation.data?.defaultPageSize ?? 20,
    search: pagination.search, sort: sortFields.find(field => field === pagination.sort), publicationFilter };
  const { list, facets } = useFormDefinitions(scope, query);
  const canManage = !!user?.permissions.includes("formtemplates.manage");
  const hasFilters = !!query.search || publicationFilter !== "All";
  const feedbackId = `forms:list:${scope.actorId}:${scope.culture}`;
  useEffect(() => () => { dismissNotification(feedbackId); }, [feedbackId]);
  useEffect(() => {
    const error = list.error ?? facets.error;
    if (!error) { dismissNotification(feedbackId); return; }
    if (["cancelled", "session", "forbidden"].includes(errorFeedback(error).kind)) return;
    notify({ id: feedbackId, kind: "error", message: t(list.data ? "refreshFailed" : "loadFailed") });
  }, [list.error, facets.error, list.data, feedbackId, t]);
  if (!user?.permissions.includes("formtemplates.read") || [list.error, facets.error].some(error => error instanceof ApiError && error.status === 403)) return <ForbiddenPage />;
  const clearFilters = () => update({ search: undefined, publicationFilter: undefined, page: undefined });
  const columns: Column<Row>[] = [
    { id: "name", header: t("formColumn"), sortable: true, cell: row => <Link to={`/formularios/${row.id}`} className="font-medium text-[var(--color-brand-700)] underline-offset-2 hover:underline">{administrativeName(row.name, scope.culture)}</Link> },
    { id: "questionCount", header: t("countColumn"), sortable: true, cell: row => row.questionCount },
    { id: "displayState", header: t("stateColumn"), cell: row => <div><p>{t(publicationLabelKey(row.displayState, true))}</p>{row.activeVersionNumber !== null && row.displayState !== "Published" ? <p className="text-xs text-[var(--color-content-muted)]">{t("publication.previousActive", { version: row.activeVersionNumber })}</p> : null}</div> },
    { id: "lastChangedAtUtc", header: t("changedColumn"), sortable: true, cell: row => `${formatDateInZone(row.lastChangedAtUtc, i18n.language, user?.timeZoneId)} · ${row.lastChangedBy?.displayName ?? "—"}` },
    { id: "actions", header: t("actionsColumn"), align: "right", cell: row => canManage && row.canEdit ? <RowActions actions={[{ label: t("edit"), accessibleName: `${t("edit")} ${administrativeName(row.name, scope.culture)}`, icon: PencilIcon, onSelect: () => { void navigate(`/formularios/${row.id}`); } }]} /> : null },
  ];
  return <Page title={t("title")} actions={canManage ? <Button asChild><Link to="/formularios/nuevo">{t("new")}</Link></Button> : undefined}>
    <FilterBar><div className="flex flex-wrap items-center gap-3"><div className="w-full sm:w-72"><SearchInput value={query.search ?? ""} onChange={pagination.setSearch} label={t("search")} /></div><div className="max-w-full overflow-x-auto"><SegmentedControl aria-label={t("filter")} options={(["All", "Published", "Drafts"] as const).map(key => ({ key, label: `${t(key === "All" ? "all" : key === "Published" ? "published" : "drafts")} (${facets.data?.[key === "All" ? "all" : key === "Published" ? "published" : "drafts"] ?? "…"})`, pressed: publicationFilter === key, onSelect: () => update({ publicationFilter: key === "All" ? undefined : key, page: undefined }) }))} /></div></div></FilterBar>
    <Surface><DataTable columns={columns} rows={list.data?.items ?? []} hasData={list.data !== undefined} rowKey={row => row.id} isLoading={list.isPending} error={list.error ? t("loadFailed") : undefined} onRetry={() => { void list.refetch(); void facets.refetch(); }} sort={query.sort} onSortChange={pagination.toggleSort}
      emptyTitle={t(hasFilters ? "noMatches" : "emptyTitle")} emptyDescription={t(hasFilters ? "noMatchesDescription" : "emptyDescription")} emptyAction={hasFilters ? <Button type="button" variant="outline" onClick={clearFilters}>{t("clearFilters")}</Button> : canManage ? <Button asChild><Link to="/formularios/nuevo">{t("new")}</Link></Button> : undefined} />
      {list.data ? <Pagination {...list.data} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /> : null}
    </Surface>
  </Page>;
}
