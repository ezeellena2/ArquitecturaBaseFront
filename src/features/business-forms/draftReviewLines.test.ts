import { describe, expect, it } from "vitest";
import { openDraftSession } from "./draftSession";
import { createDraftReview } from "./editorModel";
import { draftReviewLines } from "./draftReviewLines";
import type { DraftEditorValue, DraftQuestion, FormDefinitionSnapshot } from "./model";

const catalog = "01990000-0000-7000-8000-000000000091";
const definition: FormDefinitionSnapshot = { offerWhen: null, id: "form", name: { es: "Recepción de insumos" }, prefix: "INS", prefixLocked: false, revision: 2,
  draft: { format: 1, culture: "es", submitLabel: { es: "Enviar" }, fields: [
    { fieldId: "item", key: "item", type: "choice", label: { es: "Artículo" }, help: null, required: true,
      source: { catalog, match: [{ fieldId: "category", value: "agro" }, { fieldId: "zone", personAttributeId: "assigned" }], presentation: null } },
    { fieldId: "amount", key: "amount", type: "decimal", label: { es: "Cantidad", en: "Quantity" }, help: null, required: false },
    { fieldId: "unit", key: "unit", type: "choice", label: { es: "Unidad", en: "Unit" }, help: null, required: true,
      options: [{ choiceId: "liters", label: { es: "Litros", en: "Liters" } }, { choiceId: "kilos", label: { es: "Kilos", en: "Kilograms" } }] },
    { fieldId: "variety", key: "variety", type: "multiChoice", label: { es: "Variedad" }, help: null, required: true, selection: { minSelected: 1, maxSelected: 2 },
      options: [{ choiceId: "soy", label: { es: "Soja" } }, { choiceId: "corn", label: { es: "Maíz" } }] },
    { fieldId: "photo", key: "photo", type: "photo", label: { es: "Foto del remito" }, help: null, required: true, files: { minFiles: 1, maxFiles: 3, photoSource: "cameraOrGallery" } },
    { fieldId: "notes", key: "notes", type: "longText", label: { es: "Observaciones" }, help: null, required: false, maxLength: 600 },
  ] },
};
const opened = () => openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value;
const editing = (change: (question: DraftQuestion) => DraftQuestion): DraftEditorValue => {
  const value = opened();
  return { ...value, draft: { ...value.draft, fields: value.draft.fields.map(change) } };
};
function lines(mine: DraftEditorValue, current = definition, kind?: string, catalogs = true) {
  const review = createDraftReview(mine, current);
  const row = review.rows.find(item => kind === undefined || item.kind === kind)!;
  return draftReviewLines(review, row, { culture: "es", catalogs });
}

describe("draftReviewLines", () => {
  it("reads a question that became required as one line with its two values", () => {
    expect(lines(editing(question => question.fieldId === "amount" ? { ...question, required: true } : question))).toEqual([
      { key: "required", label: { kind: "key", key: "required" }, before: { kind: "key", key: "no" }, after: { kind: "key", key: "yes" } },
    ]);
  });

  it("lists only the catalog filters and the presentation that changed, each with the field that names it", () => {
    const mine = editing(question => question.fieldId === "item" && question.type === "choice" && question.source ? { ...question, source: { ...question.source,
      match: [{ fieldId: "category", value: "herbicides" }, { fieldId: "zone", personAttributeId: "assigned" }],
      presentation: { title: ["code", "text"], description: ["detail"] } } } : question);
    expect(lines(mine)).toEqual([
      { key: "filter:category", label: { kind: "field", catalogId: catalog, fieldId: "category" },
        before: { kind: "condition", catalogId: catalog, condition: { fieldId: "category", value: "agro" } },
        after: { kind: "condition", catalogId: catalog, condition: { fieldId: "category", value: "herbicides" } } },
      { key: "presentation", label: { kind: "key", key: "catalogs.presentation.title" },
        before: { kind: "key", key: "catalogQuestion.presentation.inherit" }, after: { kind: "key", key: "catalogQuestion.presentation.own" } },
      { key: "presentation.title", label: { kind: "key", key: "catalogQuestion.review.heading" }, before: { kind: "none" },
        after: { kind: "presentation", catalogId: catalog, parts: ["code", "text"] } },
      { key: "presentation.description", label: { kind: "key", key: "catalogQuestion.review.description" }, before: { kind: "none" },
        after: { kind: "presentation", catalogId: catalog, parts: ["detail"] } },
    ]);
  });

  it("without reading catalogs, falls back to the data both versions share rather than an empty change", () => {
    const mine = editing(question => question.fieldId === "item" && question.type === "choice" && question.source
      ? { ...question, source: { ...question.source, presentation: { title: ["text"], description: [] } } } : question);
    expect(lines(mine, definition, "field", false).map(line => [line.key, line.before, line.after])).toEqual([
      ["type", { kind: "key", key: "types.catalogChoice" }, { kind: "key", key: "types.catalogChoice" }],
      ["required", { kind: "key", key: "yes" }, { kind: "key", key: "yes" }],
      ["multiple", { kind: "key", key: "no" }, { kind: "key", key: "no" }],
    ]);
  });

  it("shows every datum of a question that is only in one version, and «Quitada» once in the other", () => {
    const current = { ...definition, revision: 3, draft: { ...definition.draft, fields: [...definition.draft.fields,
      { fieldId: "date", key: "date", type: "date" as const, label: { es: "Fecha de entrega" }, help: { es: "La del remito" }, required: true }] } };
    expect(lines(opened(), current)).toEqual([
      { key: "type", label: { kind: "key", key: "type" }, before: { kind: "key", key: "types.date" }, after: { kind: "missing", key: "removed" } },
      { key: "required", label: { kind: "key", key: "required" }, before: { kind: "key", key: "yes" }, after: null },
      { key: "help", label: { kind: "key", key: "help" }, before: { kind: "text", text: "La del remito" }, after: null },
    ]);
  });

  it("reads an order as numbered lists that mark what moved", () => {
    const value = opened();
    const [item, amount, unit, ...rest] = value.draft.fields;
    const mine = { ...value, draft: { ...value.draft, fields: [item!, unit!, amount!, ...rest] } };
    const text = (label: string, moved = false) => ({ value: { kind: "text", text: label }, moved });
    expect(lines(mine, definition, "order")).toEqual([{ key: "value",
      before: { kind: "list", items: [text("Artículo"), text("Cantidad", true), text("Unidad", true), text("Variedad"), text("Foto del remito"), text("Observaciones")] },
      after: { kind: "list", items: [text("Artículo"), text("Unidad", true), text("Cantidad", true), text("Variedad"), text("Foto del remito"), text("Observaciones")] } }]);
  });

  it("reads a translation as one value, «Sin traducir» while it is missing", () => {
    const mine = editing(question => question.fieldId === "notes" ? { ...question, help: { es: null, en: "Describe any damage." } } : question);
    expect(lines(mine, definition, "fieldText")).toEqual([
      { key: "value", before: { kind: "missing", key: "translationPending" }, after: { kind: "text", text: "Describe any damage." } },
    ]);
  });

  it("reads an option added on one side in each of its languages", () => {
    const mine = editing(question => question.fieldId === "unit" && question.type === "choice" && !question.source
      ? { ...question, options: [...question.options, { localId: "tons", choiceId: null, label: { es: "Toneladas", en: "Tons" } }] } : question);
    expect(lines(mine, definition, "option")).toEqual([
      { key: "es", label: { kind: "culture", culture: "es" }, before: { kind: "missing", key: "removed" }, after: { kind: "text", text: "Toneladas" } },
      { key: "en", label: { kind: "culture", culture: "en" }, before: null, after: { kind: "text", text: "Tons" } },
    ]);
    const single = editing(question => question.fieldId === "variety" && question.type === "multiChoice" && !question.source
      ? { ...question, options: [...question.options, { localId: "wheat", choiceId: null, label: { es: "Trigo" } }] } : question);
    expect(lines(single, definition, "option")).toEqual([{ key: "value", before: { kind: "missing", key: "removed" }, after: { kind: "text", text: "Trigo" } }]);
  });

  it("reads the minimum and maximum of a multiple choice and of the photos apart, and where the photo comes from", () => {
    expect(lines(editing(question => question.type === "multiChoice" ? { ...question, selection: { minSelected: 1, maxSelected: 3 } } : question))).toEqual([
      { key: "selection.maximum", label: { kind: "key", key: "multiple.maximum" }, before: { kind: "text", text: "2" }, after: { kind: "text", text: "3" } },
    ]);
    expect(lines(editing(question => question.type === "photo" ? { ...question, files: { minFiles: 1, maxFiles: 5, photoSource: "camera" } } : question))).toEqual([
      { key: "files.maximum", label: { kind: "key", key: "files.maximum" }, before: { kind: "text", text: "3" }, after: { kind: "text", text: "5" } },
      { key: "files.source", label: { kind: "key", key: "files.photoSource" }, before: { kind: "key", key: "files.sources.cameraOrGallery" }, after: { kind: "key", key: "files.sources.camera" } },
    ]);
  });
});

describe("the block of rows in the review", () => {
  const withBlock: FormDefinitionSnapshot = { ...definition, draft: { ...definition.draft, fields: [...definition.draft.fields,
    { fieldId: "items", key: "items", type: "group", label: { es: "Artículos" }, help: null, required: true, rows: { minRows: 1, maxRows: 20 } },
    { fieldId: "quantity", key: "quantity", type: "decimal", label: { es: "Cantidad por renglón" }, help: null, required: true, repeated: true }] } };
  const openedBlock = () => openDraftSession({ actorId: "actor", editorId: "editor" }, withBlock).value;

  it("compares a block by its minimum and maximum, without «Obligatoria»", () => {
    const value = openedBlock();
    const mine = { ...value, draft: { ...value.draft, fields: value.draft.fields.map(question => question.type === "group"
      ? { ...question, rows: { minRows: 0, maxRows: 20 }, required: false } : question) } };

    expect(lines(mine, withBlock)).toEqual([
      { key: "rows.minimum", label: { kind: "key", key: "rows.minimum" }, before: { kind: "text", text: "1" }, after: { kind: "text", text: "0" } },
    ]);
  });
  it("says a question of the block is loaded several times when only one version has it", () => {
    const value = openedBlock();
    const mine = { ...value, draft: { ...value.draft, fields: value.draft.fields.filter(question => question.fieldId !== "quantity") } };
    const review = createDraftReview(mine, withBlock);
    const row = review.rows.find(item => item.kind === "field" && item.parentId === "quantity")!;

    expect(draftReviewLines(review, row, { culture: "es", catalogs: true })).toEqual([
      { key: "type", label: { kind: "key", key: "type" }, before: { kind: "key", key: "types.decimal" }, after: { kind: "missing", key: "removed" } },
      { key: "required", label: { kind: "key", key: "required" }, before: { kind: "key", key: "yes" }, after: null },
      { key: "repeated", label: { kind: "key", key: "rows.repeated" }, before: { kind: "key", key: "yes" }, after: null },
    ]);
  });
});
