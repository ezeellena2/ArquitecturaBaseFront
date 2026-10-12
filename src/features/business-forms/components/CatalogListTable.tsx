import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { PagedResult } from "@/shared/api/pagedResult";
import { Button } from "@/shared/ui/button";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { AlertTriangleIcon, PencilIcon } from "@/shared/ui/icons";
import { Pagination } from "@/shared/ui/Pagination";
import { RowActions } from "@/shared/ui/RowActions";
import { Surface } from "@/shared/ui/Surface";

// Presentation only: the HTTP adapter supplies authorized, localized rows and server counts.
export interface CatalogListRow {
  id: string;
  name: string;
  description: string | null;
  origin: "Manual" | "Filters";
  optionsCount: number | null;
  usageCount: number;
  state: "Active" | "Inactive" | "Unavailable";
  stateReason: string | null;
  canEdit: boolean;
}

export function CatalogListTable({ page, canManage, loading, error, onRetry, onPageChange, onPageSizeChange, onViewUsage, onEdit, hasFilters, emptyAction, sort, onSortChange }: {
  page?: PagedResult<CatalogListRow>;
  canManage: boolean;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onViewUsage: (id: string) => void;
  onEdit: (id: string) => void;
  hasFilters: boolean;
  emptyAction?: ReactNode;
  sort?: string;
  onSortChange?: (field: string) => void;
}) {
  const { t } = useTranslation("forms");
  const columns: Column<CatalogListRow>[] = [
    { id: "name", header: t("catalogs.columns.name"), sortable: true, cell: row => <div>
      <Link to={"/catalogos/" + row.id} className="font-medium text-[var(--color-brand-700)] underline-offset-2 hover:underline">{row.name}</Link>
      {row.description ? <p className="text-xs text-[var(--color-content-muted)]">{row.description}</p> : null}
    </div> },
    { id: "origin", header: t("catalogs.columns.origin"), cell: row => <div><p>{t("catalogs.source." + (row.origin === "Manual" ? "manual" : "database"))}</p>
      {row.origin !== "Manual" ? <p className="text-xs text-[var(--color-content-muted)]">{t("catalogs.source.filters")}</p> : null}
    </div> },
    { id: "optionsCount", header: t("catalogs.columns.options"), cell: row => row.optionsCount ?? "—" },
    { id: "usageCount", header: t("catalogs.columns.usage"), cell: row => row.usageCount > 0
      ? <Button type="button" variant="link" aria-label={t("catalogs.viewUsage", { name: row.name })} onClick={() => onViewUsage(row.id)}>{t("catalogs.usage", { count: row.usageCount })}</Button> : "—" },
    { id: "state", header: t("catalogs.columns.state"), cell: row => <div>
      <p className={row.state === "Unavailable" ? "flex items-center gap-1 text-[var(--color-danger)]" : "flex items-center gap-1"}>{row.state === "Unavailable" ? <AlertTriangleIcon className="size-4 shrink-0" /> : <span aria-hidden="true" className={row.state === "Active" ? "inline-block size-2 shrink-0 rounded-full bg-[var(--color-success)]" : "inline-block size-2 shrink-0 rounded-full border border-[var(--color-content-muted)]"} />}{t("catalogs.state." + row.state)}</p>
      {row.stateReason ? <p className="text-xs text-[var(--color-content-muted)]">{row.stateReason}</p> : null}
    </div> },
    { id: "actions", header: t("actionsColumn"), align: "right", cell: row => <RowActions actions={[{
      label: t("edit"), accessibleName: t("catalogs.editNamed", { name: row.name }), icon: PencilIcon,
      hidden: !canManage || !row.canEdit, onSelect: () => onEdit(row.id),
    }]} /> },
  ];
  return <Surface>
    <DataTable columns={columns} rows={page?.items ?? []} hasData={page !== undefined} rowKey={row => row.id} isLoading={loading && !page} error={error} onRetry={onRetry}
      emptyTitle={t(hasFilters ? "catalogs.noMatches" : "catalogs.emptyTitle")} emptyDescription={t(hasFilters ? "catalogs.noMatchesDescription" : "catalogs.emptyDescription")}
      emptyAction={emptyAction} sort={sort} onSortChange={onSortChange} />
    {page ? <Pagination {...page} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} /> : null}
  </Surface>;
}
