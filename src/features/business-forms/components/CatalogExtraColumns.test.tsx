import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { newCatalogField } from "../catalogFields";
import { CatalogManualItemsEditor } from "./CatalogManualItemsEditor";

it("shows extra columns by identity and lets the reader hide one without changing values", async () => {
  const field = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", name: { es: "CUIT" } };
  const change = vi.fn();
  await act(async () => { renderWithProviders(<CatalogManualItemsEditor items={[{ localId: "row", itemId: "saved-row", code: "N", label: { es: "Norte" }, detail: {}, value: null, fields: { [field.id]: "30-71234567-8" }, isActive: true, position: 1 }]} fields={[field]} culture="es" original="es" valueType="Text" canManage={false} onEdit={vi.fn()} onChange={change} onAdd={vi.fn()} />); });
  expect(screen.getByRole("columnheader", { name: "CUIT" })).toBeInTheDocument();
  expect(screen.getByText("30-71234567-8")).toBeInTheDocument();
  screen.getByRole("button", { name: "Columnas" }).focus();
  await userEvent.keyboard("{Enter}");
  await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "CUIT" }));
  expect(screen.queryByRole("columnheader", { name: "CUIT" })).not.toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
});

it("names the column of an unsaved field only by the field", async () => {
  const field = { ...newCatalogField("new", 1), name: { es: "Teléfono" } };
  await act(async () => { renderWithProviders(<CatalogManualItemsEditor items={[{ localId: "row", itemId: "saved-row", code: "N", label: { es: "Norte" }, detail: {}, value: null, isActive: true, position: 1 }]} fields={[field]} culture="es" original="es" valueType="Text" canManage onEdit={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} />); });
  // Why its cells take no values yet is the help of each cell; «Listo» of the fields says to save.
  expect(screen.getByRole("columnheader", { name: "Teléfono" })).toBeInTheDocument();
  expect(screen.queryByText("Guardá para cargar valores", { selector: "th *" })).not.toBeInTheDocument();
});

it("shows a saved value that is not yet a yes or no as it is while a change to boolean is pending", async () => {
  const field = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", name: { es: "Usa GPS" }, type: "boolean" as const };
  await act(async () => { renderWithProviders(<CatalogManualItemsEditor items={[{ localId: "row", itemId: "saved-row", code: "N", label: { es: "Norte" }, detail: {}, value: null, fields: { [field.id]: "Con GPS" }, isActive: true, position: 1 }]} fields={[field]} culture="es" original="es" valueType="Text" canManage={false} onEdit={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} />); });
  expect(screen.getByRole("cell", { name: "Con GPS" })).toBeInTheDocument();
  expect(screen.queryByRole("cell", { name: "No" })).not.toBeInTheDocument();
});

it("aligns the row number, the numeric fields and the value of the options to the right", async () => {
  const days = { ...newCatalogField("days", 1), id: "01990000-0000-7000-8000-000000000002", name: { es: "Plazo" }, type: "integer" as const };
  const taxId = { ...newCatalogField("tax", 2), id: "01990000-0000-7000-8000-000000000003", name: { es: "CUIT" } };
  await act(async () => { renderWithProviders(<CatalogManualItemsEditor items={[{ localId: "row", itemId: "saved-row", code: "N", label: { es: "Norte" }, detail: {}, value: "1500.5", fields: { [days.id]: "30", [taxId.id]: "30-71234567-8" }, isActive: true, position: 1 }]} fields={[days, taxId]} culture="es" original="es" valueType="Decimal" canManage={false} onEdit={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} />); });
  for (const name of ["#", "Plazo", "Valor"]) expect(screen.getByRole("columnheader", { name })).toHaveClass("text-right");
  for (const name of ["1", "30", "1.500,5"]) expect(screen.getByRole("cell", { name })).toHaveClass("text-right");
  expect(screen.getByRole("columnheader", { name: "CUIT" })).not.toHaveClass("text-right");
  expect(screen.getByRole("cell", { name: "30-71234567-8" })).not.toHaveClass("text-right");
});
