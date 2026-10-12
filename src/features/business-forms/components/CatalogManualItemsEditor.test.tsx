import { useState } from "react";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import { CatalogManualItemsEditor } from "./CatalogManualItemsEditor";

const first: CatalogManualItemValue = { localId: "first", itemId: "saved-first", label: { es: "Pérez Hnos.", en: "" }, detail: { es: "Av. Colón 1234", en: null }, code: "C-001", isActive: true, position: 1 };
const second: CatalogManualItemValue = { ...first, localId: "second", itemId: "saved-second", label: { es: "Ferretería Sur", en: "South hardware" }, code: "C-002", position: 2 };
afterEach(async () => { cleanup(); await act(async () => { await i18n.changeLanguage("es"); }); });
async function mount(culture: "es" | "en", canManage = true) {
  const onChange = vi.fn(); const onAdd = vi.fn();
  function Host() {
    const [items, setItems] = useState([first, second]);
    const [expanded, setExpanded] = useState<string | null>(null);
    return <CatalogManualItemsEditor items={items} culture={culture} canManage={canManage} expandedKey={expanded}
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
