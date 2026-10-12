import { useState } from "react";
import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogFiltersEditor, type CatalogFilterColumn, type CatalogFiltersEditorValue } from "./CatalogFiltersEditor";

// Explicit UI choices supplied by an authorized view, not a final backend grammar or payload.
const columns: readonly CatalogFilterColumn[] = [
  { key: "name", label: "nombre", operators: [{ key: "contains", label: "contiene" }, { key: "equals", label: "es" }] },
  { key: "role", label: "rol", operators: [{ key: "equals", label: "es" }], choices: [{ key: "supervisor", label: "Supervisor" }, { key: "technician", label: "Técnico" }] },
  { key: "active", label: "activo", operators: [{ key: "equals", label: "es" }], choices: [{ key: "true", label: "Sí" }, { key: "false", label: "No" }] },
];
const initial: CatalogFiltersEditorValue = { textColumn: "name", detailColumn: "role", conditions: [
  { localId: "active", column: "active", operator: "equals", value: "true" },
  { localId: "role", column: "role", operator: "equals", value: "supervisor" },
], excludeRecipient: true, sortColumn: "name", sortDescending: false };
afterEach(async () => { cleanup(); await act(async () => { await i18n.changeLanguage("es"); }); });
async function mount(canManage = true) {
  const onChange = vi.fn();
  function Host() {
    const [value, setValue] = useState(initial);
    return <CatalogFiltersEditor view={{ key: "users", label: "Usuarios" }} columns={columns} value={value} canManage={canManage}
      onChange={next => { onChange(next); setValue(next); }} />;
  }
  await act(async () => { renderWithProviders(<Host />); });
  return { user: userEvent.setup(), onChange };
}
describe("Chosen Users filters editor K4", () => {
  it("offers only the supplied columns and preserves the selected recipient rule", async () => {
    const { user, onChange } = await mount();
    expect(screen.queryByRole("option", { name: /correo|contraseña/i })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Texto de cada opción" }), "role");
    expect(onChange.mock.lastCall?.[0]).toEqual({ ...initial, textColumn: "role" });
    expect(screen.getByRole("checkbox", { name: "Sin incluir a quien lo recibe" })).toBeChecked();
  });
  it("changes one condition's value without replacing other identities or configuration", async () => {
    const { user, onChange } = await mount();
    await user.selectOptions(screen.getByRole("combobox", { name: "Valor de la condición 2" }), "technician");
    const last = onChange.mock.lastCall?.[0] as CatalogFiltersEditorValue;
    expect(last.conditions).toEqual([initial.conditions[0], { ...initial.conditions[1], value: "technician" }]);
    expect(last.excludeRecipient).toBe(true);
    expect(last.detailColumn).toBe("role");
    expect(last.sortColumn).toBe("name");
    expect(initial.conditions[1]?.value).toBe("supervisor");
  });
  it("resets an incompatible value only for the column that changed using supplied choices", async () => {
    const { user, onChange } = await mount();
    await user.selectOptions(screen.getByRole("combobox", { name: "Columna de la condición 2" }), "name");
    const last = onChange.mock.lastCall?.[0] as CatalogFiltersEditorValue;
    expect(last.conditions[0]).toEqual(initial.conditions[0]);
    expect(last.conditions[1]).toEqual({ localId: "role", column: "name", operator: "contains", value: "" });
  });
  it("removes only the chosen condition and adds a new local identity", async () => {
    const { user, onChange } = await mount();
    await user.click(screen.getByRole("button", { name: "Quitar condición 1" }));
    expect(onChange.mock.lastCall?.[0].conditions).toEqual([initial.conditions[1]]);
    await user.click(screen.getByRole("button", { name: "Agregar condición" }));
    const last = onChange.mock.lastCall?.[0] as CatalogFiltersEditorValue;
    expect(last.conditions[0]).toEqual(initial.conditions[1]);
    expect(last.conditions[1]?.localId).not.toBe("role");
    expect(last.conditions[1]?.localId).toBeTruthy();
  });
  it("keeps configuration readable and offers no mutations without Manage", async () => {
    const { onChange } = await mount(false);
    expect(screen.getByRole("combobox", { name: "Texto de cada opción" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Sin incluir a quien lo recibe" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Agregar condición" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar condición 1" })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

it("keeps a retired column visible as unavailable instead of presenting a different selected column", async () => {
  const value = { ...initial, textColumn: "retired", detailColumn: "retired", sortColumn: "retired", conditions: [{ localId: "retired-row", column: "retired", operator: "equals", value: "Old value" }] };
  await act(async () => { renderWithProviders(<CatalogFiltersEditor view={{ key: "users", label: "Usuarios" }} columns={columns} value={value} canManage={false} onChange={() => {}} />); });
  expect(screen.getByRole("combobox", { name: "Texto de cada opción" })).toHaveValue("retired");
  expect(screen.getByRole("combobox", { name: "Detalle" })).toHaveValue("retired");
  expect(screen.getByRole("combobox", { name: "Orden" })).toHaveValue("retired");
  expect(screen.getByRole("combobox", { name: "Columna de la condición 1" })).toHaveValue("retired");
  expect(screen.getAllByRole("option", { name: "Columna no disponible" })).toHaveLength(4);
});

it("shows the stored role value when unavailable source metadata has no role choices", async () => {
  const unavailableColumns = columns.map(column => column.key === "role" ? { ...column, choices: [] } : column);
  await act(async () => { renderWithProviders(<CatalogFiltersEditor view={{ key: "users", label: "Usuarios" }} columns={unavailableColumns} value={initial} canManage={false} onChange={() => {}} />); });
  expect(screen.getByRole("combobox", { name: "Valor de la condición 2" })).toHaveValue("supervisor"); expect(screen.getByRole("option", { name: "supervisor" })).toBeInTheDocument();
});
