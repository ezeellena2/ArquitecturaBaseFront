import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { Input } from "./input";
import { ItemCards, ItemTable, type ItemTableColumn } from "./ItemTable";

interface Item { key: string; values: Record<string, string> }
const columns: ItemTableColumn[] = [{ key: "article", label: "Artículo", required: true }, { key: "quantity", label: "Cantidad", required: true, numeric: true }];
const item = (key: string, article: string, quantity: string): Item => ({ key, values: { article, quantity } });
const three = [item("a", "Glifosato 64%", "200"), item("b", "Atrazina 50%", "100"), item("c", "Urea granulada", "5000")];

// The owner keeps the items: a new one comes empty at the end, and each item keeps its key when it moves.
function Block({ initial, min = 1, max = 3, errors = {}, cards = false, disabled = false }: {
  initial: Item[]; min?: number; max?: number; errors?: Record<string, Record<string, string>>; cards?: boolean; disabled?: boolean;
}) {
  const [items, setItems] = useState(initial);
  const [next, setNext] = useState(1);
  const list = {
    items, minItems: min, maxItems: max, disabled, addId: "add-item",
    onAdd: () => { setItems(current => [...current, { key: "new-" + next, values: {} }]); setNext(value => value + 1); },
    onRemove: (key: string) => setItems(current => current.filter(entry => entry.key !== key)),
    onMove: (key: string, offset: -1 | 1) => setItems(current => {
      const index = current.findIndex(entry => entry.key === key), moved = [...current];
      [moved[index], moved[index + offset]] = [moved[index + offset]!, moved[index]!];
      return moved;
    }),
  };
  const change = (key: string, column: string, value: string) =>
    setItems(current => current.map(entry => entry.key === key ? { ...entry, values: { ...entry.values, [column]: value } } : entry));
  if (cards) return <ItemCards {...list}>{entry => columns.map(column => <label key={column.key} className="flex flex-col">{column.label}
    <Input value={entry.values[column.key] ?? ""} onChange={event => change(entry.key, column.key, event.target.value)} /></label>)}</ItemCards>;
  return <ItemTable {...list} label="Artículos" columns={columns} error={(entry, column) => errors[entry.key]?.[column.key]}
    cell={(entry, column, context) => <Input aria-label={context.label} aria-invalid={context.invalid || undefined} aria-describedby={context.describedBy}
      value={entry.values[column.key] ?? ""} onChange={event => change(entry.key, column.key, event.target.value)} />} />;
}
const bodyRows = () => within(screen.getByRole("region", { name: "Artículos" })).getAllByRole("row").slice(1);
const articles = () => screen.getAllByRole("textbox").filter(box => /Artículo/.test(box.getAttribute("aria-label") ?? "")).map(box => (box as HTMLInputElement).value);

describe("the table of items", () => {
  it("draws a row per item with its number and a column per question, each cell named by its item and question", () => {
    renderWithProviders(<Block initial={three.slice(0, 2)} />);

    expect(within(screen.getByRole("region", { name: "Artículos" })).getAllByRole("columnheader").map(header => header.textContent))
      .toEqual(["Ítem", "Artículo *", "Cantidad *", "Acciones"]);
    expect(bodyRows().map(row => within(row).getAllByRole("cell")[0]!.textContent)).toEqual(["1", "2"]);
    expect(screen.getByRole("textbox", { name: "Ítem 2 · Cantidad" })).toHaveValue("100");
  });

  it("adds an empty item at the end, takes the focus to its first question and, at the maximum, turns off saying why", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Block initial={three.slice(0, 2)} />);

    await user.click(screen.getByRole("button", { name: "Agregar ítem" }));

    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByRole("textbox", { name: "Ítem 3 · Artículo" })).toHaveFocus();
    const add = screen.getByRole("button", { name: "Agregar ítem" });
    expect(add).toHaveAttribute("aria-disabled", "true");
    expect(add).toHaveAccessibleDescription("Hasta 3 ítems.");
    expect(add).toHaveAttribute("id", "add-item");
  });

  it("moves an item up and down, keeps the focus on its arrows and says where it went", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Block initial={three} />);
    expect(screen.getByRole("button", { name: "Subir el ítem 1" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar el ítem 3" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Subir el ítem 2" }));

    expect(articles()).toEqual(["Atrazina 50%", "Glifosato 64%", "Urea granulada"]);
    // At the top its arrow up turns off, so the focus stays on its other arrow.
    expect(screen.getByRole("button", { name: "Bajar el ítem 1" })).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Ahora es el ítem 1 de 3.");

    await user.click(screen.getByRole("button", { name: "Bajar el ítem 1" }));

    expect(articles()).toEqual(["Glifosato 64%", "Atrazina 50%", "Urea granulada"]);
    expect(screen.getByRole("button", { name: "Bajar el ítem 2" })).toHaveFocus();
  });

  it("removes an item without asking, down to the minimum, where the trash turns off saying why", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Block initial={three.slice(0, 2)} />);

    await user.click(screen.getByRole("button", { name: "Quitar el ítem 1" }));

    expect(articles()).toEqual(["Atrazina 50%"]);
    expect(screen.getByRole("button", { name: "Agregar ítem" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Quitar el ítem 1" })).toHaveAttribute("aria-disabled", "true");
    await user.hover(screen.getByRole("button", { name: "Quitar el ítem 1" }).parentElement!);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Al menos 1 ítem.");
  });

  it("marks each cell with a problem and says it under its row, with the name of its question, without reordering", () => {
    renderWithProviders(<Block initial={three} errors={{ b: { article: "Elegí una opción.", quantity: "Completá esta respuesta." } }} />);

    const quantity = screen.getByRole("textbox", { name: "Ítem 2 · Cantidad" });
    expect(quantity).toHaveAttribute("aria-invalid", "true");
    expect(quantity).toHaveAccessibleDescription("Cantidad: completá esta respuesta.");
    expect(screen.getByRole("textbox", { name: "Ítem 1 · Cantidad" })).not.toHaveAttribute("aria-invalid");
    const lines = bodyRows()[2]!;
    expect(within(lines).getAllByRole("alert").map(line => line.textContent)).toEqual(["Artículo: elegí una opción.", "Cantidad: completá esta respuesta."]);
    expect(articles()).toEqual(["Glifosato 64%", "Atrazina 50%", "Urea granulada"]);
  });

  it("turns everything off while its owner works, without a reason", () => {
    renderWithProviders(<Block initial={three.slice(0, 2)} disabled />);

    for (const name of ["Agregar ítem", "Subir el ítem 2", "Bajar el ítem 1", "Quitar el ítem 1"]) expect(screen.getByRole("button", { name })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Agregar ítem" })).toHaveAccessibleDescription("");
  });
});

describe("the items in boxes", () => {
  it("puts each item in its box, with its number, the arrows and «Quitar» in the band, and adds one with the focus on it", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Block initial={three.slice(0, 2)} cards />);

    expect(screen.getAllByRole("region", { name: /^Ítem/ }).map(box => within(box).getByRole("heading", { level: 3 }).textContent)).toEqual(["Ítem 1", "Ítem 2"]);
    const first = screen.getByRole("region", { name: "Ítem 1" });
    expect(within(first).getByRole("button", { name: "Subir el ítem 1" })).toBeDisabled();
    expect(within(first).getByRole("button", { name: "Quitar el ítem 1" })).toHaveTextContent("Quitar");

    await user.click(screen.getByRole("button", { name: "Agregar ítem" }));

    expect(within(screen.getByRole("region", { name: "Ítem 3" })).getByRole("textbox", { name: "Artículo" })).toHaveFocus();
  });

  it("moves a box keeping the focus on its arrow and removes one down to the minimum, saying why", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Block initial={three.slice(0, 2)} cards />);

    await user.click(screen.getByRole("button", { name: "Bajar el ítem 1" }));

    expect(within(screen.getByRole("region", { name: "Ítem 2" })).getByRole("textbox", { name: "Artículo" })).toHaveValue("Glifosato 64%");
    expect(screen.getByRole("button", { name: "Subir el ítem 2" })).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Quitar el ítem 2" }));

    const remove = screen.getByRole("button", { name: "Quitar el ítem 1" });
    expect(remove).toHaveAttribute("aria-disabled", "true");
    expect(remove).toHaveAccessibleDescription("Al menos 1 ítem.");
    expect(screen.getByRole("button", { name: "Agregar ítem" })).toHaveFocus();
  });
});

describe("a column that explains itself (CA1-A)", () => {
  it("puts the (i) next to the column's name, with what it says as its tooltip", () => {
    const list = { items: three, minItems: 1, maxItems: 3, addId: "add-item", onAdd: () => {}, onRemove: () => {}, onMove: () => {} };
    renderWithProviders(<ItemTable {...list} label="Artículos" columns={[...columns, { key: "amount", label: "Importe", numeric: true, help: "Cantidad por Precio unitario" }]}
      cell={(entry, column, context) => <Input aria-label={context.label} readOnly value={entry.values[column.key] ?? ""} />} />);
    const header = screen.getByRole("columnheader", { name: /Importe/ });
    expect(within(header).getByRole("button", { name: "Más información sobre Importe" })).toHaveAccessibleDescription("Cantidad por Precio unitario");
  });
});
