import { useTranslation } from "react-i18next";
import { Button } from "./button";
import type { PagedResult } from "@/shared/api/pagedResult";

type PaginationProps = Pick<
  PagedResult<unknown>,
  "page" | "pageSize" | "totalCount" | "totalPages" | "hasPrevious" | "hasNext"
> & { onPageChange: (page: number) => void };

/// Navegación de un listado paginado. Los números salen del PagedResult del backend.
export function Pagination({ page, pageSize, totalCount, totalPages, hasPrevious, hasNext, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <nav className="mt-4 flex items-center justify-between gap-3" aria-label={t("pagination.label")}>
      <p className="text-sm text-[var(--color-content-muted)]">{t("pagination.range", { from, to, total: totalCount })}</p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={!hasPrevious} onClick={() => onPageChange(page - 1)}>
          {t("pagination.previous")}
        </Button>
        <span className="text-sm">{t("pagination.page", { page, totalPages })}</span>
        <Button type="button" variant="outline" size="sm" disabled={!hasNext} onClick={() => onPageChange(page + 1)}>
          {t("pagination.next")}
        </Button>
      </div>
    </nav>
  );
}
