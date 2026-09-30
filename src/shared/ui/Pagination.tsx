import { useTranslation } from "react-i18next";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";
import { IconButton } from "./IconButton";
import type { PagedResult } from "@/shared/api/pagedResult";
import { NativeSelect } from "./NativeSelect";

type PaginationProps = Pick<
  PagedResult<unknown>,
  "page" | "pageSize" | "totalCount" | "totalPages" | "hasPrevious" | "hasNext"
> & { onPageChange: (page: number) => void; onPageSizeChange?: (size: number) => void };

/// Pie de un listado paginado, adentro de la misma caja que la tabla: el rango a la izquierda y el paso de
/// página a la derecha. Los números salen del PagedResult del backend.
///
/// Las flechas van como íconos y no como botones con texto: dicen lo mismo en un tercio del lugar y no
/// cambian de ancho al traducirse. El nombre completo ("Página anterior") lo lleva el `aria-label`, que es
/// también el que se ve al pasar por encima.
export function Pagination({ page, pageSize, totalCount, totalPages, hasPrevious, hasNext, onPageChange, onPageSizeChange }: PaginationProps) {
  const { t } = useTranslation();
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <nav
      className="flex min-h-12 flex-wrap items-center justify-between gap-3 px-4 py-2 text-[13px] text-[var(--color-content-muted)]"
      aria-label={t("pagination.label")}
    >
      <div className="flex flex-wrap items-center gap-3"><p>{t("pagination.range", { from, to, total: totalCount })}</p>
      {onPageSizeChange ? <label className="flex items-center gap-2">{t("pagination.pageSize")}<NativeSelect className="w-20" value={pageSize} onChange={event => onPageSizeChange(Number(event.target.value))}>{[...new Set([10,20,50,100,pageSize])].sort((a,b) => a-b).map(size => <option key={size} value={size}>{size}</option>)}</NativeSelect></label> : null}</div>
      <div className="flex items-center gap-1">
        <IconButton
          label={t("pagination.previous")}
          disabledLabel={t("pagination.noPrevious")}
          size="icon-sm"
          disabled={!hasPrevious}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon className="size-4" />
        </IconButton>
        <span className="tabular-nums">{t("pagination.page", { page, totalPages })}</span>
        <IconButton
          label={t("pagination.next")}
          disabledLabel={t("pagination.noNext")}
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
