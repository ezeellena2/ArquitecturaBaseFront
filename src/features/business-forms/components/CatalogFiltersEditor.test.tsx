import { useState } from "react";
import { act, cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogFiltersEditor, type CatalogFilterColumn, type CatalogFiltersEditorValue } from "./CatalogFiltersEditor";

// Role choices retain their IDs while labels are supplied by current metadata.
const supervisorId = "01990000-0000-7000-8000-000000000601";
const technicianId = "01990000-0000-7000-8000-000000000602";
const columns: readonly CatalogFilterColumn[] = [
  { key: "name", label: "nombre", operators: [{ key: "contains", label: "contiene" }, { key: "equals", label: "es" }] },
  { key: "role", label: "rol", operators: [{ key: "has", label: "tiene el rol" }], choices: [{ key: supervisorId, label: "Supervisor" }, { key: technicianId, label: "Técnico" }] },
  { key: "active", label: "activo", operators: [{ key: "equals", label: "es" }], choices: [{ key: "true", label: "Sí" }, { key: "false", label: "No" }] },
];
const initial: CatalogFiltersEditorValue = { textColumn: "name", detailColumn: "role", conditions: [
  { localId: "active", column: "active", operator: "equals", value: "true" },
  { localId: "role", column: "role", operator: "has", value: supervisorId },
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
    await user.selectOptions(screen.getByRole("combobox", { name: "Valor de la condición 2" }), technicianId);
    const last = onChange.mock.lastCall?.[0] as CatalogFiltersEditorValue;
    expect(last.conditions).toEqual([initial.conditions[0], { ...initial.conditions[1], value: technicianId }]);
    expect(last.excludeRecipient).toBe(true);
    expect(last.detailColumn).toBe("role");
    expect(last.sortColumn).toBe("name");
    expect(initial.conditions[1]?.value).toBe(supervisorId);
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

it("retains the stored role identity without exposing it when metadata is unavailable", async () => {
  const unavailableColumns = columns.map(column => column.key === "role" ? { ...column, choices: [] } : column);
  await act(async () => { renderWithProviders(<CatalogFiltersEditor view={{ key: "users", label: "Usuarios" }} columns={unavailableColumns} value={initial} canManage={false} onChange={() => {}} />); });
  expect(screen.getByRole("combobox", { name: "Valor de la condición 2" })).toHaveValue(supervisorId);
  expect(screen.getByRole("option", { name: "Valor no disponible" })).toBeInTheDocument();
  expect(screen.queryByText(supervisorId, { exact: true })).not.toBeInTheDocument();
});

it("uses the current role name without changing the stored role identity", async () => {
  const onChange = vi.fn();
  const editor = (choices: readonly CatalogFilterColumn[]) => <CatalogFiltersEditor view={{ key: "users", label: "Usuarios" }} columns={choices} value={initial} canManage onChange={onChange} />;
  let mounted: ReturnType<typeof renderWithProviders>;
  await act(async () => { mounted = renderWithProviders(editor(columns)); });
  const role = screen.getByRole("combobox", { name: "Valor de la condición 2" });
  expect(role).toHaveValue(supervisorId);
  expect(screen.getByRole("option", { name: "Supervisor" })).toBeInTheDocument();
  const renamed = columns.map(column => column.key === "role" ? { ...column, choices: [{ key: supervisorId, label: "Encargado de equipo" }, { key: technicianId, label: "Técnico" }] } : column);
  await act(async () => { mounted!.rerender(editor(renamed)); });
  expect(role).toHaveValue(supervisorId);
  expect(screen.getByRole("option", { name: "Encargado de equipo" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Supervisor" })).not.toBeInTheDocument();
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.setup().selectOptions(role, technicianId);
  expect(onChange.mock.lastCall?.[0].conditions[1]).toMatchObject({ column: "role", value: technicianId });
});
