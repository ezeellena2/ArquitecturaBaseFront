import {http,HttpResponse} from "msw";
import {server} from "@/test/mocks/server";
import type { CatalogDetail } from "../api/catalogResponse";
import { act, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { DraftReview } from "./DraftReview";
import { createDraftReview, resolveDraftReview, changeQuestionCatalog } from "../editorModel";
import { openDraftSession } from "../draftSession";
import type { FormDefinitionSnapshot } from "../model";

const definition: FormDefinitionSnapshot = { offerWhen: null,
  id: "form", name: { es: "Visita" }, prefix: "VIS", prefixLocked: true, revision: 2,
  draft: { format: 1, culture: "es", submitLabel: { es: "Enviar" }, fields: [
    { fieldId: "customer", key: "customer", type: "choice", label: { es: "Cliente" }, help: null, required: true,
      options: [{ choiceId: "north", label: { es: "Norte" } }, { choiceId: "south", label: { es: "Sur" } }] },
  ] },
};
describe("Draft review presentation", () => {
  it("keeps allowed changes in one explicit action without extra decisions or saving", async () => {
    const saved = openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value;
    const value = { ...saved, draft: { ...saved.draft, fields: saved.draft.fields.map(q => q.type === "choice" && !q.source
      ? { ...q, options: [...q.options].reverse().map(o => o.choiceId === "north" ? { ...o, label: { es: "Norte actualizado" } } : o) } : q) } };
    const onResolve = vi.fn();
    await act(async () => { renderWithProviders(<DraftReview value={value} definition={definition} culture="es" open onOpenChange={vi.fn()} onUseCurrent={vi.fn()} onResolve={onResolve} />); });
    const dialog = screen.getByRole("dialog", { name: "Revisión del borrador" });
    // The comparison speaks for itself: no description under the title and no note before the choices (2026-10-31).
    expect(dialog).not.toHaveAccessibleDescription();
    expect(within(dialog).queryByText(/Ninguna opción guarda|Compará lo guardado/)).not.toBeInTheDocument();
    // Each change once, and both versions in their own column (LR2-A): an option, never «Opción: Norte», and an order numbered.
    expect(within(dialog).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Qué cambió", "Guardado actualmente", "Mis cambios"]);
    const option = within(dialog).getByRole("rowheader", { name: "Cliente · la opción «Norte actualizado» · Español" }).closest("tr")!;
    expect(within(option).getAllByRole("cell").map(cell => cell.textContent)).toEqual(["Norte", "Norte actualizado"]);
    const order = within(dialog).getByRole("rowheader", { name: "Orden de opciones de Cliente" }).closest("tr")!;
    expect(within(order).getAllByRole("cell").map(cell => within(cell).getAllByRole("listitem").map(item => item.textContent))).toEqual([["1Norte", "2Sur"], ["1Sur", "2Norte actualizado"]]);
    expect(dialog).not.toHaveTextContent("→");
    expect(dialog).not.toHaveTextContent("[object Object]");
    expect(dialog).not.toHaveTextContent("choiceId");
    await userEvent.click(within(dialog).getByRole("button", { name: "Conservar mis cambios" }));
    expect(onResolve).toHaveBeenCalledOnce();
    expect(Object.values(onResolve.mock.calls[0]![0])).toEqual(["mine", "mine"]);
    expect(within(dialog).queryByRole("combobox")).not.toBeInTheDocument();
  });
  it("explains a locked prefix without calling it a retired question", async () => {
    const value = { ...openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value, prefix: "ENT" };
    await act(async () => { renderWithProviders(<DraftReview value={value} definition={definition} culture="es" open onOpenChange={vi.fn()} onUseCurrent={vi.fn()} onResolve={vi.fn()} />); });
    const dialog = screen.getByRole("dialog", { name: "Revisión del borrador" });
    expect(within(dialog).getByText("El prefijo quedó fijo cuando se aceptó la primera publicación, aunque después no se haya completado.")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("retirada");
  });
});

it("retains local edits, marks remote additions and cannot revive a remotely removed option or question", async () => {
  const before = { ...definition, draft: { ...definition.draft, fields: [...definition.draft.fields,
    { fieldId: "notes", key: "notes", type: "longText" as const, label: { es: "Observaciones" }, help: { es: "Antes" }, required: false, maxLength: 600 }] } };
  const local = openDraftSession({ actorId: "actor", editorId: "editor" }, before).value;
  const mine = { ...local, name: { es: "Mi visita" }, draft: { ...local.draft, fields: local.draft.fields.map(q => q.type === "choice" && !q.source
    ? { ...q, options: q.options.map(o => o.choiceId === "north" ? { ...o, label: { es: "Mi Norte" } } : o) }
    : { ...q, help: { es: "Mi ayuda" } }) } };
  const remote = { ...definition, revision: 3, draft: { ...definition.draft, fields: [
    ...definition.draft.fields.slice(0, 1).map(q => q.type === "choice" && !q.source ? { ...q, options: q.options.slice(0, 1) } : q),
    { fieldId: "date", key: "date", type: "date" as const, label: { es: "Fecha agregada por otra persona" }, help: null, required: true }] } };
  const onResolve = vi.fn();
  await act(async () => { renderWithProviders(<DraftReview value={mine} definition={remote} culture="es" open onOpenChange={vi.fn()} onUseCurrent={vi.fn()} onResolve={onResolve} />); });
  const dialog = screen.getByRole("dialog");
  expect(dialog).toHaveTextContent("Mi ayuda");
  expect(dialog).toHaveTextContent("Fecha agregada por otra persona");
  expect(dialog).toHaveTextContent("ya fue retirada");
  await userEvent.click(within(dialog).getByRole("button", { name: "Conservar mis cambios" }));
  const resolved = resolveDraftReview(createDraftReview(mine, remote), onResolve.mock.calls[0]![0])!;
  expect(resolved.name.es).toBe("Mi visita");
  expect(resolved.draft.fields.some(q => q.fieldId === "notes")).toBe(false);
  const customer = resolved.draft.fields.find(q => q.fieldId === "customer")!;
  expect(customer.type === "choice" && !customer.source && customer.options.map(o => o.choiceId)).toEqual(["north"]);
  expect(customer.type === "choice" && !customer.source && customer.options[0]!.label.es).toBe("Mi Norte");
});

it("names catalog questions consistently when reviewing a source replacement", async () => {
  const current: FormDefinitionSnapshot = { ...definition, draft: { ...definition.draft, fields: [{ fieldId: "catalog-field", key: "field_catalog", type: "choice", source: { catalog: "01990000-0000-7000-8000-000000000091" }, label: { es: "Cliente" }, help: null, required: true }] } };
  const opened = openDraftSession({ actorId: "actor", editorId: "editor" }, current).value;
  const mine = { ...opened, draft: { ...opened.draft, fields: [changeQuestionCatalog(opened.draft.fields[0]!, "01990000-0000-7000-8000-000000000092", "new-local")] } };
  const catalog: CatalogDetail = { id: "01990000-0000-7000-8000-000000000091", key: "01990000000070008000000000000091",
    name: { es: "Proveedores", en: "Suppliers" }, description: { es: "Personas disponibles", en: "Available people" },
    kind: "Manual", valueType: "Text", revision: 1, isActive: true, itemsCount: 0, usageCount: null,
    originalCulture: "es", unavailableReasonCode: null, filters: null, proposal: null, fields: [], presentation: null, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } };
  server.use(http.get("/api/forms/catalogs/:id",({params})=>{ return HttpResponse.json({...catalog,id:params.id,key:String(params.id).replaceAll("-","")}); }));
  await act(async () => { renderWithProviders(<DraftReview catalogScope={{actorId:"actor",culture:"es",permissions:["formcatalogs.read"]}} value={mine} definition={current} culture="es" open onOpenChange={vi.fn()} onUseCurrent={vi.fn()} onResolve={vi.fn()} />); });
  // The replacement is another question: the saved one leaves and the new one comes, each named by its catalog, never its GUID.
  const dialog = screen.getByRole("dialog");
  const sources = within(dialog).getAllByRole("rowheader", { name: "Catálogo" }).map(header => header.closest("tr")!);
  await waitFor(() => expect(sources.map(source => within(source).getAllByRole("cell").map(cell => cell.textContent))).toEqual([[catalog.name.es, ""], ["", catalog.name.es]]));
  expect(dialog).not.toHaveTextContent("01990000");
});

it("names a changed catalog filter by its field and reads each version's value apart", async () => {
  const field = { id: "01990000-0000-7000-8000-000000000101", key: "category", name: { es: "Rubro" }, type: "text" as const, sourceCatalogId: null, required: false, unique: false,
    min: null, max: null, maxLength: null, role: "filter" as const, position: 0, isActive: true, valuesCount: 2, usedBy: [] };
  const current: FormDefinitionSnapshot = { ...definition, draft: { ...definition.draft, fields: [{ fieldId: "catalog-field", key: "field_catalog", type: "choice", label: { es: "Artículo" }, help: null, required: true,
    source: { catalog: "01990000-0000-7000-8000-000000000091", match: [{ fieldId: field.id, value: "Agroquímicos" }] } }] } };
  const opened = openDraftSession({ actorId: "actor", editorId: "editor" }, current).value;
  const mine = { ...opened, draft: { ...opened.draft, fields: opened.draft.fields.map(question => question.type === "choice" && question.source
    ? { ...question, source: { ...question.source, match: [{ fieldId: field.id, value: "Herbicidas" }] } } : question) } };
  server.use(http.get("/api/forms/catalogs/:id", ({ params }) => HttpResponse.json({ id: params.id, key: String(params.id).replaceAll("-", ""), name: { es: "Artículos" }, description: { es: "Insumos" },
    kind: "Manual", valueType: "Text", revision: 1, isActive: true, itemsCount: 0, usageCount: null, originalCulture: "es", unavailableReasonCode: null, filters: null, proposal: null,
    fields: [field], presentation: null, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } })));
  await act(async () => { renderWithProviders(<DraftReview catalogScope={{ actorId: "actor", culture: "es", permissions: ["formcatalogs.read"] }} value={mine} definition={current} culture="es" open onOpenChange={vi.fn()} onUseCurrent={vi.fn()} onResolve={vi.fn()} />); });
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByRole("rowheader", { name: "Artículo" })).toBeInTheDocument();
  const filter = (await within(dialog).findByRole("rowheader", { name: "Rubro" })).closest("tr")!;
  expect(within(filter).getAllByRole("cell").map(cell => cell.textContent)).toEqual(["Agroquímicos", "Herbicidas"]);
  expect(dialog).not.toHaveTextContent("Rubro:");
});

it("names a multi-choice translation with the label of the selected display culture", async () => {
  const own = definition.draft.fields[0];
  if (own.type !== "choice" || own.source) throw new Error("Expected authored choices");
  const current: FormDefinitionSnapshot = { ...definition, draft: { ...definition.draft, fields: [{
    ...own, type: "multiChoice", selection: { minSelected: 1, maxSelected: 3 }, label: { es: "Cliente", en: "Customer" },
    options: own.options.map(option => ({ ...option, label: { ...option.label, en: option.choiceId === "north" ? "North" : "South" } })),
  }] } };
  const opened = openDraftSession({ actorId: "actor", editorId: "editor" }, current).value;
  const mine = { ...opened, draft: { ...opened.draft, fields: opened.draft.fields.map(question =>
    question.type === "multiChoice" && !question.source ? { ...question, options: question.options.map(option =>
      option.choiceId === "north" ? { ...option, label: { ...option.label, es: "Mi Norte" } } : option) } : question) } };
  await act(async () => { renderWithProviders(<DraftReview value={mine} definition={current} culture="en"
    open onOpenChange={vi.fn()} onUseCurrent={vi.fn()} onResolve={vi.fn()} />); });
  expect(within(screen.getByRole("dialog")).getByRole("rowheader", { name: "Customer · la opción «North» · Español" })).toBeInTheDocument();
});
