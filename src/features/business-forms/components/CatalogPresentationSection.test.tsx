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

it("shows title and description checks for each catalog language from the server", async () => {
  const example = (n: number, title: string) => ({ itemId: "01990000-0000-7000-8000-00000000010" + n, title });
  const check = { cultures: [
    { culture: "es" as const, titleTooLongCount: 41, titleExamples: [example(1, "Distribuidora del Litoral Norte"), example(2, "Ferretería Industrial del Centro"), example(3, "Repuestos y Servicios del Oeste")], descriptionTooLongCount: 0, descriptionExamples: [] },
    { culture: "en" as const, titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 2, descriptionExamples: [example(4, "North"), example(5, "South")] },
  ] };
  // The loaded page has one long title of its own: with the server check, the section does not count locally.
  const long = { localId: "row", itemId: null, code: "N", label: { es: "Una opción con un texto que supera treinta" }, detail: {}, value: null, fields: {}, isActive: true, position: null };
  await act(async () => { renderWithProviders(<CatalogPresentationSection value={null} fields={[]} items={[long]} valueType="Text" culture="es" readOnly={false} check={check} onChange={() => undefined} />); });
  expect(screen.getByText("En español: 41 opciones superan los 30 caracteres del título.")).toBeInTheDocument();
  for (const title of ["Distribuidora del Litoral Norte", "Ferretería Industrial del Centro", "Repuestos y Servicios del Oeste"]) expect(screen.getByText(title)).toBeInTheDocument();
  expect(screen.getByText("y 38 más")).toBeInTheDocument();
  expect(screen.getByText("En inglés: 2 opciones superan los 300 caracteres de la descripción.")).toBeInTheDocument();
  expect(screen.getByText("North")).toBeInTheDocument();
  expect(screen.queryByText(/En inglés: .* del título/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Podés guardar/)).not.toBeInTheDocument();
});
