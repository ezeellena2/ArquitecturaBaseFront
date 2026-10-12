import manualDetail from "@/test/fixtures/catalogs-http/manual-current/detail.json";
import type { DraftFieldIssue } from "../validationPaths";
import { MemoryRouter } from "react-router";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { useState } from "react";
import { act, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { QuestionEditor } from "./QuestionEditor";
import { moveItem } from "../editorModel";
import type { DraftQuestion } from "../model";

const first: DraftQuestion = { localId: "a", fieldId: "field-a", replacesFieldId: null, type: "choice", label: { es: "Cliente" }, help: null, required: true,
  options: [{ localId: "north", choiceId: "north", label: { es: "Norte" } }, { localId: "south", choiceId: "south", label: { es: "Sur" } }] };
const second: DraftQuestion = { localId: "b", fieldId: "field-b", replacesFieldId: null, type: "date", label: { es: "Fecha" }, help: null, required: true };
function Harness({ expandedInitially = false, readOnly = false }: { expandedInitially?: boolean; readOnly?: boolean }) {
  const [questions, setQuestions] = useState<readonly DraftQuestion[]>([first, second]);
  const [expanded, setExpanded] = useState<string | null>(expandedInitially ? "a" : null);
  return <>{questions.map((question, index) => <QuestionEditor key={question.localId} question={question} position={index + 1} total={questions.length}
    culture="es" original="es" expanded={expanded === question.localId} readOnly={readOnly} issues={[]}
    onChange={next => setQuestions(old => old.map(q => q.localId === next.localId ? next : q))}
    onExpand={open => setExpanded(open ? question.localId : null)} onMove={delta => setQuestions(old => moveItem(old, index, delta))} onRemove={() => {}} />)}</>;
}
async function mount(props?: Parameters<typeof Harness>[0]) { await act(async () => { renderWithProviders(<Harness {...props} />); }); }
it("clears original help explicitly while preserving the other language and field identity", async () => {
  const question = { ...first, help: { es: "Detalle", en: "Details" } };
  const onChange = vi.fn();
  await act(async () => { renderWithProviders(<QuestionEditor question={question} position={1} total={1}
    culture="es" original="es" expanded readOnly={false} issues={[]} onChange={onChange}
    onExpand={() => {}} onMove={() => {}} onRemove={() => {}} />); });
  await userEvent.clear(screen.getByLabelText("Ayuda para el empleado"));
  expect(onChange).toHaveBeenLastCalledWith({ ...question, help: { es: null, en: "Details" } });
});

describe("Question movement", () => {
  it("announces the new position and keeps keyboard focus when a question reaches the boundary", async () => {
    await mount();
    await userEvent.click(screen.getByRole("button", { name: "Bajar Cliente" }));
    expect(screen.getByRole("button", { name: "Subir Cliente" })).toHaveFocus();
    expect(screen.getAllByRole("status").some(status => status.textContent?.includes("Cliente: posición 2 de 2"))).toBe(true);
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Bajar Cliente" })).toHaveFocus();
    expect(screen.getAllByRole("status").some(status => status.textContent?.includes("Cliente: posición 1 de 2"))).toBe(true);
  });
  it("announces option movement and restores focus to an enabled control of that option", async () => {
    await mount({ expandedInitially: true });
    await userEvent.click(screen.getByRole("button", { name: "Bajar Norte" }));
    expect(screen.getByRole("button", { name: "Subir Norte" })).toHaveFocus();
    expect(screen.getAllByRole("status").some(status => status.textContent?.includes("Norte: posición 2 de 2"))).toBe(true);
    expect(within(screen.getByLabelText("Opción 2").closest("div")!).getByRole("textbox")).toHaveValue("Norte");
  });
});

it("returns focus to the row action after Done collapses the question", async () => {
  await mount({ expandedInitially: true });
  await userEvent.click(screen.getByRole("button", { name: "Listo" }));
  expect(screen.getByRole("button", { name: "Editar Cliente" })).toHaveFocus();
});

it("offers read-only inspection without reorder or edit actions", async () => {
  await mount({ readOnly: true });
  expect(screen.queryByRole("button", { name: /^(Subir|Bajar|Editar|Quitar)/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Ver pregunta Cliente" }));
  expect(screen.getByLabelText("Pregunta")).toHaveAttribute("readonly");
});

it("focuses a neighboring option and then Add option when the last option is removed", async () => {
  await mount({ expandedInitially: true });
  await userEvent.click(screen.getByRole("button", { name: "Quitar Opción 2" }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Quitar opción" }));
  expect(screen.getByLabelText("Opción 1")).toHaveFocus();
  await userEvent.click(screen.getByRole("button", { name: "Quitar Opción 1" }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Quitar opción" }));
  expect(screen.getByRole("button", { name: "Agregar opción" })).toHaveFocus();
});

const catalogScope = { actorId: "catalog-author", culture: "es" as const, permissions: ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"] };
const catalogA = "01990000-0000-7000-8000-000000000091", catalogB = "01990000-0000-7000-8000-000000000092", catalogInvalid = "01990000-0000-7000-8000-000000000093";
const catalogQuestion: DraftQuestion = { localId: "catalog-question", fieldId: "confirmed-field", replacesFieldId: null, type: "choice", source: { catalog: catalogA }, label: { es: "Cliente" }, help: null, required: true };
function catalogPage() { return { items: [{ id: catalogA, name: "Clientes", description: "Clientes activos", origin: "Manual", optionsCount: 3, usageCount: null, state: "Active", stateReason: null, canEdit: false }, { id: catalogB, name: "Supervisores", description: null, origin: "Filters", optionsCount: null, usageCount: null, state: "Active", stateReason: null, canEdit: false }, { id: catalogInvalid, name: "Responsables", description: null, origin: "Filters", optionsCount: null, usageCount: null, state: "Unavailable", stateReason: "Forms.Catalog.SourceUnavailable", canEdit: false }, { id: "01990000-0000-7000-8000-000000000094", name: "Archivados", description: null, origin: "Manual", optionsCount: 2, usageCount: null, state: "Inactive", stateReason: null, canEdit: false }], page: 1, pageSize: 20, totalCount: 4, totalPages: 1, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 4, manual: 2, filters: 2 } } }; }
async function mountCatalogQuestion(onChange = vi.fn(), permissions = catalogScope.permissions, issues: readonly DraftFieldIssue[] = []) {
  await act(async () => { renderWithProviders(<MemoryRouter><QuestionEditor question={catalogQuestion} position={1} total={1} culture="es" original="es" expanded readOnly={false} issues={issues} onChange={onChange} onExpand={() => {}} onMove={() => {}} onRemove={() => {}} {...{ catalogScope: { ...catalogScope, permissions } }} /></MemoryRouter>); });
  return onChange;
}
it("offers the catalog question type and shows invalid catalogs without allowing selection", async () => {
  server.use(http.get("/api/forms/catalogs", ({ request }) => { expect(new URL(request.url).searchParams.has("state")).toBe(false); return HttpResponse.json(catalogPage()); }));
  await mountCatalogQuestion();
  expect(screen.getByRole("option", { name: "Elegir de un catálogo" })).toBeInTheDocument();
  expect(await screen.findByRole("option", { name: /Responsables.*La vista Usuarios no está disponible/ })).toBeDisabled();
  expect(screen.getByRole("option", { name: /Archivados/ })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Agregar opción" })).not.toBeInTheDocument();
});
it("confirms catalog replacement before emitting a new question identity", async () => {
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json(catalogPage())));
  const onChange = await mountCatalogQuestion();
  const catalog = await screen.findByRole("combobox", { name: "Catálogo" });
  await screen.findByRole("option", { name: /Supervisores/ });
  await userEvent.selectOptions(catalog, catalogB); expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cambiar catálogo" }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ fieldId: null, replacesFieldId: "confirmed-field", source: { catalog: catalogB }, label: catalogQuestion.label }));
});

it("shows a catalog field error at the selector", async () => {
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json(catalogPage())));
  await mountCatalogQuestion(vi.fn(), undefined, [{ path: "draft.fields[0].source.catalog", fieldLocalId: "catalog-question", messages: ["Este catálogo no se puede usar."] }]);
  expect(screen.getByText("Este catálogo no se puede usar.")).toBeInTheDocument();
});
it("preserves a selected catalog outside the page and searches from page one", async () => {
  const reads: URLSearchParams[] = []; let detailReads = 0;
  server.use(http.get("/api/forms/catalogs", ({ request }) => { const params = new URL(request.url).searchParams; reads.push(params); const page = catalogPage(); return HttpResponse.json({ ...page, items: params.get("page") === "2" ? [page.items[1]] : page.items, page: Number(params.get("page")), totalCount: 21, totalPages: 2, hasPrevious: params.get("page") === "2", hasNext: params.get("page") !== "2", filterCounts: { byKind: { all: 21, manual: 19, filters: 2 } } }); }), http.get("/api/forms/catalogs/" + catalogA, () => { detailReads++; return HttpResponse.json({ ...manualDetail, id: catalogA, key: catalogA.replaceAll("-", ""), name: { es: "Clientes", en: "Customers" }, itemsCount: 9 }); }));
  await mountCatalogQuestion(); await screen.findByRole("option", { name: /Supervisores/ });
  await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
  await waitFor(() => expect(detailReads).toBe(1));
  expect(screen.getByRole("combobox", { name: "Catálogo" })).toHaveValue(catalogA);
  const selectedOption = await screen.findByRole("option", { name: /Clientes.*Escritas/ });
  expect(selectedOption).not.toHaveTextContent("9 opciones");
  await userEvent.type(screen.getByRole("searchbox", { name: "Buscar catálogo" }), "Clientes");
  await waitFor(() => expect(reads.some(query => query.get("search") === "Clientes" && query.get("page") === "1")).toBe(true));
});
it("retains the field but makes no catalog reads without CatalogsRead", async () => {
  let reads = 0; server.use(http.get("/api/forms/catalogs", () => { reads++; return HttpResponse.json(catalogPage()); }));
  await mountCatalogQuestion(vi.fn(), ["formtemplates.read", "formtemplates.manage"]);
  expect(screen.getByRole("combobox", { name: "Catálogo" })).toBeDisabled();
  expect(screen.getByText("Necesitás permiso para leer catálogos y elegir uno.")).toBeInTheDocument();
  expect(reads).toBe(0); expect(screen.queryByText(catalogA)).not.toBeInTheDocument();
});
