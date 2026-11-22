import type { CatalogValueType } from "../catalogValues";
import type { CatalogKind } from "../api/catalogResponse";
import { catalogOriginKey } from "../catalogOrigin";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { PagedResult } from "@/shared/api/pagedResult";
import { Button } from "@/shared/ui/button";
import { DataTable, type Column, type SortKind } from "@/shared/ui/DataTable";
import { AlertTriangleIcon, FolderIcon, PencilIcon } from "@/shared/ui/icons";
import { Pagination } from "@/shared/ui/Pagination";
import { RowActions } from "@/shared/ui/RowActions";
import { Surface } from "@/shared/ui/Surface";

// Presentation only: the HTTP adapter supplies authorized, localized rows and server counts.
export interface CatalogListRow {
  id: string;
  name: string;
  description: string | null;
  origin: CatalogKind;
  valueType: CatalogValueType;
  optionsCount: number | null;
  usageCount: number | null;
  state: "Active" | "Inactive" | "Unavailable";
  stateReason: string | null;
  canEdit: boolean;
}

export function CatalogListTable({ page, canManage, loading, refreshing = false, error, onRetry, onPageChange, onPageSizeChange, onViewUsage, onEdit, onFolders, hasFilters, emptyTitle, emptyAction, sort, onSortChange }: {
  page?: PagedResult<CatalogListRow>;
  canManage: boolean;
  loading?: boolean;
  /** Another search, filter, order or page is being read: the rows on sight dim until it arrives (LC2-A). */
  refreshing?: boolean;
  error?: string;
  onRetry?: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onViewUsage: (id: string) => void;
  onEdit: (id: string) => void;
  /** «Carpetas…» of the row (CP2-A), for whoever manages catalogs. */
  onFolders?: (row: CatalogListRow) => void;
  hasFilters: boolean;
  /** The empty title of the listing inside a folder (CP4), instead of the general one. */
  emptyTitle?: string;
  emptyAction?: ReactNode;
  sort?: string;
  onSortChange?: (field: string, kind: SortKind) => void;
}) {
  const { t } = useTranslation(["forms", "formFolders"]);
  const columns: Column<CatalogListRow>[] = [
    { id: "name", header: t("catalogs.columns.name"), sortable: true, sortKind: "text", cell: row => <Link to={"/catalogos/" + row.id} className="font-medium text-[var(--color-brand-700)] underline-offset-2 hover:underline">{row.name}</Link> },
    // One value: «Usuarios, con filtros» is the same in every catalog of the base and does not tell one row from another (UD3).
    { sortable: false, id: "origin", header: t("catalogs.columns.origin"), cell: row => t(catalogOriginKey(row.origin)) },
    { sortable: false, id: "optionsCount", header: t("catalogs.columns.options"), numeric: true, cell: row => row.optionsCount ?? "—" },
    { sortable: false, id: "usageCount", header: t("catalogs.columns.usage"), cell: row => row.usageCount !== null && row.usageCount > 0
      ? <Button type="button" variant="link" aria-label={t("catalogs.viewUsage", { name: row.name })} onClick={() => onViewUsage(row.id)}>{t("catalogs.usage", { count: row.usageCount })}</Button> : "—" },
    { sortable: false, id: "state", header: t("catalogs.columns.state"), cell: row => <div>
      <p className={row.state === "Unavailable" ? "flex items-center gap-1 text-[var(--color-danger)]" : "flex items-center gap-1"}>{row.state === "Unavailable" ? <AlertTriangleIcon className="size-4 shrink-0" /> : <span aria-hidden="true" className={row.state === "Active" ? "inline-block size-2 shrink-0 rounded-full bg-[var(--color-success)]" : "inline-block size-2 shrink-0 rounded-full border border-[var(--color-content-muted)]"} />}{t("catalogs.state." + row.state)}</p>
      {row.stateReason ? <p className="text-xs text-[var(--color-content-muted)]">{row.stateReason}</p> : null}
    </div> },
    { sortable: false, id: "actions", header: t("actionsColumn"), align: "right", cell: row => <RowActions actions={[{
      label: t("edit"), accessibleName: t("catalogs.editNamed", { name: row.name }), icon: PencilIcon,
      // An External catalog is kept by its module and opens read-only from its name: there is nothing to edit.
      hidden: !canManage || !row.canEdit || row.origin === "External", onSelect: () => onEdit(row.id),
    }, {
      label: t("formFolders:item.action"), accessibleName: t("formFolders:item.actionFor", { name: row.name }), icon: FolderIcon,
      hidden: !canManage || !onFolders, onSelect: () => onFolders?.(row),
    }]} /> },
  ];
  return <Surface>
    {/* The empty states keep their title and their way out (a new catalog, or clearing the filters), without a description. */}
    <DataTable columns={columns} rows={page?.items ?? []} hasData={page !== undefined} rowKey={row => row.id} isLoading={loading && !page} refreshing={refreshing} error={error} onRetry={onRetry}
      emptyTitle={emptyTitle ?? t(hasFilters ? "catalogs.noMatches" : "catalogs.emptyTitle")} emptyAction={emptyAction} sort={sort} onSortChange={onSortChange} />
    {page ? <Pagination {...page} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} /> : null}
  </Surface>;
}
