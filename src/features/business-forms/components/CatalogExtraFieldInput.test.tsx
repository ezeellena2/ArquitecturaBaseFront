import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { newCatalogField } from "../catalogFields";
import { CatalogExtraFieldInput } from "./CatalogExtraFieldInput";

it("keeps an unsaved field unavailable and explains why", async () => {
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={newCatalogField("new", 1)} label="CUIT" value={null} culture="es" readOnly={false} onChange={vi.fn()} />); });
  expect(screen.getByRole("textbox", { name: "CUIT" })).toBeDisabled();
  expect(screen.getByText("Guardá para cargar valores")).toBeInTheDocument();
});
it("preserves invalid typed input and reports an error on that cell without numeric coercion", async () => {
  const change = vi.fn();
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={{ ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type: "integer" }} label="Fila 1 · Plazo" value="30 días" culture="es" error="No es un número entero." readOnly={false} onChange={change} />); });
  const input = screen.getByRole("textbox", { name: "Fila 1 · Plazo" });
  expect(input).toHaveValue("30 días");
  expect(input).toHaveAttribute("aria-invalid", "true");
  await userEvent.type(input, "x");
  expect(change).toHaveBeenLastCalledWith("30 díasx");
});
it("can clear an optional boolean without turning the empty value into false", async () => {
  const change = vi.fn();
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={{ ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type: "boolean" }} label="Confirmado" value="false" culture="es" readOnly={false} onChange={change} />); });
  await userEvent.click(screen.getByRole("button", { name: "Limpiar Confirmado" }));
  expect(change).toHaveBeenCalledWith(null);
});
it("shows no option text once the source value is cleared", async () => {
  const sourceId = "01990000-0000-7000-8000-000000000040", centro = "01990000-0000-7000-8000-000000000041";
  server.use(http.get("/api/forms/catalogs/" + sourceId, () => HttpResponse.json({ valueType: "Text", proposal: null, id: sourceId, key: sourceId.replaceAll("-", ""), name: { es: "Zonas", en: "Zones" }, description: { es: "Zonas", en: "Zones" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 1, usageCount: null, unavailableReasonCode: null, filters: null, fields: [], presentation: null, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } })),
    http.get("/api/forms/catalogs/" + sourceId + "/items", () => HttpResponse.json({ items: [{ value: null, id: centro, code: "C", text: { es: "Centro", en: null }, detail: { es: null, en: null }, position: 1, isActive: true, fields: {}, fieldTexts: {} }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })));
  const field = { ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type: "catalog" as const, sourceCatalogId: sourceId };
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={field} scope={{ actorId: "author", culture: "es", permissions: ["formcatalogs.read", "formcatalogs.manage"] }} label="Fila 1 · Zona" value={null} texts={{ es: "Centro" }} culture="es" readOnly={false} onChange={vi.fn()} />); });
  const input = screen.getByRole("combobox", { name: "Fila 1 · Zona" });
  await waitFor(() => expect(input).toBeEnabled());
  expect(input).toHaveValue("");
});
it.each([["boolean", "Con GPS"], ["date", "30 días"]] as const)("shows a saved value the %s control cannot hold as it is until it is cleared", async (type, saved) => {
  const change = vi.fn();
  await act(async () => { renderWithProviders(<CatalogExtraFieldInput field={{ ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type, required: true }} label="Fila 1 · Dato" value={saved} culture="es" readOnly={false} onChange={change} />); });
  const input = screen.getByRole("textbox", { name: "Fila 1 · Dato" });
  expect(input).toHaveValue(saved);
  expect(input).toHaveAttribute("readonly");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Limpiar Fila 1 · Dato" }));
  expect(change).toHaveBeenCalledWith(null);
});
