import { useState } from "react";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogPresentationSection } from "./CatalogPresentationSection";
import { newCatalogField } from "../catalogFields";
import type { CatalogPresentation } from "../api/catalogResponse";

const field = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000002", name: { es: "CUIT" } };
function Harness() {
  const [value, setValue] = useState<CatalogPresentation | null>(null);
  return <CatalogPresentationSection value={value} fields={[field, { ...newCatalogField("new", 2), name: { es: "Teléfono" } }]} items={[{ localId: "row", itemId: null, code: "N", label: { es: "Frío Sur" }, detail: { es: "Disponible" }, value: null, fields: { [field.id]: "30-71234567-8" }, isActive: true, position: null }]} valueType="Text" culture="es" readOnly={false} onChange={setValue} />;
}
it("adds selected data to the description and keeps unsaved fields unavailable", async () => {
  await act(async () => { renderWithProviders(<Harness />); });
  const description = screen.getByRole("combobox", { name: "Descripción · hasta 300" });
  expect(within(description).getByRole("option", { name: /Teléfono.*Guardá para cargar valores/ })).toBeDisabled();
  await userEvent.selectOptions(description, field.id);
  expect(screen.getByText("Disponible · 30-71234567-8")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Quitar Texto de Título · hasta 30 caracteres" })).toBeDisabled();
});
