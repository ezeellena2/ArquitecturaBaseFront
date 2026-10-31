import { useLayoutEffect, useRef, type ClipboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { WideTable } from "./WideTable";

export interface PasteGridColumn {
  key: string;
  label: string;
  /// La celda de cada fila pegada que la llena; sin ella, la columna queda vacía.
  cell?: number;
  /// Una columna que no se toma: su encabezado y sus celdas van en rojo.
  invalid?: boolean;
}

// Miles de filas pegadas serían miles de celdas: la grilla muestra las primeras y dice cuántas más hay.
const shownRows = 100, emptyRows = 8;
const line = "border-r border-[var(--color-border)]/60 last:border-r-0";
const number = cn("w-8 bg-[var(--color-surface-muted)] px-1.5 text-right text-xs tabular-nums text-[var(--color-content-muted)]", line);
const cell = cn("px-2.5 py-0", line);

/// Una grilla para pegar filas copiadas de una planilla, como la de Excel: la cabecera ya armada, una línea alrededor de
/// cada celda y el número de fila (IM3-A, «Importar opciones»). Vacía, su primera celda toma lo pegado, con Ctrl+V o el
/// «Pegar» del celular; al pegar, el foco pasa a la grilla llena, donde otro pegado reemplaza las filas.
///
/// No lee lo pegado: lo entrega como texto (`onPaste`) y el consumidor arma las filas y dice qué celda llena cada columna.
/// Muestra las primeras 100 filas y cuántas más hay. `disabled` no toma pegados mientras su dueño trabaja.
export function PasteGrid({ label, columns, rows, describedBy, disabled = false, onPaste }: {
  label: string;
  columns: readonly PasteGridColumn[];
  /// Las filas pegadas; sin ellas, la grilla vacía.
  rows: readonly (readonly string[])[] | null;
  describedBy?: string;
  disabled?: boolean;
  onPaste: (text: string) => void;
}) {
  const { t } = useTranslation();
  const root = useRef<HTMLDivElement>(null), refocus = useRef(false);
  // La primera celda se va con lo pegado: el foco no se pierde, pasa a la grilla.
  useLayoutEffect(() => { if (rows && refocus.current) { refocus.current = false; root.current?.querySelector<HTMLElement>('[data-slot="table-container"]')?.focus(); } }, [rows]);
  const take = (text: string) => { refocus.current = true; onPaste(text); };
  const replace = (event: ClipboardEvent) => { event.preventDefault(); onPaste(event.clipboardData.getData("text/plain")); };
  const tone = (column: PasteGridColumn) => column.invalid ? "text-[var(--color-danger)]" : undefined;
  return <div ref={root} onPaste={rows && !disabled ? replace : undefined}>
    <WideTable label={label} aria-describedby={describedBy} className="border-collapse">
      <TableHeader><TableRow>
        <TableHead className={cn("w-8 px-1.5", line)}><span className="sr-only">{t("pasteGrid.row")}</span></TableHead>
        {columns.map(column => <TableHead key={column.key} className={cn("px-2.5", line, tone(column))}>{column.label}</TableHead>)}
      </TableRow></TableHeader>
      <TableBody striped={false}>
        {rows ? rows.slice(0, shownRows).map((cells, row) => <TableRow key={row} className="h-7">
          <TableCell className={number}>{row + 1}</TableCell>
          {columns.map(column => <TableCell key={column.key} className={cn(cell, tone(column))}>{column.cell === undefined ? null : cells[column.cell]}</TableCell>)}
        </TableRow>) : Array.from({ length: emptyRows }, (_, row) => <TableRow key={row} className="h-7">
          <TableCell className={number}>{row + 1}</TableCell>
          {columns.map((column, index) => <TableCell key={column.key} className={cn(cell, !row && !index && "p-0")}>
            {!row && !index ? <textarea aria-label={t("pasteGrid.target")} placeholder={t("pasteGrid.placeholder")} value="" rows={1} autoFocus disabled={disabled}
              onPaste={event => { event.preventDefault(); take(event.clipboardData.getData("text/plain")); }} onChange={event => { if (event.target.value.trim()) take(event.target.value); }}
              className="block h-7 w-full min-w-40 resize-none overflow-hidden bg-transparent px-2.5 py-1 text-sm outline-none placeholder:text-[var(--color-content-muted)] focus:shadow-[inset_0_0_0_2px_var(--color-brand-500)] disabled:cursor-not-allowed" /> : null}
          </TableCell>)}
        </TableRow>)}
        {rows && rows.length > shownRows ? <TableRow className="h-7">
          <TableCell colSpan={columns.length + 1} className="text-[var(--color-content-muted)]">{t("pasteGrid.moreRows", { count: rows.length - shownRows })}</TableCell>
        </TableRow> : null}
      </TableBody>
    </WideTable>
  </div>;
}
