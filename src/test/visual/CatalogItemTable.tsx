import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { ItemCards, ItemTable, type ItemCellContext, type ItemTableColumn } from "@/shared/ui/ItemTable";
import { Label } from "@/shared/ui/label";
import { Picker } from "@/shared/ui/Picker";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";

interface Item { key: string; values: Record<string, string> }

// The owner of each example keeps its items, as a form would: a new one comes empty at the end.
function useItems(initial: Item[], minItems: number, maxItems: number) {
  const [items, setItems] = useState(initial);
  const change = (key: string, column: string, value: string) =>
    setItems(current => current.map(item => item.key === key ? { ...item, values: { ...item.values, [column]: value } } : item));
  return {
    change,
    list: {
      items, minItems, maxItems,
      onAdd: () => setItems(current => [...current, { key: crypto.randomUUID(), values: {} }]),
      onRemove: (key: string) => setItems(current => current.filter(item => item.key !== key)),
      onMove: (key: string, offset: -1 | 1) => setItems(current => {
        const index = current.findIndex(item => item.key === key), moved = [...current];
        [moved[index], moved[index + offset]] = [moved[index + offset]!, moved[index]!];
        return moved;
      }),
    },
  };
}

/// The table of items and its version in boxes (RG2-A) with fictitious data: empty, at the maximum, with errors and in one
/// column, as the visual standard asks of a new piece.
export function CatalogItemTable() {
  const { i18n } = useTranslation();
  const es = !i18n.language.startsWith("en");
  const text = es
    ? { article: "Artículo", quantity: "Cantidad", unit: "Unidad", state: "¿Llegó en buen estado?", notes: "Observaciones", block: "Artículos", yes: "Sí", no: "No",
      choose: "Elegí…", liters: "Litros", kilos: "Kilos", empty: "Ítems · vacía", full: "Ítems · con el máximo", errors: "Ítems · con errores", cards: "Ítems · en una columna",
      required: "Completá esta respuesta.", option: "Elegí una opción." }
    : { article: "Article", quantity: "Quantity", unit: "Unit", state: "Arrived in good condition?", notes: "Notes", block: "Articles", yes: "Yes", no: "No",
      choose: "Choose…", liters: "Liters", kilos: "Kilos", empty: "Items · empty", full: "Items · at the maximum", errors: "Items · with errors", cards: "Items · in one column",
      required: "Fill in this answer.", option: "Choose an option." };
  const columns: ItemTableColumn[] = [
    { key: "article", label: text.article, required: true, className: "min-w-48" },
    { key: "quantity", label: text.quantity, required: true, numeric: true, className: "w-28" },
    { key: "unit", label: text.unit, required: true, className: "min-w-32" },
    { key: "state", label: text.state, required: true },
    { key: "notes", label: text.notes, className: "min-w-56" },
  ];
  const rows = (...values: [string, string, string, string, string?][]) => values.map(([article, quantity, unit, state, notes], index) =>
    ({ key: "item-" + index, values: { article, quantity, unit, state, ...notes ? { notes } : {} } }));
  const remito = rows(["GLIFOSATO 64%", "200", "liters", "true"], ["ATRAZINA 50%", "", "liters", "true"], ["UREA GRANULADA - 46-00-00", "5000", "", "false", es ? "3 bolsas rotas en la descarga" : "3 bags torn while unloading"]);
  const empty = useItems([], 0, 10), full = useItems(remito.slice(0, 2), 1, 2), errors = useItems(remito, 1, 20), cards = useItems(remito.slice(0, 2), 1, 20);
  const problems: Record<string, Record<string, string>> = { "item-1": { quantity: text.required }, "item-2": { unit: text.option } };

  // The control of each question, in a cell (named by the table) or in a box (with its label). In a cell, the long text starts
  // as high as a field and grows with what is written, and a number goes to the right; in a box, a number stays narrow.
  const control = (owner: ReturnType<typeof useItems>, item: Item, column: ItemTableColumn, cell?: ItemCellContext) => {
    const value = item.values[column.key] ?? "", set = (next: string) => owner.change(item.key, column.key, next);
    const field = { "aria-label": cell?.label, "aria-invalid": cell?.invalid || undefined, "aria-describedby": cell?.describedBy };
    if (column.key === "unit") return <Picker label={cell?.label ?? column.label} aria-invalid={field["aria-invalid"]} aria-describedby={field["aria-describedby"]}
      placeholder={text.choose} options={[{ id: "liters", label: text.liters }, { id: "kilos", label: text.kilos }]} value={value || null} onChange={set} />;
    if (column.key === "state") return <SegmentedControl aria-label={cell?.label ?? column.label} options={[
      { key: "true", label: text.yes, pressed: value === "true", onSelect: () => set("true") },
      { key: "false", label: text.no, pressed: value === "false", onSelect: () => set("false") }]} />;
    if (column.key === "notes") return <Textarea {...field} rows={1} className={cell ? "min-h-[var(--height-control)] py-1" : undefined} value={value} onChange={event => set(event.target.value)} />;
    return <Input {...field} value={value} inputMode={column.numeric ? "decimal" : undefined}
      className={column.numeric ? cell ? "text-right" : "w-full sm:w-37.5" : undefined} onChange={event => set(event.target.value)} />;
  };
  const table = (owner: ReturnType<typeof useItems>, title: string, failing?: Record<string, Record<string, string>>) => <Surface title={title} padded>
    <ItemTable {...owner.list} label={text.block} columns={columns} error={(item, column) => failing?.[item.key]?.[column.key]}
      cell={(item, column, context) => control(owner, item, column, context)} />
  </Surface>;
  return <div className="flex flex-col gap-5">
    {table(empty, text.empty)}
    {table(full, text.full)}
    {table(errors, text.errors, problems)}
    <Surface title={text.cards} padded><div className="w-full max-w-md">
      <ItemCards {...cards.list}>{item => columns.map(column => column.key === "state"
        // Sí o no is a group of buttons: its label names it, as in a loose question.
        ? <div key={column.key} className="flex flex-col gap-1.5"><Label asChild><span>{column.label}<span aria-hidden="true"> *</span></span></Label>{control(cards, item, column)}</div>
        : <FormField key={column.key} label={column.label} required={column.required}
          error={item.key === "item-1" && column.key === "quantity" ? text.required : undefined}>{control(cards, item, column)}</FormField>)}</ItemCards>
    </div></Surface>
  </div>;
}
