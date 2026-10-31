import { useState } from "react";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { newCatalogField, type CatalogFieldDraft } from "../catalogFields";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import type { FormCulture } from "../model";
import { CatalogItemsDialog } from "./CatalogItemsDialog";

vi.mock("@/shared/hooks/useMediaQuery", () => ({ useMediaQuery: vi.fn(() => true) }));
afterEach(() => vi.mocked(useMediaQuery).mockReturnValue(true));

const first: CatalogManualItemValue = { value: null, localId: "first", itemId: "saved-first", label: { es: "Pérez Hnos.", en: "" }, detail: { es: "Av. Colón 1234", en: null }, code: "C-001", isActive: true, position: 1 };
const second: CatalogManualItemValue = { ...first, localId: "second", itemId: "saved-second", label: { es: "Ferretería Sur", en: "South hardware" }, code: "C-002", position: 2 };
const fuel: CatalogManualItemValue = { value: null, localId: "fuel", itemId: null, label: { es: "Combustibles", en: null }, detail: { es: null, en: null }, code: "COMBUSTIBLES", isActive: true, position: null };
const blank: CatalogManualItemValue = { ...fuel, localId: "blank", label: { es: null, en: null }, code: "" };
const scope = { actorId: "actor", culture: "es" as const, permissions: ["formcatalogs.read", "formcatalogs.manage"] };
const term = { ...newCatalogField("term", 1), id: "01990000-0000-7000-8000-000000000004", type: "integer" as const, name: { es: "Plazo" } };

interface Options {
  items: readonly CatalogManualItemValue[]; mode?: "new" | "edit"; selectedId?: string | null; culture?: FormCulture; original?: FormCulture;
  fields?: readonly CatalogFieldDraft[]; errors?: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
}

// The page's part: the draft, the chosen option and the options marked to delete.
async function mount({ items, mode = "edit", selectedId = items[0]?.localId ?? null, culture = "es", original = "es", fields, errors }: Options) {
  const calls = { onSelect: vi.fn(), onChange: vi.fn(), onFieldBlur: vi.fn(), onGenerateCode: vi.fn(), onAdd: vi.fn(), onRemove: vi.fn(), onDelete: vi.fn(), onRestore: vi.fn(), onDone: vi.fn(), onCancel: vi.fn() };
  function Host() {
    const [rows, setRows] = useState(items);
    const [selected, setSelected] = useState(selectedId);
    const [deleted, setDeleted] = useState<readonly string[]>([]);
    return <CatalogItemsDialog catalogName="Proveedores" mode={mode} items={rows} selectedId={selected} totalCount={2} range="1–2 de 2" culture={culture} original={original} valueType="Text"
      fields={fields} scope={scope} readOnly={false} errors={errors} deletedItemIds={deleted} onFieldBlur={calls.onFieldBlur} onGenerateCode={calls.onGenerateCode} onAdd={calls.onAdd} onDone={calls.onDone} onCancel={calls.onCancel}
      onSelect={localId => { calls.onSelect(localId); setSelected(localId); }}
      onChange={item => { calls.onChange(item); setRows(current => current.map(row => row.localId === item.localId ? item : row)); }}
      onRemove={item => { calls.onRemove(item); setRows(current => current.filter(row => row.localId !== item.localId)); }}
      onDelete={item => { calls.onDelete(item); setDeleted(current => [...current, item.itemId!]); }}
      onRestore={item => { calls.onRestore(item); setDeleted(current => current.filter(id => id !== item.itemId)); }} />;
  }
  await act(async () => { renderWithProviders(<Host />); });
  return { user: userEvent.setup(), ...calls };
}

it("lists the options added in the modal with their badge and code, and opens the chosen one with the cursor in its text", async () => {
  await mount({ mode: "new", items: [fuel, blank], selectedId: "blank" });
  expect(screen.getByRole("dialog", { name: "Opciones nuevas de «Proveedores»" })).toBeInTheDocument();
  const list = within(screen.getByRole("list", { name: "Opciones nuevas" }));
  expect(list.getByRole("button", { name: "Editar Combustibles" })).toHaveTextContent("COMBUSTIBLES");
  expect(list.getByRole("button", { name: "Editar Nueva opción" })).toHaveTextContent("Sin código");
  expect(list.getAllByText("Nueva")).toHaveLength(2);
  expect(screen.getByRole("heading", { name: "Nueva opción" })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Texto" })).toHaveFocus());
  expect(screen.getByRole("button", { name: "Para qué es el código" })).toBeInTheDocument();
});

it("edits only the menu language of the chosen option and keeps its identity", async () => {
  const { user, onChange } = await mount({ items: [first, second], culture: "en" });
  const text = screen.getByRole("textbox", { name: "Texto" });
  expect(text).toHaveValue("");
  await user.type(text, "Perez Brothers");
  const last = onChange.mock.lastCall?.[0] as CatalogManualItemValue;
  expect(last).toEqual({ ...first, label: { es: "Pérez Hnos.", en: "Perez Brothers" } });
});

it("says which saved option it is and stages its state as active or inactive", async () => {
  const { user, onChange } = await mount({ items: [first, second] });
  expect(screen.getByRole("heading", { name: "Opción 1 de 2" })).toBeInTheDocument();
  await user.click(within(screen.getByRole("group", { name: "Estado" })).getByRole("button", { name: "De baja" }));
  expect(onChange).toHaveBeenLastCalledWith({ ...first, isActive: false });
  await user.click(within(screen.getByRole("group", { name: "Estado" })).getByRole("button", { name: "Activa" }));
  expect(onChange).toHaveBeenLastCalledWith(first);
});

it("offers no state for a new option and generates its code from the text until it has one", async () => {
  const { user, onGenerateCode } = await mount({ mode: "new", items: [{ ...blank, label: { es: "Norte", en: null } }, fuel] });
  expect(screen.queryByRole("group", { name: "Estado" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Generar desde el texto" }));
  expect(onGenerateCode).toHaveBeenCalledWith(expect.objectContaining({ localId: "blank" }));
  await user.click(screen.getByRole("button", { name: "Editar Combustibles" }));
  expect(screen.getByRole("button", { name: "Generar desde el texto" })).toBeDisabled();
});

it("removes a new option without asking and goes to the next one", async () => {
  const { user, onRemove, onSelect } = await mount({ mode: "new", items: [fuel, blank] });
  await user.click(screen.getByRole("button", { name: "Quitar opción" }));
  expect(onRemove).toHaveBeenCalledWith(fuel);
  expect(onSelect).toHaveBeenLastCalledWith("blank");
  expect(screen.queryByRole("dialog", { name: /Eliminar/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Editar Combustibles" })).not.toBeInTheDocument();
});

it("asks before removing a saved option, marks it to delete and offers to restore it", async () => {
  const { user, onDelete, onRestore } = await mount({ items: [first, second] });
  await user.click(screen.getByRole("button", { name: "Quitar opción" }));
  const confirm = screen.getByRole("dialog", { name: "¿Eliminar «Pérez Hnos.»?" });
  await user.click(within(confirm).getByRole("button", { name: "Eliminar opción" }));
  expect(onDelete).toHaveBeenCalledWith(first);
  expect(screen.getByRole("button", { name: "Editar Pérez Hnos." })).toHaveTextContent("Se elimina al guardar");
  expect(screen.queryByRole("textbox", { name: "Texto" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Restaurar" }));
  expect(onRestore).toHaveBeenCalledWith(first);
  expect(screen.getByRole("textbox", { name: "Texto" })).toHaveValue("Pérez Hnos.");
});

it("adds another option from its list", async () => {
  const { user, onAdd } = await mount({ mode: "new", items: [fuel] });
  await user.click(screen.getByRole("button", { name: "Agregar opción" }));
  expect(onAdd).toHaveBeenCalledOnce();
});

it("keeps the options with Done and discards them with Cancel or Escape", async () => {
  const { user, onDone, onCancel } = await mount({ items: [first] });
  await user.click(screen.getByRole("button", { name: "Listo" }));
  expect(onDone).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(onCancel).toHaveBeenCalledOnce();
  await user.keyboard("{Escape}");
  expect(onCancel).toHaveBeenCalledTimes(2);
  expect(onDone).toHaveBeenCalledOnce();
});

it("returns the focus to what opened it when it closes", async () => {
  function Host() {
    const [open, setOpen] = useState(false);
    return <><button type="button" onClick={() => setOpen(true)}>Abrir</button>{open ? <CatalogItemsDialog catalogName="Proveedores" mode="edit" items={[first]} selectedId="first" totalCount={1} culture="es" original="es" valueType="Text" readOnly={false}
      onSelect={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} onRemove={vi.fn()} onDelete={vi.fn()} onRestore={vi.fn()} onDone={() => setOpen(false)} onCancel={() => setOpen(false)} /> : null}</>;
  }
  await act(async () => { renderWithProviders(<Host />); });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Abrir" }));
  await user.click(screen.getByRole("button", { name: "Listo" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Abrir" })).toHaveFocus());
});

it("marks a control with its error and says it", async () => {
  await mount({ items: [first, second], errors: { first: { code: ["Repetido: también está en la fila 2."] } } });
  const code = screen.getByRole("textbox", { name: "Código" });
  expect(code).toHaveAttribute("aria-invalid", "true");
  expect(code).toHaveAccessibleDescription("Repetido: también está en la fila 2.");
});

it("shows a missing original text under the text on screen, with its language", async () => {
  await mount({ items: [first], original: "en", errors: { first: { "text.en": ["Completá este campo."] } } });
  expect(screen.getByRole("textbox", { name: "Texto" })).toHaveAccessibleDescription("En inglés: Completá este campo.");
  expect(screen.getByRole("textbox", { name: "Texto" })).toHaveAttribute("aria-invalid", "true");
});

it("shows an option written only in the other language with its text as reference", async () => {
  // An English catalog with the menu in Spanish: the option has no Spanish translation yet.
  const north: CatalogManualItemValue = { ...first, localId: "north", itemId: "saved-north", label: { en: "North" }, detail: { en: "North side" }, code: "N" };
  await mount({ items: [north], original: "en" });
  const text = screen.getByRole("textbox", { name: "Texto" });
  expect(text).toHaveValue(""); expect(text).toHaveAttribute("placeholder", "Sin traducir");
  expect(text).toHaveAccessibleDescription("Original (Inglés): North");
  expect(screen.getByRole("textbox", { name: "Detalle" })).toHaveAccessibleDescription("Original (Inglés): North side");
});

it("presents a required field as optional on an inactive option, as the server only requires it on active ones", async () => {
  const confirmed = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type: "boolean" as const, required: true, name: { es: "Confirmado" } };
  const { user, onChange } = await mount({ items: [{ ...first, isActive: false, fields: { [confirmed.id]: "true" } }], fields: [confirmed] });
  expect(screen.getByText("Confirmado", { selector: "label" })).toHaveTextContent(/^Confirmado$/);
  await user.click(screen.getByRole("button", { name: "Limpiar Confirmado" }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ localId: "first", fields: { [confirmed.id]: null } }));
  await user.click(within(screen.getByRole("group", { name: "Estado" })).getByRole("button", { name: "Activa" }));
  expect(screen.getByText("Confirmado", { selector: "label" })).toHaveTextContent(/^Confirmado \*$/);
});

it("announces a value error of an extra field without interrupting, since its text changes with each keystroke", async () => {
  await mount({ items: [{ ...first, fields: { [term.id]: "30 d" } }], fields: [term], errors: { first: { ["fields." + term.id]: ["«30 d» no es un número entero."] } } });
  const input = screen.getByRole("textbox", { name: "Plazo" });
  expect(input).toHaveAccessibleDescription("«30 d» no es un número entero.");
  expect(document.getElementById(input.getAttribute("aria-describedby")!)).toHaveAttribute("role", "status");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("reports leaving a control by its option and error path, but not the text it opened in", async () => {
  const { user, onFieldBlur } = await mount({ items: [first, second], fields: [term] });
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Texto" })).toHaveFocus());
  await user.click(screen.getByRole("textbox", { name: "Código" }));
  expect(onFieldBlur).not.toHaveBeenCalled();
  await user.click(screen.getByRole("textbox", { name: "Plazo" }));
  await user.click(screen.getByRole("textbox", { name: "Detalle" }));
  expect(onFieldBlur.mock.calls).toEqual([["first", "code"], ["first", "fields." + term.id]]);
});

it("shows the type and range of an extra field", async () => {
  const range = { ...term, name: { es: "Plazo de pago (días)" }, min: "0", max: "180" };
  const due = { ...newCatalogField("due", 2), id: "01990000-0000-7000-8000-000000000005", type: "date" as const, name: { es: "Vence" }, max: "2027-03-15" };
  const amount = { ...newCatalogField("amount", 3), id: "01990000-0000-7000-8000-000000000006", type: "decimal" as const, name: { es: "Importe" } };
  await mount({ items: [first], fields: [range, due, amount] });
  expect(screen.getByRole("textbox", { name: "Plazo de pago (días)" })).toHaveAccessibleDescription("Entero, de 0 a 180.");
  expect(screen.getByLabelText("Vence")).toHaveAccessibleDescription("Fecha, hasta 15/03/2027.");
  expect(screen.getByRole("textbox", { name: "Importe" })).toHaveAccessibleDescription("Número decimal.");
});

it("on the phone, starts on the list and opens an option with a way back to it", async () => {
  vi.mocked(useMediaQuery).mockReturnValue(false);
  const { user, onSelect } = await mount({ items: [first, second], selectedId: null });
  expect(screen.queryByRole("textbox", { name: "Texto" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Editar Ferretería Sur" }));
  expect(onSelect).toHaveBeenLastCalledWith("second");
  expect(screen.getByRole("textbox", { name: "Texto" })).toHaveValue("Ferretería Sur");
  expect(screen.queryByRole("button", { name: "Listo" })).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Volver a la lista" }));
  expect(onSelect).toHaveBeenLastCalledWith(null);
  expect(screen.getByRole("button", { name: "Editar Pérez Hnos." })).toBeInTheDocument();
});
