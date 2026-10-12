import { useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Pagination } from "@/shared/ui/Pagination";
import { SearchInput } from "@/shared/ui/SearchInput";
import { Spinner } from "@/shared/ui/Spinner";
import { useCatalogDetail, useCatalogPage } from "../hooks/useCatalogQueries";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";

export function CatalogQuestionSelector({ scope, value, readOnly, error, onChange }: { scope: CatalogReadScope; value: string; readOnly: boolean; error?: string; onChange: (id: string) => void }) {
  const { t } = useTranslation("forms");
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
  const query = { page, pageSize: 20, sort: "name" as const, search };
  const list = useCatalogPage(scope, query, "global");
  const rows = list.data?.items ?? [];
  const currentRow = rows.find(row => row.id === value);
  const detailId = value && list.data && !currentRow ? value : "";
  const detail = useCatalogDetail(scope, detailId, "global");
  const failure = list.error ?? detail.error;
  const canRead = !!scope.actorId && scope.permissions.includes("formcatalogs.read") && !(failure instanceof ApiError && failure.status === 403);
  const reason = (state: string, code: string | null) => code === "Forms.Catalog.SourceUnavailable" ? t("catalogs.filters.unavailable") : t("catalogs.state." + state);
  const label = (name: string, origin: string, count: number | null, state: string, code: string | null) => [name, t("catalogs.source." + (origin === "Manual" ? "manual" : "database")), count === null ? null : t("catalogs.filters.result", { count }), state === "Active" ? null : reason(state, code)].filter(Boolean).join(" · ");
  const selected = currentRow ?? detail.data;
  const selectedName = currentRow?.name ?? detail.data?.name[scope.culture] ?? t("catalogQuestion.selected");
  const selectedDescription = currentRow?.description ?? detail.data?.description[scope.culture];
  const detailState = detail.data?.unavailableReasonCode ? "Unavailable" : detail.data?.isActive ? "Active" : "Inactive";
  return <div className="flex flex-col gap-3">
    <FormField label={t("catalogQuestion.catalog")} required error={error} hint={!canRead ? t("catalogQuestion.requiresRead") : selectedDescription ?? t("catalogQuestion.hint")}>
      <NativeSelect data-question-control="catalog" value={canRead ? value : ""} disabled={readOnly || !canRead || list.isPending} onChange={event => {
        if (readOnly || !canRead) return;
        if (rows.some(row => row.id === event.target.value && row.state === "Active")) onChange(event.target.value);
      }}><option value="" disabled>{t("select")}</option>
        {canRead && value && !currentRow ? <option value={value} disabled={!detail.data || detailState !== "Active"}>{detail.data ? label(selectedName, detail.data.kind, null, detailState, detail.data.unavailableReasonCode) : selectedName}</option> : null}
        {canRead ? rows.map(row => <option key={row.id} value={row.id} disabled={row.state !== "Active"}>{label(row.name, row.origin, row.optionsCount, row.state, row.stateReason)}</option>) : null}
      </NativeSelect>
    </FormField>
    {canRead && !readOnly ? <SearchInput value={search} label={t("catalogQuestion.search")} onChange={next => { setSearch(next); setPage(1); }} /> : null}
    {canRead && list.isPending ? <Spinner /> : null}
    {canRead && failure ? <div><Button type="button" variant="outline" onClick={() => { void list.refetch(); if (detailId) void detail.refetch(); }}>{t("common:actions.retry")}</Button></div> : null}
    {canRead && list.data && !readOnly ? <Pagination {...list.data} onPageChange={setPage} /> : null}
    {canRead && list.data && !rows.length && !failure ? <EmptyState embedded title={t("catalogQuestion.empty")} /> : null}
    {canRead && selected ? <div><Button type="button" variant="link" asChild><Link to={"/catalogos/" + value}>{t("catalogQuestion.view")}</Link></Button></div> : null}
  </div>;
}
