import { DisabledReason } from "./DisabledReason";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { parseSort, type SortKind } from "@/shared/lib/sort";
import { cn } from "@/shared/lib/utils";
import { Button } from "./button";
import { EmptyState } from "./EmptyState";
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "./icons";
import { Spinner } from "./Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

export type { SortKind } from "@/shared/lib/sort";

interface ColumnBase<TRow> {
  /// En una columna que ordena, el nombre del campo de orden del backend.
  id: string;
  header: string;
  cell: (row: TRow) => ReactNode;
  align?: "left" | "right";
  /// Una columna de números (cantidades, medidas, importes): va a la derecha, con su encabezado (A, 2026-11-02).
  numeric?: boolean;
}

/// Toda columna decide si ordena (OT1-C, 2026-11-22): con un dato, `sortable: true` y su `sortKind`, que nombra los dos
/// sentidos y elige el del primer toque; Acciones, un ícono o varios valores, `false`.
export type Column<TRow> = ColumnBase<TRow> & ({ sortable: true; sortKind: SortKind } | { sortable: false; sortKind?: never });

interface DataTableProps<TRow> {
  columns: Column<TRow>[];
  rows: readonly TRow[];
  rowKey: (row: TRow) => string;
  selectedRowKey?: string;
  /// Clic en una celda sin controles; los enlaces conservan la navegación por teclado.
  onRowClick?: (row: TRow) => void;
  isLoading?: boolean;
  /// Vuelve a leer con las filas anteriores a la vista (buscar, filtrar, ordenar, paginar): la tabla las atenúa y
  /// corre una línea bajo el encabezado (tablero LC2-A). El dueño pasa, por ejemplo, `isPlaceholderData`.
  refreshing?: boolean;
  /// Includes a successfully loaded empty list; refresh failures preserve its state.
  hasData?: boolean;
  error?: string;
  /// Detalle extra del error (por ejemplo, el traceId para poder reportarlo).
  errorDescription?: string;
  onRetry?: () => void;
  /** Why «Reintentar» waits, as the time the server asked after a 429: the button stays off with that reason. */
  retryReason?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  /// Lo que se puede hacer desde el vacío. Con filtros puestos, limpiarlos: un vacío que no ofrece salida
  /// deja a la persona buscando de dónde agarrarse.
  emptyAction?: ReactNode;
  /// Orden que se ve, en el formato del backend: "campo" o "-campo". Sin uno elegido, el de siempre si es una columna.
  sort?: string;
  /// Tocar el encabezado de una columna que ordena: `usePagination.toggleSort` elige el sentido.
  onSortChange?: (field: string, kind: SortKind) => void;
  /// Una tabla ancha: su desplazamiento es una región con este nombre, a la que se llega con el teclado (como `WideTable`).
  scrollLabel?: string;
}

/// El nivel "rótulo" de la escala tipográfica: 11 px, semibold, mayúsculas con letter-spacing. Es el mismo
/// tratamiento que el rótulo de grupo del menú lateral, y es lo que hace que la tabla se vea parte del
/// sistema y no un widget pegado.
const headerText = "text-[length:var(--text-caption)] font-semibold tracking-[0.06em] uppercase text-[var(--color-surface-header-foreground)]";

function ariaSort(columnId: string, sort: string | undefined): "ascending" | "descending" | "none" {
  const parsed = parseSort(sort);
  if (parsed?.field !== columnId) return "none";
  return parsed.descending ? "descending" : "ascending";
}

/// La flecha de la columna que ordena, del color de la marca; en las demás que ordenan, ↕ al pasar el mouse o con el foco.
function SortMark({ direction }: { direction: "ascending" | "descending" | "none" }) {
  if (direction === "ascending") return <ArrowUpIcon className="size-3 shrink-0 text-[var(--color-brand-600)]" />;
  if (direction === "descending") return <ArrowDownIcon className="size-3 shrink-0 text-[var(--color-brand-600)]" />;
  return <ChevronsUpDownIcon className="size-3 shrink-0 opacity-0 group-hover/sort:opacity-60 group-focus-visible/sort:opacity-60" />;
}

/// Listado con encabezados ordenables y estados de carga, error y vacío (sección 7.4).
export function DataTable<TRow>({
  columns,
  rows,
  rowKey,
  selectedRowKey,
  onRowClick,
  isLoading,
  refreshing = false,
  hasData = rows.length > 0,
  error,
  errorDescription,
  onRetry,
  retryReason,
  emptyTitle,
  emptyDescription,
  emptyAction,
  sort,
  onSortChange,
  scrollLabel,
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
            <DisabledReason reason={retryReason}>
              <Button type="button" variant="outline" disabled={!!retryReason} onClick={onRetry}>
                {t("actions.retry")}
              </Button>
            </DisabledReason>
          ) : undefined
        }
      />
    );
  }

  const header = (
    <TableHeader>
      {/* TableHeader aporta el tono y neutraliza el hover de la banda para todos los listados. */}
      <TableRow>
        {columns.map((column) => {
          // Una columna que no ordena no cambia al pasar el mouse ni lleva `aria-sort`.
          if (!column.sortable || !onSortChange) {
            return (
              <TableHead key={column.id} scope="col" numeric={column.numeric} className={column.align === "right" ? "text-right" : undefined}>
                {column.header}
              </TableHead>
            );
          }
          const direction = ariaSort(column.id, sort);
          // En una columna de números la flecha va antes del título, que sigue alineado con las cifras.
          const end = column.numeric || column.align === "right";
          return (
            <TableHead key={column.id} scope="col" aria-sort={direction} numeric={column.numeric}
              className={cn("relative hover:bg-[var(--color-surface-header-hover)] has-[:focus-visible]:bg-[var(--color-surface-header-hover)]", column.align === "right" && "text-right")}>
              {/* El título queda con el margen y el alto de cualquier encabezado, y la capa del botón (`after:`) cubre toda la
                  celda: se toca en cualquier punto y el foco la marca entera. Un botón del alto de la celda la estiraba medio
                  píxel por la línea de abajo, y su margen corría el borde de las cifras. Su nombre es el título, sin tooltip;
                  el tono va en la celda, debajo de la línea entre columnas. Con puntero táctil el encabezado mide 44 px
                  (`index.css`, por `data-slot="table-sort"`). */}
              <button
                type="button"
                data-slot="table-sort"
                onClick={() => onSortChange(column.id, column.sortKind)}
                className={cn(headerText, "group/sort inline-flex items-center gap-1.5 align-middle outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[var(--color-brand-600)]")}
              >
                {end ? <SortMark direction={direction} /> : null}
                <span>{column.header}</span>
                {end ? null : <SortMark direction={direction} />}
              </button>
            </TableHead>
          );
        })}
      </TableRow>
    </TableHeader>
  );

  // La primera carga conserva su aro (LC2-A) pero la tabla ya está: el encabezado de siempre y el aro centrado en
  // el alto de ocho renglones, así al llegar las filas el listado no cambia de alto (tablero ES1-A).
  if (isLoading) {
    return (
      // Presentacional: un marcador de lugar con su aro no es una tabla de datos para el lector de pantalla, que
      // oye «Cargando…»; la tabla aparece, con su rol, cuando llegan las filas.
      <Table role="presentation">
        {header}
        <TableBody striped={false}>
          <TableRow className="h-[calc(var(--height-table-row)*8)] hover:bg-transparent">
            <TableCell colSpan={columns.length} className="text-center">
              <Spinner />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
  }

  if (rows.length === 0) {
    return <EmptyState embedded title={emptyTitle ?? t("states.empty")} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <Table refreshing={refreshing} scrollLabel={scrollLabel}>
      {header}
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
                <TableCell key={column.id} numeric={column.numeric} className={cn("px-4", column.align === "right" ? "text-right" : undefined)}>
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
