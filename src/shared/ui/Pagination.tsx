import { useTranslation } from "react-i18next";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { IconButton } from "./IconButton";
import type { PagedResult } from "@/shared/api/pagedResult";

type PaginationProps = Pick<
  PagedResult<unknown>,
  "page" | "pageSize" | "totalCount" | "totalPages" | "hasPrevious" | "hasNext"
> & { onPageChange: (page: number) => void };

/// Pie de un listado paginado, adentro de la misma caja que la tabla: el rango a la izquierda y el paso de
/// página a la derecha. Los números salen del PagedResult del backend.
///
/// Las flechas van como íconos y no como botones con texto: dicen lo mismo en un tercio del lugar y no
/// cambian de ancho al traducirse. El nombre completo ("Página anterior") lo lleva el `aria-label`, que es
/// también el que se ve al pasar por encima.
export function Pagination({ page, pageSize, totalCount, totalPages, hasPrevious, hasNext, onPageChange }: PaginationProps) {
  const { t } = useTranslation();
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <nav
      className="flex h-12 items-center justify-between gap-3 px-4 text-[13px] text-[var(--color-content-muted)]"
      aria-label={t("pagination.label")}
    >
      <p>{t("pagination.range", { from, to, total: totalCount })}</p>
      <div className="flex items-center gap-1">
        <IconButton
          label={t("pagination.previous")}
          size="icon-sm"
          disabled={!hasPrevious}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon className="size-4" />
        </IconButton>
        <span className="tabular-nums">{t("pagination.page", { page, totalPages })}</span>
        <IconButton
          label={t("pagination.next")}
          size="icon-sm"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRightIcon className="size-4" />
        </IconButton>
      </div>
    </nav>
  );
}
