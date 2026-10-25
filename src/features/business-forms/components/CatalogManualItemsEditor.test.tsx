import { useState } from "react";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { newCatalogField } from "../catalogFields";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import { CatalogManualItemsEditor } from "./CatalogManualItemsEditor";

const first: CatalogManualItemValue = { value: null, localId: "first", itemId: "saved-first", label: { es: "Pérez Hnos.", en: "" }, detail: { es: "Av. Colón 1234", en: null }, code: "C-001", isActive: true, position: 1 };
const second: CatalogManualItemValue = { ...first, localId: "second", itemId: "saved-second", label: { es: "Ferretería Sur", en: "South hardware" }, code: "C-002", position: 2 };
afterEach(async () => { cleanup(); await act(async () => { await i18n.changeLanguage("es"); }); });
async function mount(culture: "es" | "en", canManage = true) {
  const onChange = vi.fn(); const onAdd = vi.fn();
  function Host() {
    const [items, setItems] = useState([first, second]);
    const [expanded, setExpanded] = useState<string | null>(null);
    return <CatalogManualItemsEditor valueType="Text" items={items} culture={culture} original="es" canManage={canManage} expandedKey={expanded}
      onExpand={setExpanded} onChange={item => { onChange(item); setItems(current => current.map(row => row.localId === item.localId ? item : row)); }}
      onAdd={onAdd} onMove={vi.fn()} />;
  }
  await act(async () => { renderWithProviders(<Host />); });
  return { user: userEvent.setup(), onChange, onAdd };
}
describe("Chosen manual catalog editor K3", () => {
  it("edits only the selected language while preserving identity and other texts", async () => {
    const { user, onChange } = await mount("en");
    await user.click(screen.getByRole("button", { name: "Editar Pérez Hnos." }));
    const text = screen.getByRole("textbox", { name: "Texto" });
    expect(text).toHaveValue("");
    await waitFor(() => expect(text).toHaveFocus());
    await user.type(text, "Perez Brothers");
    const last = onChange.mock.lastCall?.[0] as CatalogManualItemValue;
    expect(last.itemId).toBe("saved-first");
    expect(last.label).toEqual({ es: "Pérez Hnos.", en: "Perez Brothers" });
    expect(last.detail).toEqual(first.detail);
    expect(last.code).toBe("C-001");
    expect(screen.getByText("South hardware")).toBeInTheDocument();
  });
  it("stages deactivation and reactivation without deleting the option or making an HTTP write", async () => {
    const { user, onChange } = await mount("es");
    await user.click(screen.getByRole("button", { name: "Editar Pérez Hnos." }));
    await user.click(screen.getByRole("checkbox", { name: "Activa" }));
    expect(onChange.mock.lastCall?.[0]).toEqual({ ...first, isActive: false });
    expect(screen.getByText("Pérez Hnos.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Listo" }));
    await user.click(screen.getByRole("button", { name: "Reactivar Pérez Hnos." }));
    expect(onChange.mock.lastCall?.[0]).toEqual(first);
  });
  it("returns focus to the same option's edit action when Done collapses its fields", async () => {
    const { user } = await mount("es");
    await user.click(screen.getByRole("button", { name: "Editar Pérez Hnos." }));
    await user.click(screen.getByRole("button", { name: "Listo" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Editar Pérez Hnos." })).toHaveFocus());
    expect(screen.queryByRole("textbox", { name: "Texto" })).not.toBeInTheDocument();
  });
  it("does not offer mutations without Manage and keeps the English fallback for display", async () => {
    const { onChange } = await mount("en", false);
    expect(screen.getByText("Pérez Hnos.")).toBeInTheDocument();
    expect(screen.getByText("South hardware")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agregar opción" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Pérez Hnos." })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});


it("keeps an edited option outside the current page and returns focus to Add when it is collapsed", async () => {
  const changed = vi.fn();
  function Host() {
    const [editing, setEditing] = useState(first);
    const [expanded, setExpanded] = useState<string | null>(first.localId);
    return <CatalogManualItemsEditor valueType="Text" items={[second]} editingItems={[editing]} culture="en" original="es" canManage expandedKey={expanded} onExpand={setExpanded} onChange={item => { changed(item); setEditing(item); }} onAdd={() => undefined}/>;
  }
  await act(async () => { renderWithProviders(<Host/>); });
  const text = screen.getByRole("textbox", { name: "Texto" });
  await waitFor(() => expect(text).toHaveFocus());
  await userEvent.type(text, "Historical branch");
  expect(changed).toHaveBeenLastCalledWith({ ...first, label: { es: first.label.es, en: "Historical branch" } });
  expect(screen.getByText("South hardware")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Listo" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Agregar opción" })).toHaveFocus());
  expect(screen.queryByRole("textbox", { name: "Texto" })).not.toBeInTheDocument();
});

vi.mock("@/shared/hooks/useMediaQuery",()=>({useMediaQuery:vi.fn(()=>false)}));
afterEach(()=>vi.mocked(useMediaQuery).mockReturnValue(false));
it("changes the inline text with the captured item identity and retains the other language", async()=>{
 vi.mocked(useMediaQuery).mockReturnValue(true); const change=vi.fn();
 renderWithProviders(<CatalogManualItemsEditor items={[first]} culture="es" original="es" valueType="Text" canManage expandedKey={null} onExpand={vi.fn()} onChange={change} onAdd={vi.fn()}/>);
 const input=screen.getByRole("textbox",{name:"Texto de la opción 1"});await userEvent.clear(input);
 expect(change).toHaveBeenLastCalledWith(expect.objectContaining({itemId:"saved-first",localId:"first",label:{es:"",en:""}}));
 expect(screen.getByRole("textbox",{name:"Código de la opción 1"})).toHaveValue("C-001");
});
it("bulk changes only the selected current page and clears selection on another page",async()=>{
 const change=vi.fn();const props={culture:"es" as const,original:"es" as const,valueType:"Text" as const,canManage:true,expandedKey:null,onExpand:vi.fn(),onChange:change,onAdd:vi.fn()};
 const {rerender}=renderWithProviders(<CatalogManualItemsEditor {...props} items={[first,second]}/>);const user=userEvent.setup();
 await user.click(screen.getByRole("checkbox",{name:"Seleccionar Pérez Hnos."}));
 await user.click(screen.getByRole("button",{name:"Dar de baja"}));
 expect(change.mock.calls.map(([item])=>item.localId)).toEqual(["first"]);expect(change.mock.calls[0]![0].isActive).toBe(false);
 rerender(<CatalogManualItemsEditor {...props} items={[second]}/>);
 expect(screen.queryByRole("button",{name:"Dar de baja"})).not.toBeInTheDocument();
 expect(screen.getByRole("checkbox",{name:"Seleccionar Ferretería Sur"})).not.toBeChecked();
 await user.click(screen.getByRole("checkbox",{name:"Seleccionar opciones de esta página"}));
 await user.click(screen.getByRole("button",{name:"Reactivar"}));
 expect(change.mock.calls.map(([item])=>item.localId)).toEqual(["first","second"]);
});
const confirmed = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type: "boolean" as const, required: true, name: { es: "Confirmado" } };
const inactive: CatalogManualItemValue = { ...first, isActive: false, fields: { [confirmed.id]: "true" } };
it("presents a required field as optional on an inactive option, as the server only requires it on active ones", async () => {
  const change = vi.fn(); const props = { fields: [confirmed], culture: "es" as const, original: "es" as const, valueType: "Text" as const, canManage: true, expandedKey: "first", onExpand: vi.fn(), onChange: change, onAdd: vi.fn() };
  const { rerender } = renderWithProviders(<CatalogManualItemsEditor {...props} items={[inactive]} />);
  expect(screen.getByText("Confirmado", { selector: "label" })).toHaveTextContent(/^Confirmado$/);
  await userEvent.click(screen.getByRole("button", { name: "Limpiar Confirmado" }));
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ localId: "first", fields: { [confirmed.id]: null } }));
  rerender(<CatalogManualItemsEditor {...props} items={[{ ...inactive, isActive: true }]} />);
  expect(screen.getByText("Confirmado", { selector: "label" })).toHaveTextContent(/^Confirmado \*$/);
  expect(screen.queryByRole("button", { name: "Limpiar Confirmado" })).not.toBeInTheDocument();
});
it("lets an inactive option clear a required boolean from its table cell", async () => {
  vi.mocked(useMediaQuery).mockReturnValue(true); const change = vi.fn();
  renderWithProviders(<CatalogManualItemsEditor items={[{ ...inactive, fields: { [confirmed.id]: "false" } }]} fields={[confirmed]} culture="es" original="es" valueType="Text" canManage expandedKey={null} onExpand={vi.fn()} onChange={change} onAdd={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Limpiar Fila 1 · Confirmado" }));
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ localId: "first", fields: { [confirmed.id]: null } }));
});
it("shows read-only typed values with one format per type", () => {
  const day = { ...newCatalogField("day", 1), id: "01990000-0000-7000-8000-000000000002", type: "date" as const, name: { es: "Entrega" } };
  const amount = { ...newCatalogField("amount", 2), id: "01990000-0000-7000-8000-000000000003", type: "decimal" as const, name: { es: "Importe" } };
  const row: CatalogManualItemValue = { ...first, value: "2027-03-15", fields: { [day.id]: "2027-03-16", [amount.id]: "1500,5" } };
  renderWithProviders(<CatalogManualItemsEditor items={[row]} fields={[day, amount]} scope={{ actorId: "actor", culture: "es", permissions: ["formcatalogs.read"] }} culture="es" original="es" valueType="Date" canManage={false} expandedKey={null} onExpand={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} />);
  expect(screen.getByRole("cell", { name: "15/03/2027" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "16/03/2027" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "1.500,5" })).toBeInTheDocument();
});
it("shows the read-only value of a number catalog with the shared format, not as written", () => {
  renderWithProviders(<CatalogManualItemsEditor items={[{ ...first, value: "1500,5" }]} scope={{ actorId: "actor", culture: "es", permissions: ["formcatalogs.read"] }} culture="es" original="es" valueType="Decimal" canManage={false} expandedKey={null} onExpand={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} />);
  expect(screen.getByRole("cell", { name: "1.500,5" })).toBeInTheDocument();
});
it("formats read-only typed values in the draft culture while the texts are shown in another language", () => {
  const day = { ...newCatalogField("day", 1), id: "01990000-0000-7000-8000-000000000002", type: "date" as const, name: { es: "Entrega" } };
  const row: CatalogManualItemValue = { ...first, value: "2027-03-15", fields: { [day.id]: "2027-03-16" } };
  renderWithProviders(<CatalogManualItemsEditor items={[row]} fields={[day]} scope={{ actorId: "actor", culture: "es", permissions: ["formcatalogs.read"] }} culture="en" original="es" valueType="Date" canManage={false} expandedKey={null} onExpand={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} />);
  expect(screen.getByRole("cell", { name: "15/03/2027" })).toBeInTheDocument();
  expect(screen.getByRole("cell", { name: "16/03/2027" })).toBeInTheDocument();
});
it("describes a cell error on its row with the row, field, value and reason", () => {
  vi.mocked(useMediaQuery).mockReturnValue(true);
  const term = { ...newCatalogField("term", 1), id: "01990000-0000-7000-8000-000000000004", type: "integer" as const, name: { es: "Plazo de pago (días)" } };
  const row: CatalogManualItemValue = { ...first, fields: { [term.id]: "30 días" } };
  renderWithProviders(<CatalogManualItemsEditor items={[row, second]} fields={[term]} errors={{ first: { ["fields." + term.id]: ["«30 días» no es un número entero."] } }} culture="es" original="es" valueType="Text" canManage expandedKey={null} onExpand={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} />);
  const line = "Fila 1 · Plazo de pago (días): «30 días» no es un número entero.";
  const cell = screen.getByRole("textbox", { name: "Fila 1 · Plazo de pago (días)" });
  expect(cell).toBeInvalid();
  expect(cell).toHaveAccessibleDescription(line);
  const rows = screen.getAllByRole("row");
  expect(within(rows[2]!).getByRole("status")).toHaveTextContent(line);
  expect(screen.getAllByText(/no es un número entero/)).toHaveLength(1);
  expect(screen.getByRole("textbox", { name: "Fila 2 · Plazo de pago (días)" })).toBeValid();
});
it("names a new option's cell and error line by its text, never by a row number that can be another row's", () => {
  vi.mocked(useMediaQuery).mockReturnValue(true);
  const term = { ...newCatalogField("term", 1), id: "01990000-0000-7000-8000-000000000004", type: "integer" as const, name: { es: "Plazo" } };
  // A later page whose first saved row is #2; the new options go after it, without a position.
  const later: CatalogManualItemValue = { ...first, position: 2 };
  const added: CatalogManualItemValue = { ...first, localId: "added", itemId: null, position: null, code: "", label: { es: "Centro", en: null }, fields: { [term.id]: "30 días" } };
  const blank: CatalogManualItemValue = { ...added, localId: "blank", label: { es: null, en: null }, fields: { [term.id]: "x" } };
  const errors = { added: { ["fields." + term.id]: ["«30 días» no es un número entero."] }, blank: { ["fields." + term.id]: ["«x» no es un número entero."] } };
  renderWithProviders(<CatalogManualItemsEditor items={[later, added, blank]} fields={[term]} errors={errors} culture="es" original="es" valueType="Text" canManage expandedKey={null} onExpand={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} />);
  expect(screen.getAllByRole("status").map(line => line.textContent)).toEqual(["Centro · Plazo: «30 días» no es un número entero.", "Nueva opción · Plazo: «x» no es un número entero."]);
  expect(screen.getByRole("textbox", { name: "Centro · Plazo" })).toHaveAccessibleDescription("Centro · Plazo: «30 días» no es un número entero.");
  expect(screen.getByRole("textbox", { name: "Nueva opción · Plazo" })).toHaveAccessibleDescription("Nueva opción · Plazo: «x» no es un número entero.");
  expect(screen.getAllByRole("textbox", { name: /^Fila \d+ · Plazo$/ }).map(cell => cell.getAttribute("aria-label"))).toEqual(["Fila 2 · Plazo"]);
});
it("announces a row's value error without interrupting, since its text changes with each keystroke", () => {
  vi.mocked(useMediaQuery).mockReturnValue(true);
  const term = { ...newCatalogField("term", 1), id: "01990000-0000-7000-8000-000000000004", type: "integer" as const, name: { es: "Plazo de pago (días)" } };
  const errors = (value: string) => ({ first: { ["fields." + term.id]: [`«${value}» no es un número entero.`] } });
  const props = { items: [{ ...first, fields: { [term.id]: "30 d" } }], fields: [term], culture: "es" as const, original: "es" as const, valueType: "Text" as const, canManage: true, expandedKey: null, onExpand: vi.fn(), onChange: vi.fn(), onAdd: vi.fn() };
  const { rerender } = renderWithProviders(<CatalogManualItemsEditor {...props} errors={errors("30 d")} />);
  const line = screen.getByRole("status");
  expect(line).toHaveTextContent("Fila 1 · Plazo de pago (días): «30 d» no es un número entero.");
  rerender(<CatalogManualItemsEditor {...props} items={[{ ...first, fields: { [term.id]: "30 dí" } }]} errors={errors("30 dí")} />);
  expect(screen.getByRole("status")).toBe(line);
  expect(line).toHaveTextContent("Fila 1 · Plazo de pago (días): «30 dí» no es un número entero.");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("announces a value error in the phone's option editor without interrupting, since its text changes with each keystroke", () => {
  vi.mocked(useMediaQuery).mockReturnValue(false);
  const term = { ...newCatalogField("term", 1), id: "01990000-0000-7000-8000-000000000004", type: "integer" as const, name: { es: "Plazo" } };
  const errors = (value: string) => ({ first: { ["fields." + term.id]: [`«${value}» no es un número entero.`] } });
  const props = { fields: [term], culture: "es" as const, original: "es" as const, valueType: "Text" as const, canManage: true, expandedKey: "first", onExpand: vi.fn(), onChange: vi.fn(), onAdd: vi.fn() };
  const { rerender } = renderWithProviders(<CatalogManualItemsEditor {...props} items={[{ ...first, fields: { [term.id]: "30 d" } }]} errors={errors("30 d")} />);
  const input = screen.getByRole("textbox", { name: "Plazo" });
  expect(input).toHaveAccessibleDescription("«30 d» no es un número entero.");
  rerender(<CatalogManualItemsEditor {...props} items={[{ ...first, fields: { [term.id]: "30 dí" } }]} errors={errors("30 dí")} />);
  const message = document.getElementById(input.getAttribute("aria-describedby")!)!;
  expect(message).toHaveTextContent("«30 dí» no es un número entero.");
  expect(message).toHaveAttribute("role", "status");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
it("reports leaving a control of the table or of the option editor by its option and error path", async () => {
  vi.mocked(useMediaQuery).mockReturnValue(true); const left = vi.fn(); const user = userEvent.setup();
  const term = { ...newCatalogField("term", 1), id: "01990000-0000-7000-8000-000000000004", type: "integer" as const, name: { es: "Plazo" } };
  renderWithProviders(<CatalogManualItemsEditor items={[first, second]} fields={[term]} scope={{ actorId: "actor", culture: "es", permissions: ["formcatalogs.read", "formcatalogs.manage"] }} culture="es" original="es" valueType="Text" canManage expandedKey="first" onExpand={vi.fn()} onChange={vi.fn()} onFieldBlur={left} onAdd={vi.fn()} />);
  // The option editor opens with the cursor in its text: leaving it before typing does not count.
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Texto" })).toHaveFocus());
  await user.click(screen.getByRole("textbox", { name: "Código de la opción 2" }));
  expect(left).not.toHaveBeenCalled();
  await user.click(screen.getByRole("textbox", { name: "Fila 2 · Plazo" }));
  await user.click(screen.getByRole("textbox", { name: "Plazo" }));
  await user.click(screen.getByRole("textbox", { name: "Código" }));
  await user.click(screen.getByRole("textbox", { name: "Texto de la opción 1" }));
  expect(left.mock.calls).toEqual([["second", "code"], ["second", "fields." + term.id], ["first", "fields." + term.id], ["first", "code"]]);
});
it("shows an option written only in the other language with its text as reference", async () => {
  // An English catalog with the menu in Spanish: the option has no Spanish translation yet.
  const north: CatalogManualItemValue = { ...first, localId: "north", itemId: "saved-north", label: { en: "North" }, detail: { en: "North side" }, code: "N" };
  function Host() {
    const [expanded, setExpanded] = useState<string | null>(null);
    return <CatalogManualItemsEditor valueType="Text" items={[north]} culture="es" original="en" canManage expandedKey={expanded} onExpand={setExpanded} onChange={vi.fn()} onAdd={vi.fn()} />;
  }
  await act(async () => { renderWithProviders(<Host />); });
  const user = userEvent.setup();
  expect(screen.getByText("North")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Editar North" }));
  const text = screen.getByRole("textbox", { name: "Texto" });
  expect(text).toHaveValue(""); expect(text).toHaveAttribute("placeholder", "Sin traducir");
  expect(text).toHaveAccessibleDescription("Original (Inglés): North");
  expect(screen.getByRole("textbox", { name: "Detalle" })).toHaveAccessibleDescription("Original (Inglés): North side");
  cleanup();
  // The table edited in place has no room for a hint: the original is the cell's placeholder.
  vi.mocked(useMediaQuery).mockReturnValue(true);
  renderWithProviders(<CatalogManualItemsEditor valueType="Text" items={[north]} culture="es" original="en" canManage expandedKey={null} onExpand={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} />);
  expect(screen.getByRole("textbox", { name: "Texto de la opción 1" })).toHaveValue("");
  expect(screen.getByRole("textbox", { name: "Texto de la opción 1" })).toHaveAttribute("placeholder", "North");
  expect(screen.getByRole("textbox", { name: "Detalle de la opción 1" })).toHaveAttribute("placeholder", "North side");
});
it("shows a missing original text under the text on screen, with its language", () => {
  vi.mocked(useMediaQuery).mockReturnValue(true);
  const errors = { first: { "text.en": ["Completá este campo."] } };
  renderWithProviders(<CatalogManualItemsEditor valueType="Text" items={[first]} errors={errors} culture="es" original="en" canManage expandedKey="first" onExpand={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} />);
  expect(screen.getByRole("textbox", { name: "Texto de la opción 1" })).toHaveAccessibleDescription("En inglés: Completá este campo.");
  expect(screen.getByRole("textbox", { name: "Texto" })).toHaveAccessibleDescription("En inglés: Completá este campo.");
  expect(screen.getByRole("textbox", { name: "Texto" })).toHaveAttribute("aria-invalid", "true");
});
it("shows the type and range of an extra field in the option editor", () => {
  const term = { ...newCatalogField("term", 1), id: "01990000-0000-7000-8000-000000000004", type: "integer" as const, name: { es: "Plazo de pago (días)" }, min: "0", max: "180" };
  const due = { ...newCatalogField("due", 2), id: "01990000-0000-7000-8000-000000000005", type: "date" as const, name: { es: "Vence" }, max: "2027-03-15" };
  const amount = { ...newCatalogField("amount", 3), id: "01990000-0000-7000-8000-000000000006", type: "decimal" as const, name: { es: "Importe" } };
  renderWithProviders(<CatalogManualItemsEditor items={[first]} fields={[term, due, amount]} scope={{ actorId: "actor", culture: "es", permissions: ["formcatalogs.read", "formcatalogs.manage"] }} culture="es" original="es" valueType="Text" canManage expandedKey="first" onExpand={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} />);
  expect(screen.getByRole("textbox", { name: "Plazo de pago (días)" })).toHaveAccessibleDescription("Entero, de 0 a 180.");
  expect(screen.getByLabelText("Vence")).toHaveAccessibleDescription("Fecha, hasta 15/03/2027.");
  expect(screen.getByRole("textbox", { name: "Importe" })).toHaveAccessibleDescription("Número decimal.");
});
