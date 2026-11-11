import { useRef, useState } from "react";
import { act, cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { Button } from "@/shared/ui/button";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { CatalogItemSort } from "../api/catalogs";
import type { CatalogFieldDraft } from "../catalogFields";
import { CatalogSortDialog } from "./CatalogSortDialog";

afterEach(async () => { cleanup(); await act(async () => { await i18n.changeLanguage("es"); }); });

const field = (id: string | null, name: string, type: CatalogFieldDraft["type"], isActive = true): CatalogFieldDraft => ({ id, localId: id ?? "new-" + name, key: name.toLowerCase(),
  name: { es: name, en: name + " EN" }, type, sourceCatalogId: null, required: false, unique: false, min: null, max: null, maxLength: null, role: "data", position: 0, isActive,
  valuesCount: 0, usedBy: [] });
const rubro = field("01990000-0000-7000-8000-000000000051", "Rubro", "catalog");
const stock = field("01990000-0000-7000-8000-000000000052", "Stock mínimo", "integer");
const alta = field("01990000-0000-7000-8000-000000000053", "Alta", "date");
const importado = field("01990000-0000-7000-8000-000000000054", "Importado", "boolean");
const fields = [rubro, stock, alta, importado, field("01990000-0000-7000-8000-000000000055", "Viejo", "text", false), field(null, "Nuevo", "text")];

async function mount(value: CatalogItemSort | null = null, language: "es" | "en" = "es") {
  await i18n.changeLanguage(language);
  const onApply = vi.fn();
  function Host() {
    const [open, setOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    return <><Button ref={trigger} onClick={() => setOpen(true)}>⋮</Button>
      {open ? <CatalogSortDialog fields={fields} culture={language} value={value} focusFallback={trigger} onApply={onApply} onClose={() => setOpen(false)} /> : null}</>;
  }
  await act(async () => { renderWithProviders(<Host />); });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "⋮" }));
  return { user, onApply, dialog: await screen.findByRole("dialog") };
}

describe("«Ordenar por…» (OR1-A)", () => {
  it("offers the text, the code and the saved active fields, and opens in Texto from A to Z", async () => {
    const { dialog } = await mount();
    expect(within(dialog).getByRole("heading", { name: "Ordenar las opciones" })).toBeInTheDocument();
    const column = within(dialog).getByRole("combobox", { name: "Columna" });
    expect(within(column).getAllByRole("option").map(option => option.textContent)).toEqual(["Texto", "Código", "Rubro", "Stock mínimo", "Alta", "Importado"]);
    expect(column).toHaveValue("text");
    expect(within(dialog).getByRole("radio", { name: "De la A a la Z" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "De la Z a la A" })).not.toBeChecked();
  });

  it("names the direction by the column's data", async () => {
    const { user, dialog } = await mount();
    const column = within(dialog).getByRole("combobox", { name: "Columna" });
    const directions = () => within(dialog).getAllByRole("radio").map(radio => radio.closest("label")?.textContent ?? radio.getAttribute("aria-label") ?? "");
    await user.selectOptions(column, rubro.id!);
    expect(within(dialog).getByRole("radio", { name: "De la A a la Z" })).toBeInTheDocument();
    await user.selectOptions(column, stock.id!);
    expect(within(dialog).getByRole("radio", { name: "De menor a mayor" })).toBeChecked();
    expect(within(dialog).getByRole("radio", { name: "De mayor a menor" })).toBeInTheDocument();
    await user.selectOptions(column, alta.id!);
    expect(within(dialog).getByRole("radio", { name: "De la más antigua a la más reciente" })).toBeInTheDocument();
    await user.selectOptions(column, importado.id!);
    expect(within(dialog).getByRole("radio", { name: "Primero «No»" })).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "Primero «Sí»" })).toBeInTheDocument();
    expect(directions()).toHaveLength(2);
  });

  it("says in its (i) that ties keep their order and empty values go last", async () => {
    const { user, dialog } = await mount();
    await user.click(within(dialog).getByRole("button", { name: "Más información sobre Orden" }));
    expect(await screen.findByText("Las opciones con el mismo valor quedan en el orden de ahora, y las que no tienen valor van al final.", { selector: "[role=tooltip] *, [role=tooltip]" })).toBeInTheDocument();
  });

  it("returns the chosen column and direction only with «Ordenar», and gives the focus back to ⋮", async () => {
    const { user, onApply, dialog } = await mount();
    await user.selectOptions(within(dialog).getByRole("combobox", { name: "Columna" }), stock.id!);
    await user.click(within(dialog).getByRole("radio", { name: "De mayor a menor" }));
    expect(onApply).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Ordenar" }));
    expect(onApply).toHaveBeenCalledExactlyOnceWith({ column: stock.id, descending: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "⋮" })).toHaveFocus();
  });

  it("opens with the pending order and «Cancelar» keeps it as it was", async () => {
    const { user, onApply, dialog } = await mount({ column: "code", descending: true });
    expect(within(dialog).getByRole("combobox", { name: "Columna" })).toHaveValue("code");
    expect(within(dialog).getByRole("radio", { name: "De la Z a la A" })).toBeChecked();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("speaks English with the English field names", async () => {
    const { dialog } = await mount({ column: stock.id!, descending: false }, "en");
    expect(within(dialog).getByRole("heading", { name: "Sort the options" })).toBeInTheDocument();
    expect(within(within(dialog).getByRole("combobox", { name: "Column" })).getAllByRole("option").map(option => option.textContent)).toEqual(["Text", "Code", "Rubro EN", "Stock mínimo EN", "Alta EN", "Importado EN"]);
    expect(within(dialog).getByRole("radio", { name: "Smallest to largest" })).toBeChecked();
    expect(within(dialog).getByRole("button", { name: "Sort" })).toBeInTheDocument();
  });
});
