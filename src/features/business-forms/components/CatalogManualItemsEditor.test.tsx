import { useState } from "react";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
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
    return <CatalogManualItemsEditor valueType="Text" items={items} culture={culture} canManage={canManage} expandedKey={expanded}
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
    return <CatalogManualItemsEditor valueType="Text" items={[second]} editingItems={[editing]} culture="en" canManage expandedKey={expanded} onExpand={setExpanded} onChange={item => { changed(item); setEditing(item); }} onAdd={() => undefined}/>;
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
 renderWithProviders(<CatalogManualItemsEditor items={[first]} culture="es" valueType="Text" canManage expandedKey={null} onExpand={vi.fn()} onChange={change} onAdd={vi.fn()}/>);
 const input=screen.getByRole("textbox",{name:"Texto de la opción 1"});await userEvent.clear(input);
 expect(change).toHaveBeenLastCalledWith(expect.objectContaining({itemId:"saved-first",localId:"first",label:{es:"",en:""}}));
 expect(screen.getByRole("textbox",{name:"Código de la opción 1"})).toHaveValue("C-001");
});
it("bulk changes only the selected current page and clears selection on another page",async()=>{
 const change=vi.fn();const props={culture:"es" as const,valueType:"Text" as const,canManage:true,expandedKey:null,onExpand:vi.fn(),onChange:change,onAdd:vi.fn()};
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
  const change = vi.fn(); const props = { fields: [confirmed], culture: "es" as const, valueType: "Text" as const, canManage: true, expandedKey: "first", onExpand: vi.fn(), onChange: change, onAdd: vi.fn() };
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
  renderWithProviders(<CatalogManualItemsEditor items={[{ ...inactive, fields: { [confirmed.id]: "false" } }]} fields={[confirmed]} culture="es" valueType="Text" canManage expandedKey={null} onExpand={vi.fn()} onChange={change} onAdd={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Limpiar Fila 1 · Confirmado" }));
  expect(change).toHaveBeenLastCalledWith(expect.objectContaining({ localId: "first", fields: { [confirmed.id]: null } }));
});
