import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { Button } from "./button";
import { EmptyState } from "./EmptyState";
import { Spinner } from "./Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

export interface Column<TRow> {
  /// Coincide con el nombre del campo ordenable del backend.
  id: string;
  header: string;
  cell: (row: TRow) => ReactNode;
  sortable?: boolean;
  align?: "left" | "right";
}

interface DataTableProps<TRow> {
  columns: Column<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  isLoading?: boolean;
  error?: string;
  /// Detalle extra del error (por ejemplo, el traceId para poder reportarlo).
  errorDescription?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /// Orden actual, en el formato del backend: "campo" o "-campo".
  sort?: string;
  onSortChange?: (field: string) => void;
}

/// El nivel "rótulo" de la escala tipográfica: 11 px, semibold, mayúsculas con letter-spacing. Es el mismo
/// tratamiento que el rótulo de grupo del menú lateral, y es lo que hace que la tabla se vea parte del
/// sistema y no un widget pegado.
const headerText = "text-[11px] font-semibold tracking-[0.06em] uppercase text-[var(--color-content)]";

function ariaSort(columnId: string, sort: string | undefined): "ascending" | "descending" | "none" {
  if (sort === columnId) {
    return "ascending";
  }

  return sort === `-${columnId}` ? "descending" : "none";
}

/// Listado con encabezados ordenables y estados de carga, error y vacío (sección 7.4).
export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  isLoading,
  error,
  errorDescription,
  onRetry,
  emptyTitle,
  emptyDescription,
  sort,
  onSortChange,
}: DataTableProps<TRow>) {
  const { t } = useTranslation();

  if (error) {
    return (
      <EmptyState
        title={error}
        description={errorDescription}
        action={
          onRetry ? (
            <Button type="button" variant="outline" onClick={onRetry}>
              {t("actions.retry")}
            </Button>
          ) : undefined
        }
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-10">
        <Spinner />
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle ?? t("states.empty")} description={emptyDescription} />;
  }

  return (
    <Table>
      <TableHeader>
        {/* La banda de superficie. El hover se neutraliza porque `TableRow` lo trae para las filas de datos,
            y un encabezado que se ilumina al pasar por encima parece que se puede apretar entero. */}
        <TableRow className="bg-[var(--color-surface-header)] border-b-[var(--color-surface-header-border)] hover:bg-[var(--color-surface-header)]">
          {columns.map((column) => (
            <TableHead
              key={column.id}
              scope="col"
              aria-sort={ariaSort(column.id, sort)}
              className={cn(headerText, "px-4", column.align === "right" ? "text-right" : undefined)}
            >
              {column.sortable && onSortChange ? (
                // El botón hereda la tipografía del encabezado: si se queda con la suya, la columna
                // ordenable se ve de otro tamaño que las demás.
                <Button type="button" variant="ghost" size="sm" onClick={() => onSortChange(column.id)} className={cn(headerText, "-mx-2 px-2")}>
                  {column.header}
                </Button>
              ) : (
                column.header
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          // 44 px: la densidad del proyecto, decidida una vez (fundamento visual, "Tres alturas").
          <TableRow key={rowKey(row)} className="h-11">
            {columns.map((column) => (
              <TableCell key={column.id} className={cn("px-4", column.align === "right" ? "text-right" : undefined)}>
                {column.cell(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
