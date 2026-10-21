import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
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
import { BanIcon, PencilIcon, RefreshIcon, TrashIcon } from "@/shared/ui/icons";
import { RowActions } from "@/shared/ui/RowActions";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { formActorKey, formScopeKey, useFormDefinitions, type FormReadScope } from "../hooks/useFormQueries";
import { deprecationMessage } from "../lifecyclePresentation";
import { publicationLabelKey } from "../publicationPresentation";
import { administrativeName } from "../editorModel";
import { FormDeletionDialog } from "../components/FormDeletionDialog";
import { FormDeactivationDialog } from "../components/FormDeactivationDialog";
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
  const client = useQueryClient();
  const host = useRef<HTMLDivElement>(null);
  const focusFallback = useRef<HTMLElement | null>(null);
  const [action, setAction] = useState<{ row: Row; owner: string; kind: "deactivate" | "delete" } | null>(null);
  const filter = params.get("publicationFilter");
  const publicationFilter = filter === "Published" || filter === "Drafts" || filter === "Deactivated" ? filter : "Active";
  const scope: FormReadScope = { actorId: pagination.ready ? user?.id ?? null : null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
  const query: FormListQuery = { page: Number.isSafeInteger(pagination.page) && pagination.page > 0 ? pagination.page : 1,
    pageSize: Number.isSafeInteger(pagination.pageSize) && pagination.pageSize >= 1 && pagination.pageSize <= 100 ? pagination.pageSize : presentation.data?.defaultPageSize ?? 20,
    search: pagination.search, sort: sortFields.find(field => field === pagination.sort), publicationFilter };
  const { list, facets } = useFormDefinitions(scope, query);
  const actionOwner = JSON.stringify(formScopeKey(scope));
  if (action && action.owner !== actionOwner) setAction(null);
  const canManage = !!user?.permissions.includes("formtemplates.manage");
  const hasFilters = !!query.search || publicationFilter !== "Active";
  const feedbackId = `forms:list:${scope.actorId}:${scope.culture}`;
  useEffect(() => () => { dismissNotification(feedbackId); }, [feedbackId]);
  useEffect(() => {
    const error = list.error ?? facets.error;
    if (!error) { dismissNotification(feedbackId); return; }
    if (["cancelled", "session", "forbidden"].includes(errorFeedback(error).kind)) return;
    notify({ id: feedbackId, kind: "error", message: readErrorMessage(error, t) });
  }, [list.error, facets.error, list.data, feedbackId, t]);
  if (!user?.permissions.includes("formtemplates.read") || [list.error, facets.error].some(error => error instanceof ApiError && error.status === 403)) return <ForbiddenPage />;
  const clearFilters = () => update({ search: undefined, publicationFilter: undefined, page: undefined });
  const canPublish = scope.permissions.includes("formtemplates.publish");
  const chooseAction = (row: Row, kind: "deactivate" | "delete") => { focusFallback.current = host.current?.querySelector<HTMLInputElement>("input") ?? null; setAction({ row, kind, owner: JSON.stringify(formScopeKey(scope)) }); };
  const refresh = async () => { await client.invalidateQueries({ queryKey: formActorKey(scope.actorId) }); };
  const columns: Column<Row>[] = [
    { id: "name", header: t("formColumn"), sortable: true, cell: row => <Link to={`/formularios/${row.id}`} className="font-medium text-[var(--color-brand-700)] underline-offset-2 hover:underline">{administrativeName(row.name, scope.culture)}</Link> },
    { id: "questionCount", header: t("countColumn"), sortable: true, cell: row => row.questionCount },
    { id: "displayState", header: t("stateColumn"), cell: row => { const channel = row.lifecycle.deactivatedAtUtc ? deprecationMessage(row.lifecycle, t, scope.culture, user?.timeZoneId) : null; return <div><p>{row.lifecycle.deactivatedAtUtc ? t(row.activeVersionNumber === null ? "lifecycle.stateWithoutVersion" : "lifecycle.state", { version: row.activeVersionNumber }) : t(publicationLabelKey(row.displayState, true), { version: row.activeVersionNumber })}</p>{row.lifecycle.deactivatedAtUtc && row.lifecycle.unavailableReason === "PublicationInProgress" ? <p className="text-xs text-[var(--color-content-muted)]">{t("lifecycle.reactivating")}</p> : null}{!row.lifecycle.deactivatedAtUtc && row.activeVersionNumber !== null && row.displayState !== "Published" ? <p className="text-xs text-[var(--color-content-muted)]">{t("publication.previousActive", { version: row.activeVersionNumber })}</p> : null}{channel ? <p className="max-w-64 whitespace-normal text-xs text-[var(--color-content-muted)]">{channel}</p> : null}</div>; } },
    { id: "responseCount", header: t("responseCountColumn"), align: "right", cell: row => row.lifecycle.responseCount ?? "—" },
    { id: "lastChangedAtUtc", header: t("changedColumn"), sortable: true, cell: row => `${formatDateInZone(row.lastChangedAtUtc, i18n.language, user?.timeZoneId)} · ${row.lastChangedBy?.displayName ?? "—"}` },
    { id: "actions", header: t("actionsColumn"), align: "right", cell: row => <RowActions actions={[{ hidden: !canManage || !row.canEdit, label: t("edit"), accessibleName: `${t("edit")} ${administrativeName(row.name, scope.culture)}`, icon: PencilIcon, onSelect: () => { void navigate(`/formularios/${row.id}`); } }, { hidden: !canPublish || !row.lifecycle.canDeactivate, label: t("lifecycle.deactivate"), accessibleName: t("lifecycle.deactivate") + " " + administrativeName(row.name, scope.culture), icon: BanIcon, onSelect: () => chooseAction(row, "deactivate") }, { hidden: !canPublish || !row.lifecycle.canReactivate, label: t("lifecycle.reactivate"), accessibleName: t("lifecycle.reactivate") + " " + administrativeName(row.name, scope.culture), icon: RefreshIcon, onSelect: () => { void navigate("/formularios/" + row.id, { state: { reactivateFormId: row.id } }); } }, { hidden: !canManage || !row.lifecycle.canDelete || row.lifecycle.deletionUnavailableReason === "HasResponses" || row.lifecycle.responseCount !== null && row.lifecycle.responseCount > 0, label: t("lifecycle.delete"), accessibleName: t("lifecycle.delete") + " " + administrativeName(row.name, scope.culture), icon: TrashIcon, destructive: true, onSelect: () => chooseAction(row, "delete") }]} /> },
  ];
  return <div ref={host}><Page title={t("title")} actions={canManage ? <Button asChild><Link to="/formularios/nuevo">{t("new")}</Link></Button> : undefined}>
    <FilterBar><div className="flex flex-wrap items-center gap-3"><div className="w-full sm:w-72"><SearchInput value={query.search ?? ""} onChange={pagination.setSearch} label={t("search")} /></div><div className="max-w-full overflow-x-auto"><SegmentedControl aria-label={t("filter")} options={(["Active", "Published", "Drafts", "Deactivated"] as const).map(key => ({ key, label: `${t(key === "Active" ? "active" : key === "Published" ? "published" : key === "Drafts" ? "drafts" : "deactivated")} (${facets.data?.[key === "Active" ? "active" : key === "Published" ? "published" : key === "Drafts" ? "drafts" : "deactivated"] ?? "…"})`, pressed: publicationFilter === key, onSelect: () => update({ publicationFilter: key === "Active" ? undefined : key, page: undefined }) }))} /></div></div></FilterBar>
    <Surface><DataTable columns={columns} rows={list.data?.items ?? []} hasData={list.data !== undefined} rowKey={row => row.id} isLoading={list.isPending} error={list.error ? t("loadFailed") : undefined} onRetry={() => { void list.refetch(); void facets.refetch(); }} sort={query.sort} onSortChange={pagination.toggleSort}
      emptyTitle={t(hasFilters ? "noMatches" : "emptyTitle")} emptyDescription={t(hasFilters ? "noMatchesDescription" : "emptyDescription")} emptyAction={hasFilters ? <Button type="button" variant="outline" onClick={clearFilters}>{t("clearFilters")}</Button> : canManage ? <Button asChild><Link to="/formularios/nuevo">{t("new")}</Link></Button> : undefined} />
      {list.data ? <Pagination {...list.data} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} /> : null}
    </Surface>
  </Page>{canPublish && action?.owner === actionOwner && action.kind === "deactivate" ? <FormDeactivationDialog key={action.row.id} id={action.row.id} name={administrativeName(action.row.name, scope.culture)} scope={scope} onComplete={refresh} onClose={() => setAction(null)} focusFallback={focusFallback} timeZoneId={user?.timeZoneId} /> : canManage && action?.owner === actionOwner && action.kind === "delete" ? <FormDeletionDialog id={action.row.id} name={administrativeName(action.row.name, scope.culture)} revision={action.row.lifecycle.revision} scope={scope} onChanged={() => { void refresh(); }} onDeleted={async () => { client.removeQueries({ queryKey: [...formScopeKey(scope), "detail", action.row.id] }); await refresh(); }} onClose={() => setAction(null)} focusFallback={focusFallback} /> : null}</div>;
}
