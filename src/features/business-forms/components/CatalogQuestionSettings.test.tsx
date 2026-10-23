import { MemoryRouter } from "react-router";
import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogQuestionSettings } from "./CatalogQuestionSettings";

it("keeps a catalog reference readonly without reading catalogs when the author lacks permission", async () => {
  const onCatalogChange = vi.fn();
  await act(async () => { renderWithProviders(<MemoryRouter><CatalogQuestionSettings scope={{ actorId: "author", culture: "es", permissions: ["formtemplates.manage"] }} source={{ catalog: "01990000-0000-7000-8000-000000000091" }} readOnly={false} error="Revisá el catálogo." onCatalogChange={onCatalogChange} /></MemoryRouter>); });
  expect(screen.getByRole("combobox", { name: "Catálogo" })).toBeDisabled();
  expect(screen.getByText("Revisá el catálogo.")).toBeInTheDocument();
  expect(onCatalogChange).not.toHaveBeenCalled();
});

it("offers neither filters nor its own presentation for a Filters catalog", async () => {
  const id = "01990000-0000-7000-8000-000000000092";
  let served = false;
  server.use(
    http.get("/api/forms/catalogs", () => HttpResponse.json({ filterCounts: { byKind: { all: 1, manual: 0, filters: 1 } }, items: [{ id, name: "Técnicos", description: null, origin: "Filters", valueType: "Text", optionsCount: null, usageCount: 0, state: "Active", stateReason: null, canEdit: true }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.get("/api/forms/catalogs/:id", () => { served = true; return HttpResponse.json({ id, key: id.replaceAll("-", ""), name: { es: "Técnicos", en: "Technicians" }, description: { es: "Personas del área", en: "People in the area" }, kind: "Filters", valueType: "Text", revision: 1, isActive: true, itemsCount: null, usageCount: 0, unavailableReasonCode: null, filters: { textColumn: "name", detailColumn: null, conditions: [], excludeRecipient: false, sortColumn: "name", sortDescending: false }, proposal: null, fields: null, presentation: null, presentationCheck: null }); }));
  renderWithProviders(<MemoryRouter><CatalogQuestionSettings scope={{ actorId: "author", culture: "es", permissions: ["formtemplates.manage", "formcatalogs.read"] }} source={{ catalog: id }} readOnly={false} onCatalogChange={vi.fn()} onSourceChange={vi.fn()}><p>Una o varias</p></CatalogQuestionSettings></MemoryRouter>);
  await waitFor(() => expect(served).toBe(true));
  await waitFor(() => expect(screen.queryByText("Cargando…")).not.toBeInTheDocument());
  expect(screen.getByText("Una o varias")).toBeInTheDocument();
  expect(screen.queryByText("Qué opciones ve cada persona")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Agregar filtro fijo" })).not.toBeInTheDocument();
  expect(screen.queryByRole("radio", { name: /Propio de esta pregunta/ })).not.toBeInTheDocument();
});
