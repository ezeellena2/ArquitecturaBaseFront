import { MemoryRouter } from "react-router";
import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  // A detail the strict guard rejects would also leave nothing to show; only a loaded catalog proves the Filters branch.
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByText("Una o varias")).toBeInTheDocument();
  expect(screen.queryByText("Qué opciones ve cada persona")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Agregar filtro fijo" })).not.toBeInTheDocument();
  expect(screen.queryByRole("radio", { name: /Propio de esta pregunta/ })).not.toBeInTheDocument();
});

const manualId = "01990000-0000-7000-8000-000000000093", filtersId = "01990000-0000-7000-8000-000000000094", formId = "01990000-0000-7000-8000-000000000095";
const itemId = "01990000-0000-7000-8000-000000000096", juan = "01990000-0000-7000-8000-000000000097";
const previewScope = { actorId: "author", culture: "es" as const, permissions: ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"] };
const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasPrevious: false, hasNext: false });
const detail = (id: string, kind: "Manual" | "Filters") => ({ id, key: id.replaceAll("-", ""), name: { es: kind === "Manual" ? "Equipos" : "Técnicos", en: kind === "Manual" ? "Teams" : "Technicians" }, description: { es: "Para probar", en: "For testing" }, kind, valueType: "Text", revision: 1, isActive: true, itemsCount: kind === "Manual" ? 1 : null, usageCount: 0, unavailableReasonCode: null, filters: kind === "Filters" ? { textColumn: "name", detailColumn: null, conditions: [], excludeRecipient: false, sortColumn: "name", sortDescending: false } : null, proposal: null, fields: kind === "Manual" ? [] : null, presentation: kind === "Manual" ? { title: ["text"], description: ["detail"] } : null, presentationCheck: kind === "Manual" ? { titleTooLongCount: 0, examples: [] } : null });
function serveRecipientPreview() {
  const requests = { samples: 0, previews: [] as string[] };
  server.use(
    http.get("/api/forms/catalogs", () => HttpResponse.json({ filterCounts: { byKind: { all: 2, manual: 1, filters: 1 } }, ...page([{ id: manualId, name: "Equipos", description: null, origin: "Manual", valueType: "Text", optionsCount: 1, usageCount: 0, state: "Active", stateReason: null, canEdit: true }, { id: filtersId, name: "Técnicos", description: null, origin: "Filters", valueType: "Text", optionsCount: null, usageCount: 0, state: "Active", stateReason: null, canEdit: true }]) })),
    http.get("/api/forms/catalogs/:id", ({ params }) => HttpResponse.json(detail(String(params.id), params.id === manualId ? "Manual" : "Filters"))),
    http.get("/api/forms/catalogs/:id/items", () => HttpResponse.json(page([{ id: itemId, code: "A", text: { es: "Equipo A", en: null }, detail: {}, value: null, position: 1, isActive: true, fields: {}, fieldTexts: {} }]))),
    http.get("/api/forms/recipient-samples", () => { requests.samples++; return HttpResponse.json(page([{ id: juan, name: "Juan" }])); }),
    http.post("/api/forms/definitions/:id/recipient-previews", async ({ request }) => { const body = await request.json() as { source: { catalog: string } }; requests.previews.push(body.source.catalog); return HttpResponse.json({ recipient: { id: juan, name: "Juan", values: [] }, state: "Ready", optionCount: 1, limit: 200, exceedsLimit: false, options: [{ id: itemId, title: "Equipo A", description: null }], presentationCheck: { titleTooLongCount: 0, examples: [] } }); }));
  return requests;
}
const settings = (catalog: string, onPreviewChange = vi.fn()) => <MemoryRouter><CatalogQuestionSettings scope={previewScope} source={{ catalog }} questionId="q" definitionId={formId} readOnly={false} onCatalogChange={vi.fn()} onSourceChange={vi.fn()} onPreviewChange={onPreviewChange}/></MemoryRouter>;

it("drops the recipient chosen for a Manual catalog when the question moves to a Filters catalog", async () => {
  const requests = serveRecipientPreview(), onPreviewChange = vi.fn();
  const view = renderWithProviders(settings(manualId, onPreviewChange));
  const input = await screen.findByRole("combobox", { name: "Como si lo recibiera" });
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.click(input); await userEvent.click(await screen.findByRole("option", { name: "Juan" }));
  expect(await screen.findByText("1 opción")).toBeInTheDocument();
  expect(onPreviewChange).toHaveBeenLastCalledWith("q", expect.objectContaining({ options: [{ id: itemId, title: "Equipo A", description: null }] }));
  view.rerender(settings(filtersId, onPreviewChange));
  await waitFor(() => expect(screen.queryByText("Cargando…")).not.toBeInTheDocument());
  expect(screen.queryByRole("combobox", { name: "Como si lo recibiera" })).not.toBeInTheDocument();
  expect(requests.previews).toEqual([manualId]);
  expect(onPreviewChange).toHaveBeenLastCalledWith("q", null);
});

it("reads no recipient samples for a Filters catalog of a saved form", async () => {
  const requests = serveRecipientPreview();
  renderWithProviders(settings(filtersId));
  await waitFor(() => expect(screen.queryByText("Cargando…")).not.toBeInTheDocument());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(requests.samples).toBe(0);
});
