import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useSystemPresentation } from "@/shared/api/presentation";
import { usePagination } from "@/shared/hooks/usePagination";
import { Button } from "@/shared/ui/button";
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

const sortFields = ["name", "-name", "kind", "-kind", "revision", "-revision", "optionsCount", "-optionsCount", "usageCount", "-usageCount"] as const;
export function CatalogsPage() {
  const { t, i18n } = useTranslation("forms");
  const { data: user } = useCurrentUser();
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true);
  const navigate = useNavigate();
  const [choosingOrigin, setChoosingOrigin] = useState(false);
  const scope: CatalogReadScope = { actorId: pagination.ready ? user?.id ?? null : null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
  const query: CatalogListQuery = { page: pagination.page, pageSize: pagination.pageSize, search: pagination.search, sort: sortFields.find(field => field === pagination.sort) };
  const list = useCatalogPage(scope, query);
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
    <FilterBar><div className="w-full sm:w-72"><SearchInput value={query.search ?? ""} onChange={pagination.setSearch} label={t("catalogs.search")} /></div></FilterBar>
    <CatalogListTable page={list.data} canManage={canManage} loading={list.isPending} error={list.error ? t("catalogs.loadFailed") : undefined}
      onRetry={() => { void list.refetch(); }} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}
      sort={query.sort} onSortChange={pagination.toggleSort} hasFilters={!!query.search}
      emptyAction={query.search ? <Button type="button" variant="outline" onClick={() => pagination.setSearch("")}>{t("clearFilters")}</Button> : newAction}
      onEdit={id => { void navigate("/catalogos/" + id); }} onViewUsage={id => { void navigate("/catalogos/" + id); }} />
    {choosingOrigin && canManage ? <CatalogOriginDialog filtersAvailable={false} onOpenChange={setChoosingOrigin} onSelect={() => { void navigate("/catalogos/nuevo"); }} /> : null}
  </Page>;
}
