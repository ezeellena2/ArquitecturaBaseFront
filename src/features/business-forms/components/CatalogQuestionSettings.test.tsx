import { MemoryRouter } from "react-router";
import { act, screen, waitFor, within } from "@testing-library/react";
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

const ownCatalogId = "01990000-0000-7000-8000-000000000098";
const ownOption = (index: number) => ({ id: "01990000-0000-7000-8000-0000000009" + String(index).padStart(2, "0"), code: "C" + index, text: { es: "Opción " + index, en: null }, detail: {}, value: null, position: index, isActive: true, fields: {}, fieldTexts: {} });
const ownExamples = ["C1 · Distribuidora del Litoral Norte", "C2 · Ferretería Industrial del Centro", "C3 · Repuestos y Servicios del Oeste"].map((title, index) => ({ itemId: ownOption(index + 1).id, title }));
const ownPresentation = { title: ["code", "text"], description: [] };
function renderOwnPresentation(answer: (call: number) => Response) {
  const bodies: unknown[] = [];
  server.use(
    http.get("/api/forms/catalogs", () => HttpResponse.json({ filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } }, ...page([{ id: ownCatalogId, name: "Proveedores", description: null, origin: "Manual", valueType: "Text", optionsCount: 60, usageCount: 0, state: "Active", stateReason: null, canEdit: true }]) })),
    http.get("/api/forms/catalogs/:id", () => HttpResponse.json({ ...detail(ownCatalogId, "Manual"), name: { es: "Proveedores", en: "Suppliers" }, itemsCount: 60 })),
    // Only the first 20 options are loaded and one composes a long title: a count of this page alone would find just that one.
    http.get("/api/forms/catalogs/:id/items", () => HttpResponse.json({ ...page(Array.from({ length: 20 }, (_, index) => index === 19 ? { ...ownOption(20), text: { es: "Opción 20 con un nombre bastante largo", en: null } } : ownOption(index + 1))), totalCount: 60, totalPages: 3, hasNext: true })),
    http.post("/api/forms/catalogs/:id/presentation-checks", async ({ request }) => { bodies.push(await request.json()); return answer(bodies.length); }));
  renderWithProviders(<MemoryRouter><CatalogQuestionSettings scope={{ actorId: "author", culture: "es", permissions: ["formtemplates.manage", "formcatalogs.read"] }} source={{ catalog: ownCatalogId, presentation: ownPresentation }} readOnly={false} onCatalogChange={vi.fn()} onSourceChange={vi.fn()} /></MemoryRouter>);
  return bodies;
}
const longTitles = () => HttpResponse.json({ cultures: [{ culture: "es", titleTooLongCount: 41, titleExamples: ownExamples, descriptionTooLongCount: 0, descriptionExamples: [] }] });

it("shows the server title check of an own presentation over every catalog option", async () => {
  const bodies = renderOwnPresentation(longTitles);
  expect(await screen.findByRole("radio", { name: /Propio de esta pregunta/ })).toBeChecked();
  expect(await screen.findByText("C1 · Opción 1")).toBeInTheDocument();
  expect(await screen.findByText("En español: 41 opciones superan los 30 caracteres del título.")).toBeInTheDocument();
  for (const example of ownExamples) expect(screen.getByText(example.title)).toBeInTheDocument();
  expect(screen.getByText("y 38 más")).toBeInTheDocument();
  expect(bodies).toEqual([{ presentation: ownPresentation }]);
});

it("offers to retry the server check of an own presentation when it fails", async () => {
  const bodies = renderOwnPresentation(call => call === 1 ? HttpResponse.json({ title: "Error", status: 500 }, { status: 500 }) : longTitles());
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("No pudimos revisar el largo de las opciones.");
  expect(await screen.findByText("C1 · Opción 1")).toBeInTheDocument();
  // Without the server check nothing is counted from the 20 loaded options, although one of them is too long.
  expect(screen.queryByText(/superan? los 30/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Podés guardar/)).not.toBeInTheDocument();
  await userEvent.click(within(alert).getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByText("En español: 41 opciones superan los 30 caracteres del título.")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(bodies).toHaveLength(2);
});

const manualId = "01990000-0000-7000-8000-000000000093", filtersId = "01990000-0000-7000-8000-000000000094", formId = "01990000-0000-7000-8000-000000000095";
const itemId = "01990000-0000-7000-8000-000000000096", juan = "01990000-0000-7000-8000-000000000097";
const previewScope = { actorId: "author", culture: "es" as const, permissions: ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"] };
const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasPrevious: false, hasNext: false });
const detail = (id: string, kind: "Manual" | "Filters") => ({ id, key: id.replaceAll("-", ""), name: { es: kind === "Manual" ? "Equipos" : "Técnicos", en: kind === "Manual" ? "Teams" : "Technicians" }, description: { es: "Para probar", en: "For testing" }, kind, valueType: "Text", revision: 1, isActive: true, itemsCount: kind === "Manual" ? 1 : null, usageCount: 0, unavailableReasonCode: null, filters: kind === "Filters" ? { textColumn: "name", detailColumn: null, conditions: [], excludeRecipient: false, sortColumn: "name", sortDescending: false } : null, proposal: null, fields: kind === "Manual" ? [] : null, presentation: kind === "Manual" ? { title: ["text"], description: ["detail"] } : null, presentationCheck: kind === "Manual" ? { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } : null });
function serveRecipientPreview() {
  const requests = { samples: 0, previews: [] as string[] };
  server.use(
    http.get("/api/forms/catalogs", () => HttpResponse.json({ filterCounts: { byKind: { all: 2, manual: 1, filters: 1 } }, ...page([{ id: manualId, name: "Equipos", description: null, origin: "Manual", valueType: "Text", optionsCount: 1, usageCount: 0, state: "Active", stateReason: null, canEdit: true }, { id: filtersId, name: "Técnicos", description: null, origin: "Filters", valueType: "Text", optionsCount: null, usageCount: 0, state: "Active", stateReason: null, canEdit: true }]) })),
    http.get("/api/forms/catalogs/:id", ({ params }) => HttpResponse.json(detail(String(params.id), params.id === manualId ? "Manual" : "Filters"))),
    http.get("/api/forms/catalogs/:id/items", () => HttpResponse.json(page([{ id: itemId, code: "A", text: { es: "Equipo A", en: null }, detail: {}, value: null, position: 1, isActive: true, fields: {}, fieldTexts: {} }]))),
    http.get("/api/forms/recipient-samples", () => { requests.samples++; return HttpResponse.json(page([{ id: juan, name: "Juan" }])); }),
    http.post("/api/forms/definitions/:id/recipient-previews", async ({ request }) => { const body = await request.json() as { source: { catalog: string } }; requests.previews.push(body.source.catalog); return HttpResponse.json({ recipient: { id: juan, name: "Juan", values: [] }, state: "Ready", optionCount: 1, limit: 200, exceedsLimit: false, options: [{ id: itemId, title: "Equipo A", description: null }] }); }));
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

it("offers Retry after a failed recipient preview and keeps it disabled during a 429 wait", async () => {
  const requests = serveRecipientPreview();
  server.use(http.post("/api/forms/definitions/:id/recipient-previews", () => { requests.previews.push(manualId); return requests.previews.length === 1 ? HttpResponse.json({ title: "Error", status: 500, traceId: "trace" }, { status: 500 }) : HttpResponse.json({ code: "RateLimit.Exceeded", retryAfter: 5 }, { status: 429 }); }));
  renderWithProviders(settings(manualId));
  const input = await screen.findByRole("combobox", { name: "Como si lo recibiera" });
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.click(input); await userEvent.click(await screen.findByRole("option", { name: "Juan" }));
  const failed = await screen.findByRole("alert");
  expect(failed).toHaveTextContent("No se pudo preparar la vista previa.");
  await userEvent.click(within(failed).getByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(requests.previews).toHaveLength(2));
  const waiting = await screen.findByRole("button", { name: "Reintentar" });
  await waitFor(() => expect(waiting).toBeDisabled());
  // The wait is the button's reason (tooltip and description), not a text beside it; the state keeps saying it failed.
  expect(waiting).toHaveAccessibleDescription("Esperá 5 segundos para volver a intentar.");
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo preparar la vista previa.");
  expect(requests.previews).toHaveLength(2);
});

it("retries the recipient samples after they fail", async () => {
  const requests = serveRecipientPreview();
  server.use(http.get("/api/forms/recipient-samples", () => { requests.samples++; return requests.samples === 1 ? HttpResponse.json({ title: "Error", status: 500, traceId: "trace" }, { status: 500 }) : HttpResponse.json(page([{ id: juan, name: "Juan" }])); }));
  renderWithProviders(settings(manualId));
  const failed = await screen.findByRole("alert");
  expect(failed).toHaveTextContent("No se pudo preparar la vista previa.");
  await userEvent.click(within(failed).getByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(requests.samples).toBe(2);
});

it("keeps Retry disabled during the wait of a 429 on the recipient samples", async () => {
  const requests = serveRecipientPreview();
  server.use(http.get("/api/forms/recipient-samples", () => { requests.samples++; return HttpResponse.json({ code: "RateLimit.Exceeded", retryAfter: 5 }, { status: 429 }); }));
  renderWithProviders(settings(manualId));
  const failed = await screen.findByRole("alert");
  expect(failed).toHaveTextContent("No se pudo preparar la vista previa.");
  const retry = within(failed).getByRole("button", { name: "Reintentar" });
  expect(retry).toBeDisabled();
  expect(retry).toHaveAccessibleDescription("Esperá 5 segundos para volver a intentar.");
  expect(requests.samples).toBe(1);
});
