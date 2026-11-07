import { Fragment, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { Button } from "./button";
import { DisabledReason } from "./DisabledReason";
import { IconButton } from "./IconButton";
import { AlertTriangleIcon, ChevronDownIcon, PlusIcon, TrashIcon } from "./icons";
import { Surface } from "./Surface";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";
import { WideTable } from "./WideTable";

export interface ItemTableColumn {
  key: string;
  label: string;
  required?: boolean;
  /// Una columna de números: el encabezado y las celdas van a la derecha, como en toda tabla (A, 2026-11-02).
  numeric?: boolean;
  /// El ancho de la columna, como un número o una fecha angostos.
  className?: string;
}

/// Lo que la tabla le da al control de cada celda.
export interface ItemCellContext {
  /// La posición del ítem, desde 0.
  index: number;
  /// El nombre accesible del control, que no tiene etiqueta a la vista: el ítem y la pregunta («Ítem 2 · Cantidad»).
  label: string;
  invalid: boolean;
  /// El renglón de debajo de la fila que dice el problema de la celda.
  describedBy?: string;
}

interface ItemListProps<T extends { key: string }> {
  /// Los ítems en orden; cada uno conserva su `key` cuando se mueve.
  items: readonly T[];
  minItems: number;
  maxItems: number;
  /// Suma un ítem vacío al final.
  onAdd: () => void;
  onRemove: (key: string) => void;
  onMove: (key: string, offset: -1 | 1) => void;
  /// Apaga todo mientras su dueño trabaja, sin motivo.
  disabled?: boolean;
  /// El id de «Agregar ítem»: el dueño lleva ahí el foco cuando faltan ítems.
  addId?: string;
  /// Describe «Agregar ítem», como el mensaje de que faltan ítems.
  addDescribedBy?: string;
}

type Pending = { kind: "add" } | { kind: "remove" } | { kind: "move"; key: string; offset: -1 | 1 };
const focusable = "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex='-1'])";

// Lo que comparten la tabla y los recuadros: los botones y adónde va el foco después de cada uno. Agregar lleva el foco a la
// primera pregunta del ítem nuevo; mover lo deja en la flecha del ítem movido (o en la otra, si llegó al borde), y quitar,
// en «Agregar ítem», que siempre queda.
function useItemList<T extends { key: string }>({ items, minItems, maxItems, onAdd, onRemove, onMove, disabled = false, addId, addDescribedBy }: ItemListProps<T>) {
  const { t } = useTranslation();
  const root = useRef<HTMLDivElement>(null), add = useRef<HTMLButtonElement>(null), pending = useRef<Pending | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useLayoutEffect(() => {
    const action = pending.current;
    if (!action) return;
    pending.current = null;
    const element = (key: string) => Array.from(root.current?.querySelectorAll<HTMLElement>("[data-item]") ?? []).find(item => item.dataset.item === key);
    if (action.kind === "remove") add.current?.focus();
    else if (action.kind === "add") {
      const last = items.at(-1);
      const bodies = last ? Array.from(element(last.key)?.querySelectorAll<HTMLElement>("[data-item-body]") ?? []) : [];
      bodies.map(body => body.querySelector<HTMLElement>(focusable)).find(Boolean)?.focus();
    } else {
      const arrows = Array.from(element(action.key)?.querySelectorAll<HTMLButtonElement>("button[data-item-move]:not(:disabled)") ?? []);
      (arrows.find(arrow => arrow.dataset.itemMove === String(action.offset)) ?? arrows[0])?.focus();
    }
  }, [items]);

  const atMin = items.length <= minItems, atMax = items.length >= maxItems;
  const removeReason = !disabled && atMin ? t("itemTable.atLeast", { count: minItems }) : undefined;
  const move = (key: string, index: number, offset: -1 | 1) => {
    pending.current = { kind: "move", key, offset };
    setAnnouncement(t("itemTable.moved", { number: index + offset + 1, count: items.length }));
    onMove(key, offset);
  };
  const remove = (key: string) => { pending.current = { kind: "remove" }; onRemove(key); };
  const arrows = (item: T, index: number) => <>
    <IconButton size="icon-sm" label={t("itemTable.up", { number: index + 1 })} data-item-move="-1" disabled={disabled || index === 0}
      onClick={() => move(item.key, index, -1)}><ChevronDownIcon className="size-4 rotate-180" /></IconButton>
    <IconButton size="icon-sm" label={t("itemTable.down", { number: index + 1 })} data-item-move="1" disabled={disabled || index === items.length - 1}
      onClick={() => move(item.key, index, 1)}><ChevronDownIcon className="size-4" /></IconButton>
  </>;
  // La tabla quita con el tacho; el recuadro, con «Quitar» en su banda. Los dos en rojo y sin preguntar, como un archivo.
  const trash = (item: T, index: number) => <IconButton size="icon-sm" variant="destructive-outline" label={t("itemTable.remove", { number: index + 1 })}
    disabledLabel={removeReason} disabled={disabled || atMin} onClick={() => remove(item.key)}><TrashIcon className="size-4" /></IconButton>;
  const removeButton = (item: T, index: number) => <DisabledReason reason={removeReason}>
    <Button type="button" size="sm" variant="destructive-outline" aria-label={t("itemTable.remove", { number: index + 1 })} disabled={disabled || atMin}
      onClick={() => remove(item.key)}>{t("itemTable.removeShort")}</Button>
  </DisabledReason>;
  const footer = <div className="flex">
    <DisabledReason reason={!disabled && atMax ? t("itemTable.atMost", { count: maxItems }) : null}>
      <Button ref={add} id={addId} type="button" variant="outline" size="sm" aria-describedby={addDescribedBy} disabled={disabled || atMax}
        onClick={() => { pending.current = { kind: "add" }; onAdd(); }}><PlusIcon className="size-4" />{t("itemTable.add")}</Button>
    </DisabledReason>
  </div>;
  const status = <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</span>;
  return { root, arrows, trash, removeButton, footer, status };
}

// «Cantidad: completá esta respuesta.»: el mensaje es el de una pregunta suelta y sigue en minúscula después del nombre.
function lowerFirst(message: string, language: string) {
  return message.charAt(0).toLocaleLowerCase(language) + message.slice(1);
}

/// La tabla para cargar los ítems de un bloque (RG2-A): una fila por ítem con su número, una columna por pregunta con su
/// etiqueta arriba y, al final, ↑ ↓ y el tacho en rojo. Se desplaza de costado dentro de su caja si no entra. El problema de
/// una celda la marca (`invalid` del control) y va en un renglón debajo de su fila, con el nombre de la pregunta.
///
/// No conoce las preguntas: el dueño pone el control de cada celda (`cell`) y dice sus problemas (`error`). Arranca con
/// lo que le dan: el dueño respeta el mínimo y el máximo, que acá apagan el tacho y «Agregar ítem» con su motivo.
export function ItemTable<T extends { key: string }>({ label, columns, cell, error, ...list }: ItemListProps<T> & {
  /// El nombre del bloque: nombra la tabla.
  label: string;
  columns: readonly ItemTableColumn[];
  cell: (item: T, column: ItemTableColumn, context: ItemCellContext) => ReactNode;
  /// El problema de una celda, como el de una pregunta suelta («Completá esta respuesta.»).
  error?: (item: T, column: ItemTableColumn, index: number) => string | undefined;
}) {
  const { t, i18n } = useTranslation();
  const ids = useId();
  const { root, arrows, trash, footer, status } = useItemList(list);
  return <div ref={root} className="flex flex-col gap-2">
    <Surface>
      <WideTable label={label}>
        <TableHeader><TableRow>
          <TableHead numeric className="w-10 px-2"><span className="sr-only">{t("itemTable.number")}</span></TableHead>
          {columns.map(column => <TableHead key={column.key} numeric={column.numeric} className={cn("px-2", column.className)}>
            {column.label}{column.required ? <span aria-hidden="true"> *</span> : null}</TableHead>)}
          <TableHead className="w-px px-2"><span className="sr-only">{t("itemTable.actions")}</span></TableHead>
        </TableRow></TableHeader>
        <TableBody striped={false}>{list.items.map((item, index) => {
          const problems = columns.flatMap(column => {
            const message = error?.(item, column, index);
            return message ? [{ column: column.key, id: `${ids}-${item.key}-${column.key}`, text: t("itemTable.problem", { label: column.label, message: lowerFirst(message, i18n.language) }) }] : [];
          });
          return <Fragment key={item.key}>
            <TableRow data-item={item.key} className={cn("h-auto", problems.length > 0 && "border-b-0")}>
              <TableCell numeric className="px-2 pt-3 align-top tabular-nums text-[var(--color-content-muted)]">{index + 1}</TableCell>
              {columns.map(column => {
                const problem = problems.find(current => current.column === column.key);
                return <TableCell key={column.key} data-item-body numeric={column.numeric} className={cn("px-2 py-1.5 align-top whitespace-normal", column.className)}>
                  {cell(item, column, { index, label: t("itemTable.cell", { number: index + 1, label: column.label }), invalid: !!problem, describedBy: problem?.id })}
                </TableCell>;
              })}
              <TableCell className="px-2 py-1.5 align-top"><div className="flex items-center gap-1 pt-0.5">{arrows(item, index)}{trash(item, index)}</div></TableCell>
            </TableRow>
            {problems.length > 0 ? <TableRow className="h-auto hover:bg-transparent">
              <TableCell colSpan={columns.length + 2} className="px-2 pb-2 whitespace-normal">
                <div className="sticky left-2 flex w-fit flex-col gap-0.5">{problems.map(problem => <p key={problem.id} id={problem.id} role="alert"
                  className="flex items-start gap-1 text-xs text-[var(--color-danger)]"><AlertTriangleIcon className="mt-px size-3.5 shrink-0" />{problem.text}</p>)}</div>
              </TableCell>
            </TableRow> : null}
          </Fragment>;
        })}</TableBody>
      </WideTable>
    </Surface>
    {footer}
    {status}
  </div>;
}

/// La versión en recuadros de la tabla de ítems, para una columna (el panel y el celular, RG2-A): cada ítem en su recuadro,
/// con «Ítem N», ↑ ↓ y «Quitar» en la banda y sus preguntas una debajo de otra, que pone el dueño con sus etiquetas y
/// sus problemas, como preguntas sueltas.
export function ItemCards<T extends { key: string }>({ children, ...list }: ItemListProps<T> & {
  children: (item: T, index: number) => ReactNode;
}) {
  const { t } = useTranslation();
  const { root, arrows, removeButton, footer, status } = useItemList(list);
  return <div ref={root} className="flex flex-col gap-3">
    {list.items.map((item, index) => <div key={item.key} data-item={item.key}>
      <Surface headingLevel={3} title={t("itemTable.item", { number: index + 1 })} actions={<div className="flex items-center gap-1">{arrows(item, index)}{removeButton(item, index)}</div>}>
        <div data-item-body className="flex flex-col gap-4 p-4">{children(item, index)}</div>
      </Surface>
    </div>)}
    {footer}
    {status}
  </div>;
}
