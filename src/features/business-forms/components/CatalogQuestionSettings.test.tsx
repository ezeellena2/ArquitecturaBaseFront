import { MemoryRouter } from "react-router";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { CatalogQuestionSettings } from "./CatalogQuestionSettings";
import type { DraftQuestionSource } from "../model";

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
    http.get("/api/forms/catalogs/:id", () => { served = true; return HttpResponse.json({ id, key: id.replaceAll("-", ""), name: { es: "Técnicos", en: "Technicians" }, description: { es: "Personas del área", en: "People in the area" }, kind: "Filters", valueType: "Text", revision: 1, isActive: true, itemsCount: null, usageCount: 0, originalCulture: "es", unavailableReasonCode: null, filters: { textColumn: "name", detailColumn: null, conditions: [], excludeRecipient: false, sortColumn: "name", sortDescending: false }, proposal: null, fields: null, presentation: null, presentationCheck: null }); }));
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
const detail = (id: string, kind: "Manual" | "Filters") => ({ id, key: id.replaceAll("-", ""), name: { es: kind === "Manual" ? "Equipos" : "Técnicos", en: kind === "Manual" ? "Teams" : "Technicians" }, description: { es: "Para probar", en: "For testing" }, kind, valueType: "Text", revision: 1, isActive: true, itemsCount: kind === "Manual" ? 1 : null, usageCount: 0, originalCulture: "es", unavailableReasonCode: null, filters: kind === "Filters" ? { textColumn: "name", detailColumn: null, conditions: [], excludeRecipient: false, sortColumn: "name", sortDescending: false } : null, proposal: null, fields: kind === "Manual" ? [] : null, presentation: kind === "Manual" ? { title: ["text"], description: ["detail"] } : null, presentationCheck: kind === "Manual" ? { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } : null });
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

it("explains why a person cannot be tried before saving only on hover or focus", async () => {
  serveRecipientPreview();
  renderWithProviders(<MemoryRouter><CatalogQuestionSettings scope={previewScope} source={{ catalog: manualId }} questionId="q" readOnly={false} onCatalogChange={vi.fn()} onSourceChange={vi.fn()}/></MemoryRouter>);
  const input = await screen.findByRole("combobox", { name: "Como si lo recibiera" });
  const reason = "Guardá el formulario para probar con una persona.";
  expect(input).toBeDisabled();
  // No hint under the field: the reason is its description and its tooltip, on hover or on keyboard focus.
  expect(input).toHaveAccessibleDescription(reason);
  expect(screen.getAllByText(reason).every(node => node.closest("[hidden]"))).toBe(true);
  await userEvent.hover(input);
  expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
  await userEvent.unhover(input);
  const wrapper = input.closest<HTMLElement>("[tabindex='0']")!;
  act(() => wrapper.focus());
  expect(wrapper).toHaveFocus();
  expect(await screen.findByRole("tooltip")).toHaveTextContent(reason);
});

it("offers filter additions in the section header", async () => {
  serveMaximum(() => HttpResponse.json({ maximum: 18, maximumLabel: "Zona Sur" }));
  const onSourceChange = vi.fn();
  const view = renderWithProviders(<MemoryRouter><CatalogQuestionSettings scope={previewScope} source={{ catalog: maximumCatalog }} questionId="q" readOnly={false} onCatalogChange={vi.fn()} onSourceChange={onSourceChange}/></MemoryRouter>);
  const band = async () => within(await screen.findByRole("region", { name: "Qué opciones ve cada persona" })).getByRole("heading", { name: "Qué opciones ve cada persona" }).parentElement!;
  // Both additions act on the whole section, so they go in its band beside the title.
  // Until the person data arrive no field matches one, so the addition is off with its reason: read it again once enabled.
  await waitFor(async () => expect(within(await band()).getByRole("button", { name: "Agregar filtro según quien lo recibe" })).toBeEnabled());
  const fixed = within(await band()).getByRole("button", { name: "Agregar filtro fijo" });
  expect(fixed).toBeEnabled();
  await userEvent.click(fixed);
  expect(onSourceChange).toHaveBeenLastCalledWith({ catalog: maximumCatalog, match: [{ fieldId: zone, value: null }] });
  view.unmount();
  // A catalog without filter fields keeps them in the band, disabled, with the reason as tooltip and description, not below.
  serveRecipientPreview();
  renderWithProviders(settings(manualId));
  const reason = "Este catálogo no tiene campos de filtro disponibles.";
  for (const name of ["Agregar filtro según quien lo recibe", "Agregar filtro fijo"]) {
    const button = within(await band()).getByRole("button", { name });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(reason);
  }
  expect(screen.getAllByText(reason).every(node => node.closest("[hidden]"))).toBe(true);
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
  // Coming back to the window or reconnecting inside the wait does not repeat the read on its own (RF13-1).
  try {
    await act(async () => { focusManager.setFocused(false); focusManager.setFocused(true); onlineManager.setOnline(false); onlineManager.setOnline(true); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(requests.samples).toBe(1);
    expect(within(screen.getByRole("alert")).getByRole("button", { name: "Reintentar" })).toBeDisabled();
  } finally { focusManager.setFocused(undefined); onlineManager.setOnline(true); }
});

// Only network, 5xx and 429 can be retried (point 28): a rejected search (400) or a lost permission (403) offers no Retry
// that would fail again, and a 403 says the permission is gone, like the preview.
it.each([
  [400, { code: "Validation.Failed", errors: { search: ["Usá hasta 100 caracteres."] } }, "No se pudo preparar la vista previa."],
  [403, { code: "Auth.Forbidden" }, "Ya no tenés permiso para probar con personas."],
] as const)("offers no Retry when the recipient samples fail with %i", async (status, body, text) => {
  const requests = serveRecipientPreview();
  server.use(http.get("/api/forms/recipient-samples", () => { requests.samples++; return HttpResponse.json(body, { status }); }));
  renderWithProviders(settings(manualId));
  const failed = await screen.findByRole("alert");
  expect(failed).toHaveTextContent(text);
  expect(within(failed).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  expect(requests.samples).toBe(1);
});

const maximumCatalog = "01990000-0000-7000-8000-0000000000a1", zones = "01990000-0000-7000-8000-0000000000a2", zone = "01990000-0000-7000-8000-0000000000a3", category = "01990000-0000-7000-8000-0000000000a4", attribute = "01990000-0000-7000-8000-0000000000a5";
const filterField = (id: string, key: string, es: string, type: "catalog" | "text", position: number) => ({ id, key, name: { es, en: es }, type, sourceCatalogId: type === "catalog" ? zones : null, required: false, unique: false, min: null, max: null, maxLength: type === "text" ? 80 : null, role: "filter", position, isActive: true, valuesCount: 3, usedBy: [] });
type MaximumBody = { source: { match: { personAttributeId?: string }[] } };
function serveMaximum(answer: (body: MaximumBody, call: number) => Response) {
  const bodies: MaximumBody[] = [];
  server.use(
    http.get("/api/forms/catalogs", () => HttpResponse.json({ filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } }, ...page([{ id: maximumCatalog, name: "Proveedores", description: null, origin: "Manual", valueType: "Text", optionsCount: 200, usageCount: 0, state: "Active", stateReason: null, canEdit: true }]) })),
    http.get("/api/forms/catalogs/:id", () => HttpResponse.json({ ...detail(maximumCatalog, "Manual"), name: { es: "Proveedores", en: "Suppliers" }, itemsCount: 200, fields: [filterField(zone, "zone", "Zona", "catalog", 1), filterField(category, "category", "Rubro", "text", 2)] })),
    http.get("/api/forms/catalogs/:id/items", () => HttpResponse.json(page([]))),
    http.get("/api/forms/person-attributes", () => HttpResponse.json({ items: [{ id: attribute, key: "zone", name: { es: "Zona", en: "Zone" }, originalCulture: "es", type: "Catalog", sourceCatalogId: zones, sourceCatalogName: "Zonas", position: 0, isActive: true, revision: 1, usedBy: [] }] })),
    http.post("/api/forms/recipient-maximums", async ({ request }) => { const body = await request.json() as MaximumBody; bodies.push(body); return answer(body, bodies.length); }));
  return bodies;
}
// No person is chosen and the form is not saved: the maximum depends only on the filters.
const maximumQuestion = (type: "choice" | "multiChoice", match: NonNullable<DraftQuestionSource["match"]>) => <MemoryRouter><CatalogQuestionSettings scope={previewScope} source={{ catalog: maximumCatalog, match }} type={type} questionId="q" readOnly={false} onCatalogChange={vi.fn()} onSourceChange={vi.fn()}/></MemoryRouter>;

// Each addition gives its own reason (point 38): no person data matches the remaining fields, or every filter field is in use.
it("explains why each filter addition is disabled", async () => {
  serveMaximum(() => HttpResponse.json({ maximum: 18, maximumLabel: "Zona Sur" }));
  const question = (match: NonNullable<DraftQuestionSource["match"]>) => <MemoryRouter><CatalogQuestionSettings scope={previewScope} source={{ catalog: maximumCatalog, match }} questionId="q" readOnly={false} onCatalogChange={vi.fn()} onSourceChange={vi.fn()}/></MemoryRouter>;
  const view = renderWithProviders(question([{ fieldId: zone, value: null }]));
  const band = async () => within(await screen.findByRole("region", { name: "Qué opciones ve cada persona" })).getByRole("heading", { name: "Qué opciones ve cada persona" }).parentElement!;
  const person = within(await band()).getByRole("button", { name: "Agregar filtro según quien lo recibe" });
  await waitFor(() => expect(person).toHaveAccessibleDescription("Ningún dato de las personas usa el catálogo de estos campos."));
  expect(person).toBeDisabled();
  const fixed = within(await band()).getByRole("button", { name: "Agregar filtro fijo" });
  expect(fixed).toBeEnabled();
  expect(fixed).not.toHaveAccessibleDescription();
  view.rerender(question([{ fieldId: zone, value: null }, { fieldId: category, value: "Frío" }]));
  for (const name of ["Agregar filtro según quien lo recibe", "Agregar filtro fijo"]) {
    const button = within(await band()).getByRole("button", { name });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Ya se usan todos los campos de filtro.");
  }
});

// An incomplete filter (no value, no person data) disables the test with a person: the reason says so, like an unsaved form.
it("explains that the filters must be complete to try with a person", async () => {
  serveMaximum(() => HttpResponse.json({ maximum: 18, maximumLabel: "Zona Sur" }));
  server.use(http.get("/api/forms/recipient-samples", () => HttpResponse.json(page([{ id: juan, name: "Juan" }]))));
  const question = (match: NonNullable<DraftQuestionSource["match"]>) => <MemoryRouter><CatalogQuestionSettings scope={previewScope} source={{ catalog: maximumCatalog, match }} questionId="q" definitionId={formId} readOnly={false} onCatalogChange={vi.fn()} onSourceChange={vi.fn()}/></MemoryRouter>;
  const view = renderWithProviders(question([{ fieldId: category, value: null }]));
  const input = await screen.findByRole("combobox", { name: "Como si lo recibiera" });
  expect(input).toBeDisabled();
  expect(input).toHaveAccessibleDescription("Completá los filtros para probar con una persona.");
  view.rerender(question([{ fieldId: category, value: "Frío" }]));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Como si lo recibiera" })).toBeEnabled());
  expect(screen.getByRole("combobox", { name: "Como si lo recibiera" })).not.toHaveAccessibleDescription();
});

it("tells the maximum per person and that everyone sees the same options with only fixed filters", async () => {
  const bodies = serveMaximum(body => HttpResponse.json(body.source.match.some(match => match.personAttributeId) ? { maximum: 18, maximumLabel: "Zona Sur" } : { maximum: 180, maximumLabel: null }));
  const view = renderWithProviders(maximumQuestion("multiChoice", [{ fieldId: zone, personAttributeId: attribute }]));
  expect(await screen.findByText("Como mucho 18 por persona (Zona Sur, la más grande): entra en una pregunta de varias (20).")).toBeInTheDocument();
  view.rerender(maximumQuestion("choice", [{ fieldId: category, value: "Frío" }]));
  expect(await screen.findByText("Todos ven las mismas 180: entra en el desplegable (200).")).toBeInTheDocument();
  expect(screen.queryByText(/Como mucho/)).not.toBeInTheDocument();
  view.rerender(maximumQuestion("multiChoice", [{ fieldId: category, value: "Frío" }]));
  expect(await screen.findByText("Todos ven las mismas 180: no entra en una pregunta de varias (20).")).toBeInTheDocument();
  // The limit comes from the question type: changing only the type reads nothing again.
  expect(bodies).toEqual([{ source: { catalog: maximumCatalog, match: [{ fieldId: zone, personAttributeId: attribute }] } }, { source: { catalog: maximumCatalog, match: [{ fieldId: category, value: "Frío" }] } }]);
});

it("warns instead of confirming the limit when the filters leave no option for anyone", async () => {
  // A fixed value that matches no option, or one still being typed («Frí» before «Frío»), gives a maximum of 0.
  serveMaximum(() => HttpResponse.json({ maximum: 0, maximumLabel: null }));
  const view = renderWithProviders(maximumQuestion("choice", [{ fieldId: category, value: "Frí" }]));
  const none = await screen.findByText("Con estos filtros nadie ve ninguna opción.");
  expect(none.closest("[role=status]")).toHaveClass("text-[var(--color-warning-700)]");
  expect(screen.queryByText(/entra en/)).not.toBeInTheDocument();
  view.rerender(maximumQuestion("multiChoice", [{ fieldId: zone, personAttributeId: attribute }]));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Con estos filtros nadie ve ninguna opción."));
  expect(screen.queryByText(/Como mucho/)).not.toBeInTheDocument();
});

it("offers Retry when the maximum per person cannot be read", async () => {
  const bodies = serveMaximum((_body, call) => call === 1 ? HttpResponse.json({ title: "Error", status: 500, traceId: "trace" }, { status: 500 }) : HttpResponse.json({ maximum: 18, maximumLabel: "Zona Sur" }));
  renderWithProviders(maximumQuestion("multiChoice", [{ fieldId: zone, personAttributeId: attribute }]));
  const failed = await screen.findByRole("alert");
  expect(failed).toHaveTextContent("No pudimos calcular cuántas opciones ve cada persona.");
  await userEvent.click(within(failed).getByRole("button", { name: "Reintentar" }));
  expect(await screen.findByText("Como mucho 18 por persona (Zona Sur, la más grande): entra en una pregunta de varias (20).")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(bodies).toHaveLength(2);
});
