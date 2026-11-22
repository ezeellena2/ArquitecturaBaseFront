import type { CatalogValueType } from "../catalogValues";
import type { CatalogKind } from "../api/catalogResponse";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { PagedResult } from "@/shared/api/pagedResult";
import { DataTable, type SortKind } from "@/shared/ui/DataTable";
import { Pagination } from "@/shared/ui/Pagination";
import { Surface } from "@/shared/ui/Surface";
import { catalogListColumns, type CatalogListActions } from "./catalogListColumns";

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

export function CatalogListTable({ page, canManage, loading, refreshing = false, error, onRetry, onPageChange, onPageSizeChange, onViewUsage, onEdit, onFolders, hasFilters, emptyTitle, emptyAction, sort, onSortChange }: CatalogListActions & {
  page?: PagedResult<CatalogListRow>;
  loading?: boolean;
  /** Another search, filter, order or page is being read: the rows on sight dim until it arrives (LC2-A). */
  refreshing?: boolean;
  error?: string;
  onRetry?: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  hasFilters: boolean;
  /** The empty title of the listing inside a folder (CP4), instead of the general one. */
  emptyTitle?: string;
  emptyAction?: ReactNode;
  /** The order in sight: the chosen one or, without one, the server's usual one (the name). */
  sort?: string;
  onSortChange?: (field: string, kind: SortKind) => void;
}) {
  const { t } = useTranslation(["forms", "formFolders"]);
  const columns = catalogListColumns(t, { canManage, onViewUsage, onEdit, onFolders });
  return <Surface>
    {/* The empty states keep their title and their way out (a new catalog, or clearing the filters), without a description. */}
    <DataTable columns={columns} rows={page?.items ?? []} hasData={page !== undefined} rowKey={row => row.id} isLoading={loading && !page} refreshing={refreshing} error={error} onRetry={onRetry}
      emptyTitle={emptyTitle ?? t(hasFilters ? "catalogs.noMatches" : "catalogs.emptyTitle")} emptyAction={emptyAction} sort={sort} onSortChange={onSortChange} />
    {page ? <Pagination {...page} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange} /> : null}
  </Surface>;
}
