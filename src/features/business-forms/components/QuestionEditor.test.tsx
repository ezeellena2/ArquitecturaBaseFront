// Synthetic current detail; real catalog bodies are qualified in HTTP tests.
const manualDetail = { valueType: "Text", kind: "Manual", proposal: null, revision: 1, isActive: true, usageCount: null, unavailableReasonCode: null, filters: null, description: { es: "Catálogo de prueba", en: "Test catalog" } };
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
function catalogPage() { return { items: [{ valueType: "Text" as const, id: catalogA, name: "Clientes", description: "Clientes activos", origin: "Manual", optionsCount: 3, usageCount: null, state: "Active", stateReason: null, canEdit: false }, { valueType: "Text" as const, id: catalogB, name: "Supervisores", description: null, origin: "Filters", optionsCount: null, usageCount: null, state: "Active", stateReason: null, canEdit: false }, { valueType: "Text" as const, id: catalogInvalid, name: "Responsables", description: null, origin: "Filters", optionsCount: null, usageCount: null, state: "Unavailable", stateReason: "Forms.Catalog.ContentInvalid", canEdit: false }, { valueType: "Text" as const, id: "01990000-0000-7000-8000-000000000094", name: "Archivados", description: null, origin: "Manual", optionsCount: 2, usageCount: null, state: "Inactive", stateReason: null, canEdit: false }], page: 1, pageSize: 20, totalCount: 4, totalPages: 1, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 4, manual: 2, filters: 2 } } }; }
async function mountCatalogQuestion(onChange = vi.fn(), permissions = catalogScope.permissions, issues: readonly DraftFieldIssue[] = []) {
  await act(async () => { renderWithProviders(<MemoryRouter><QuestionEditor question={catalogQuestion} position={1} total={1} culture="es" original="es" expanded readOnly={false} issues={issues} onChange={onChange} onExpand={() => {}} onMove={() => {}} onRemove={() => {}} {...{ catalogScope: { ...catalogScope, permissions } }} /></MemoryRouter>); });
  return onChange;
}
it("offers the catalog question type and shows invalid catalogs without allowing selection", async () => {
  server.use(http.get("/api/forms/catalogs", ({ request }) => { expect(new URL(request.url).searchParams.has("state")).toBe(false); return HttpResponse.json(catalogPage()); }));
  await mountCatalogQuestion();
  expect(screen.getByRole("option", { name: "Elegir de un catálogo" })).toBeInTheDocument();
  expect(await screen.findByRole("option", { name: /Responsables.*El catálogo tiene una configuración no válida/ })).toBeDisabled();
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

it("marks untranslated secondary text neutrally and preserves the original reference without validation", async () => {
  const question: DraftQuestion = { ...first, help: { es: "Elegí un cliente." }, options: first.options.map((option,index) => ({ ...option, label: index === 0 ? option.label : { ...option.label, en: "South" } })) };
  const onChange = vi.fn();
  await act(async () => { renderWithProviders(<QuestionEditor question={question} position={1} total={1} culture="en" original="es" expanded readOnly={false} issues={[]} onChange={onChange} onExpand={() => {}} onMove={() => {}} onRemove={() => {}} />); });
  expect(screen.getByLabelText("Pregunta")).toHaveAttribute("placeholder", "Sin traducir");
  expect(screen.getByLabelText("Ayuda para el empleado")).toHaveAttribute("placeholder", "Sin traducir");
  expect(screen.getByLabelText("Opción 1")).toHaveAttribute("placeholder", "Sin traducir");
  expect(screen.getByText("Sin traducir")).toBeInTheDocument();
  expect(screen.getByText(/3 sin traducir/)).toBeInTheDocument();
  expect(screen.getByText("Original (Español): Cliente")).toBeInTheDocument();
  expect(screen.getByText("Original (Español): Elegí un cliente.")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Pregunta")).not.toHaveAttribute("aria-invalid", "true");
  expect(onChange).not.toHaveBeenCalled();
});

// CA4 characterization, applied only after the closed model accepts multiChoice.
it("requires an explicit decision before replacing a saved question and every own option identity", async () => {
  const onChange = vi.fn();
  await act(async () => { renderWithProviders(<QuestionEditor question={first} position={1} total={1}
    culture="es" original="es" expanded readOnly={false} issues={[]} onChange={onChange}
    onExpand={() => {}} onMove={() => {}} onRemove={() => {}} />); });
  const toggle = screen.getByRole("checkbox", { name: "Permitir elegir varias" });
  await userEvent.click(screen.getByText("Permitir elegir varias", { exact: true }));
  expect(onChange).not.toHaveBeenCalled();
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
  expect(onChange).not.toHaveBeenCalled();
  expect(toggle).not.toBeChecked();
  expect(toggle).toHaveFocus();
  await userEvent.click(screen.getByText("Permitir elegir varias", { exact: true }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Crear la pregunta nueva" }));
  expect(onChange).toHaveBeenCalledOnce();
  const changed = onChange.mock.calls[0]![0] as DraftQuestion;
  expect(changed).toMatchObject({ type: "multiChoice", fieldId: null, replacesFieldId: first.fieldId,
    selection: { minSelected: 1, maxSelected: 3 }, label: first.label, help: first.help });
  expect(changed.localId).not.toBe(first.localId);
  if (changed.type !== "multiChoice" || changed.source || first.type !== "choice" || first.source) throw new Error("Expected own choices.");
  expect(changed.options.map(option => option.label)).toEqual(first.options.map(option => option.label));
  expect(changed.options.every(option => option.choiceId === null)).toBe(true);
  expect(changed.options.every(option => !first.options.some(previous => previous.localId === option.localId))).toBe(true);
});
it("does not apply a pending multiplicity decision after the editor loses write permission", async () => {
  const onChange = vi.fn();
  const props = { question: first, position: 1, total: 1, culture: "es" as const, original: "es" as const,
    expanded: true, issues: [], onChange, onExpand: () => {}, onMove: () => {}, onRemove: () => {} };
  let view!: ReturnType<typeof renderWithProviders>;
  await act(async () => { view = renderWithProviders(<QuestionEditor {...props} readOnly={false}/>); });
  await userEvent.click(screen.getByText("Permitir elegir varias", { exact: true }));
  view.rerender(<QuestionEditor {...props} readOnly/>);
  const confirm = within(screen.getByRole("dialog")).getByRole("button", { name: "Crear la pregunta nueva" });
  await userEvent.click(confirm);
  expect(onChange).not.toHaveBeenCalled();
});
function MultipleRangeHarness() {
  if (first.type !== "choice" || first.source) throw new Error("Expected own choices");
  const [question, setQuestion] = useState<DraftQuestion>({ ...first, type: "multiChoice", required: true,
    selection: { minSelected: 1, maxSelected: 3 } });
  return <QuestionEditor question={question} position={1} total={1} culture="es" original="es" expanded
    readOnly={false} issues={[]} onChange={setQuestion} onExpand={() => {}} onMove={() => {}} onRemove={() => {}}/>;
}
it("keeps cleared bounds invalid instead of silently making the question optional", async () => {
  await act(async () => { renderWithProviders(<MultipleRangeHarness/>); });
  const minimum = screen.getByRole("spinbutton", { name: "Mínimo" });
  const maximum = screen.getByRole("spinbutton", { name: "Máximo" });
  await userEvent.clear(minimum);
  expect(minimum).toHaveValue(null);
  expect(minimum).toHaveAttribute("aria-invalid", "true");
  expect(maximum).toHaveAttribute("aria-invalid", "true");
  await userEvent.type(minimum, "0");
  expect(screen.getByRole("checkbox", { name: "Obligatoria" })).not.toBeChecked();
  await userEvent.clear(maximum); await userEvent.type(maximum, "0");
  expect(maximum).toHaveValue(0);
  expect(maximum).toHaveAttribute("aria-invalid", "true");
  await userEvent.clear(maximum); await userEvent.type(maximum, "20");
  expect(maximum).not.toHaveAttribute("aria-invalid", "true");
});
it("preserves twenty-one authored options while refusing to add another, rather than clipping them", async () => {
  const question: DraftQuestion = { ...first, type: "multiChoice", selection: { minSelected: 1, maxSelected: 20 },
    options: Array.from({ length: 21 }, (_, index) => ({ localId: "own-" + index, choiceId: null, label: { es: "Opción " + (index + 1) } })) };
  await act(async () => { renderWithProviders(<QuestionEditor question={question} position={1} total={1}
    culture="es" original="es" expanded readOnly={false} issues={[]} onChange={vi.fn()}
    onExpand={() => {}} onMove={() => {}} onRemove={() => {}} />); });
  expect(screen.getByLabelText("Opción 21")).toHaveValue("Opción 21");
  expect(screen.getByRole("button", { name: "Agregar opción" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("20 opciones");
});
