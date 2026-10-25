import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { newCatalogField } from "../catalogFields";
import { CatalogExtraFieldInput } from "./CatalogExtraFieldInput";

it("explains an unsaved field as help of its disabled cell instead of a message below it", async () => {
  await act(async () => { renderWithProviders(<><CatalogExtraFieldInput field={newCatalogField("new", 1)} label="CUIT" value={null} culture="es" readOnly={false} onChange={vi.fn()} /><CatalogExtraFieldInput field={{ ...newCatalogField("flag", 2), type: "boolean" }} label="Con GPS" value={null} culture="es" readOnly={false} onChange={vi.fn()} /></>); });
  const input = screen.getByRole("textbox", { name: "CUIT" });
  expect(input).toBeDisabled();
  // No text under the cell: the reason is the control's description and its tooltip, on hover or on keyboard focus.
  expect(input).toHaveAccessibleDescription("Guardá para cargar valores");
  expect(screen.getAllByText("Guardá para cargar valores").every(node => node.closest("[hidden]"))).toBe(true);
  await userEvent.hover(input);
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Guardá para cargar valores");
  await userEvent.unhover(input);
  await userEvent.tab();
  expect(input.parentElement).toHaveFocus();
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Guardá para cargar valores");
  const checkbox = screen.getByRole("checkbox", { name: "Con GPS" });
  expect(checkbox).toBeDisabled();
  expect(checkbox).toHaveAccessibleDescription("Guardá para cargar valores");
});
it("keeps the description of an unsaved field's cell together with the one its owner gives", async () => {
  await act(async () => { renderWithProviders(<><CatalogExtraFieldInput field={newCatalogField("new", 1)} label="Fila 1 · CUIT" value={null} culture="es" aria-describedby="row-note" readOnly={false} onChange={vi.fn()} /><p id="row-note">Fila 1 · CUIT: falta.</p></>); });
  expect(screen.getByRole("textbox", { name: "Fila 1 · CUIT" })).toHaveAccessibleDescription("Fila 1 · CUIT: falta. Guardá para cargar valores");
});
it("preserves invalid typed input and is described by the error its owner shows, without numeric coercion", async () => {
  const change = vi.fn();
  await act(async () => { renderWithProviders(<><CatalogExtraFieldInput field={{ ...newCatalogField("saved", 1), id: "01990000-0000-7000-8000-000000000001", type: "integer" }} label="Fila 1 · Plazo" value="30 días" culture="es" aria-invalid aria-describedby="row-problem" readOnly={false} onChange={change} /><p id="row-problem">Fila 1 · Plazo: «30 días» no es un número entero.</p></>); });
  const input = screen.getByRole("textbox", { name: "Fila 1 · Plazo" });
  expect(input).toHaveValue("30 días");
  expect(input).toHaveAttribute("aria-invalid", "true");
  expect(input).toHaveAccessibleDescription("Fila 1 · Plazo: «30 días» no es un número entero.");
  expect(screen.getAllByText(/no es un número entero/)).toHaveLength(1);
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
  server.use(http.get("/api/forms/catalogs/" + sourceId, () => HttpResponse.json({ valueType: "Text", proposal: null, id: sourceId, key: sourceId.replaceAll("-", ""), name: { es: "Zonas", en: "Zones" }, description: { es: "Zonas", en: "Zones" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 1, usageCount: null, originalCulture: "es", unavailableReasonCode: null, filters: null, fields: [], presentation: null, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } })),
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
