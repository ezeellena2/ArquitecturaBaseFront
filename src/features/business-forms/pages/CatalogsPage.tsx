import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useSystemPresentation } from "@/shared/api/presentation";
import { useFilters } from "@/shared/hooks/useFilters";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { usePagination } from "@/shared/hooks/usePagination";
import { Button } from "@/shared/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "@/shared/ui/dropdown-menu";
import { FilterMenuTrigger } from "@/shared/ui/FilterMenuTrigger";
import { ChevronDownIcon } from "@/shared/ui/icons";
import { FilterBar } from "@/shared/ui/FilterBar";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { SearchInput } from "@/shared/ui/SearchInput";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import type { CatalogListQuery } from "../api/catalogs";
import { CatalogListTable } from "../components/CatalogListTable";
import { CatalogOriginDialog } from "../components/CatalogOriginDialog";
import { useCatalogPage } from "../hooks/useCatalogQueries";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";

const filterKeys = ["kind", "state"] as const;
const catalogStates = ["Active", "Inactive", "Unavailable"] as const;
const sortFields = ["name", "-name", "kind", "-kind", "revision", "-revision", "optionsCount", "-optionsCount", "usageCount", "-usageCount"] as const;
export function CatalogsPage() {
  const { t, i18n } = useTranslation("forms");
  const { data: user } = useCurrentUser();
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true);
  const navigate = useNavigate();
  const filters = useFilters(filterKeys);
  const state = catalogStates.find(value => value === filters.values.state);
  const kind = filters.values.kind === "Manual" || filters.values.kind === "Filters" ? filters.values.kind : undefined;
  const [choosingOrigin, setChoosingOrigin] = useState(false);
  const scope: CatalogReadScope = { actorId: pagination.ready ? user?.id ?? null : null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
  const query: CatalogListQuery = { page: pagination.page, pageSize: pagination.pageSize, search: pagination.search, sort: sortFields.find(field => field === pagination.sort), kind, state };
  const list = useCatalogPage(scope, query);
  const hasFilters = !!query.search || kind !== undefined || state !== undefined;
  const visiblePage = list.data ? { ...list.data, items: list.data.items.map(row => ({ ...row, stateReason: row.state === "Unavailable" && row.stateReason ? t("catalogs.unavailableReason") : null })) } : undefined;
  const canManage = !!user?.permissions.includes("formcatalogs.manage");
  const feedbackId = `catalogs:list:${scope.actorId}:${scope.culture}`;
  useEffect(() => () => { dismissNotification(feedbackId); }, [feedbackId]);
  useEffect(() => {
    if (!list.error) { dismissNotification(feedbackId); return; }
    if (["cancelled", "session", "forbidden"].includes(errorFeedback(list.error).kind)) return;
    notify({ id: feedbackId, kind: "error", message: readErrorMessage(list.error, t) });
  }, [list.error, list.data, feedbackId, t]);
  if (!user?.permissions.includes("formcatalogs.read") || (list.error instanceof ApiError && list.error.status === 403)) return <ForbiddenPage />;
  const newAction = canManage ? <Button type="button" onClick={() => setChoosingOrigin(true)}>{t("catalogs.new")}</Button> : undefined;
  return <Page title={t("catalogs.title")} actions={newAction}>
    <FilterBar><div className="flex flex-wrap items-center gap-3"><div className="w-full sm:w-72"><SearchInput value={query.search ?? ""} onChange={pagination.setSearch} label={t("catalogs.search")} /></div><div className="max-w-full overflow-x-auto"><SegmentedControl aria-label={t("catalogs.columns.origin")} options={(["All", "Manual", "Filters"] as const).map(key => ({ key,
      label: `${t(key === "All" ? "all" : key === "Manual" ? "catalogs.source.manual" : "catalogs.source.database")} (${list.data?.filterCounts.byKind[key === "All" ? "all" : key === "Manual" ? "manual" : "filters"] ?? "…"})`,
      pressed: (kind ?? "All") === key, onSelect: () => filters.setFilter("kind", key === "All" ? undefined : key) }))} /></div><DropdownMenu><FilterMenuTrigger>{t("catalogs.stateFilter", { state: state ? t("catalogs.state." + state) : t("all") })}<ChevronDownIcon aria-hidden="true" className="size-3.5" /></FilterMenuTrigger><DropdownMenuContent align="start">{([undefined, ...catalogStates] as const).map(value => <DropdownMenuItem key={value ?? "All"} onSelect={() => filters.setFilter("state", value)}>{value ? t("catalogs.state." + value) : t("all")}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu></div></FilterBar>
    <CatalogListTable page={visiblePage} canManage={canManage} loading={list.isPending} error={list.error ? t("catalogs.loadFailed") : undefined}
      onRetry={() => { void list.refetch(); }} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
      sort={query.sort} onSortChange={pagination.toggleSort} hasFilters={hasFilters}
      emptyAction={hasFilters ? <Button type="button" variant="outline" onClick={filters.clear}>{t("clearFilters")}</Button> : newAction}
      onEdit={id => { void navigate("/catalogos/" + id); }} onViewUsage={id => { void navigate("/catalogos/" + id); }} />
    {choosingOrigin && canManage ? <CatalogOriginDialog onOpenChange={setChoosingOrigin} onSelect={(origin, valueType) => { void navigate(origin === "Filters" ? "/catalogos/nuevo?kind=Filters" : "/catalogos/nuevo" + (valueType === "Text" ? "" : "?valueType=" + valueType)); }} /> : null}
  </Page>;
}
