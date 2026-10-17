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
  selectedRowKey?: string;
  /// Clic en una celda sin controles; los enlaces conservan la navegación por teclado.
  onRowClick?: (row: TRow) => void;
  isLoading?: boolean;
  /// Includes a successfully loaded empty list; refresh failures preserve its state.
  hasData?: boolean;
  error?: string;
  /// Detalle extra del error (por ejemplo, el traceId para poder reportarlo).
  errorDescription?: string;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  /// Lo que se puede hacer desde el vacío. Con filtros puestos, limpiarlos: un vacío que no ofrece salida
  /// deja a la persona buscando de dónde agarrarse.
  emptyAction?: ReactNode;
  /// Orden actual, en el formato del backend: "campo" o "-campo".
  sort?: string;
  onSortChange?: (field: string) => void;
}

/// El nivel "rótulo" de la escala tipográfica: 11 px, semibold, mayúsculas con letter-spacing. Es el mismo
/// tratamiento que el rótulo de grupo del menú lateral, y es lo que hace que la tabla se vea parte del
/// sistema y no un widget pegado.
const headerText = "text-[length:var(--text-caption)] font-semibold tracking-[0.06em] uppercase text-[var(--color-surface-header-foreground)]";

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
  selectedRowKey,
  onRowClick,
  isLoading,
  hasData = rows.length > 0,
  error,
  errorDescription,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  sort,
  onSortChange,
}: DataTableProps<TRow>) {
  const { t } = useTranslation();

  if (error && !hasData) {
    return (
      <EmptyState
        embedded
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
    return <EmptyState embedded title={emptyTitle ?? t("states.empty")} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <Table>
      <TableHeader>
        {/* TableHeader aporta el tono y neutraliza el hover de la banda para todos los listados. */}
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.id}
              scope="col"
              aria-sort={ariaSort(column.id, sort)}
              className={column.align === "right" ? "text-right" : undefined}
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
        {rows.map((row) => {
          const key = rowKey(row);
          const selected = selectedRowKey === undefined ? undefined : key === selectedRowKey;
          return (
            // La densidad la define TableRow para todos los listados.
            // El borde a media opacidad es el del tablero: a opacidad plena la tabla se lee como una grilla
            // y las líneas compiten con los datos.
            <TableRow
              key={key}
              data-state={selected ? "selected" : undefined}
              aria-selected={selected}
              className={onRowClick ? "cursor-pointer" : undefined}
              onClick={onRowClick ? event => {
                if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                if (event.target instanceof Element && event.target.closest("a, button, input, select, textarea, [role='button'], [role='checkbox'], [role='combobox'], [role='menuitem'], [contenteditable]:not([contenteditable='false'])")) return;
                onRowClick(row);
              } : undefined}
            >
              {columns.map((column) => (
                <TableCell key={column.id} className={cn("px-4", column.align === "right" ? "text-right" : undefined)}>
                  {column.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
