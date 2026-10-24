import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { newCatalogField } from "../catalogFields";
import { CatalogManualItemsEditor } from "./CatalogManualItemsEditor";

it("shows extra columns by identity and lets the reader hide one without changing values", async () => {
  const field = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", name: { es: "CUIT" } };
  const change = vi.fn();
  await act(async () => { renderWithProviders(<CatalogManualItemsEditor items={[{ localId: "row", itemId: "saved-row", code: "N", label: { es: "Norte" }, detail: {}, value: null, fields: { [field.id]: "30-71234567-8" }, isActive: true, position: 1 }]} fields={[field]} culture="es" original="es" valueType="Text" canManage={false} expandedKey={null} onExpand={vi.fn()} onChange={change} onAdd={vi.fn()} />); });
  expect(screen.getByRole("columnheader", { name: "CUIT" })).toBeInTheDocument();
  expect(screen.getByText("30-71234567-8")).toBeInTheDocument();
  screen.getByRole("button", { name: "Campos" }).focus();
  await userEvent.keyboard("{Enter}");
  await userEvent.click(screen.getByRole("menuitemcheckbox", { name: "CUIT" }));
  expect(screen.queryByRole("columnheader", { name: "CUIT" })).not.toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
});

it("shows a saved value that is not yet a yes or no as it is while a change to boolean is pending", async () => {
  const field = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", name: { es: "Usa GPS" }, type: "boolean" as const };
  await act(async () => { renderWithProviders(<CatalogManualItemsEditor items={[{ localId: "row", itemId: "saved-row", code: "N", label: { es: "Norte" }, detail: {}, value: null, fields: { [field.id]: "Con GPS" }, isActive: true, position: 1 }]} fields={[field]} culture="es" original="es" valueType="Text" canManage={false} expandedKey={null} onExpand={vi.fn()} onChange={vi.fn()} onAdd={vi.fn()} />); });
  expect(screen.getByRole("cell", { name: "Con GPS" })).toBeInTheDocument();
  expect(screen.queryByRole("cell", { name: "No" })).not.toBeInTheDocument();
});
