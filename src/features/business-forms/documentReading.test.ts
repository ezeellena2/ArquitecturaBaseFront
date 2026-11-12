import { describe, expect, it } from "vitest";
import type { CatalogField } from "./api/catalogResponse";
import { changeDocumentReading, documentLookupsIncomplete, documentReadingIncomplete, groupReadingExamples, keptComparison, lookupComparisons, lookupQuestions, maxDocumentLookups,
  readingQuestionName, standardDataRows, unchangedShare, withoutDanglingLookups, withoutIncompleteLookups } from "./documentReading";
import { readingDefinition, readingIds } from "@/test/visual/documentReadingFixtures";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { draftReviewLines } from "./draftReviewLines";
import { openDraftSession } from "./draftSession";
import { changeQuestionCatalog, createDraftReview, replaceQuestionType, resolveDraftReview, type DraftReview } from "./editorModel";
import type { DraftEditorValue, DraftQuestion } from "./model";

// DOC1: «Lectura de documentos» in the editor. The reading travels with the draft; its lookups name questions like a filter does,
// by their field identity or, while new, by their local one.
const question = (localId: string, fieldId: string | null, extra: Partial<DraftQuestion> = {}): DraftQuestion =>
  ({ localId, fieldId, replacesFieldId: null, type: "shortText", maxLength: 80, label: { es: localId }, help: null, required: false, ...extra } as DraftQuestion);
const catalog = (localId: string, fieldId: string | null, catalogId: string | null = "catalog-clients", extra: Partial<DraftQuestion> = {}) =>
  question(localId, fieldId, { type: "choice", source: { catalog: catalogId }, ...extra } as Partial<DraftQuestion>);
const value = (fields: readonly DraftQuestion[], reading?: DraftEditorValue["draft"]["documentReading"]): DraftEditorValue =>
  ({ name: { es: "Pagos" }, prefix: "PAG", offerWhen: null, draft: { format: 1, culture: "es", submitLabel: { es: "Enviar" }, fields, ...reading ? { documentReading: reading } : {},
    sections: [{ start: 0, title: { es: "Origen" }, localId: "section-0" }] } });
const field = (id: string, type: CatalogField["type"], isActive = true) => ({ id, key: id.replaceAll("-", "_"), name: { es: id }, type, sourceCatalogId: null, required: false, unique: false,
  min: null, max: null, maxLength: null, role: "data", position: 0, isActive, valuesCount: 0, usedBy: [] }) as CatalogField;

describe("the reading in the draft", () => {
  it("keeps the key where it was, and leaves it out when it is off with nothing written, as the server does", () => {
    const reading = { enabled: true, recognition: "Comprobante de una transferencia.", lookups: [] };
    const saved = value([], reading);
    // Turned off it keeps what was written; the key stays in its place, so turning it on again leaves the draft as saved.
    const off = changeDocumentReading(saved, { ...reading, enabled: false });
    expect(off.draft.documentReading).toEqual({ ...reading, enabled: false });
    expect(JSON.stringify(changeDocumentReading(off, reading))).toBe(JSON.stringify(saved));
    // On and off again on a draft that never had it: nothing changed, so the draft goes back to its bytes.
    const never = value([]);
    const turnedOn = changeDocumentReading(never, { enabled: true, recognition: "", lookups: [] });
    expect(turnedOn.draft.documentReading).toEqual({ enabled: true, recognition: "", lookups: [] });
    expect(JSON.stringify(changeDocumentReading(turnedOn, { enabled: false, recognition: "", lookups: [] }))).toBe(JSON.stringify(never));
  });

  it("knows a lookup still to complete and drops only those when the reading is no longer shown", () => {
    const complete = { questionId: "field-client", sourceQuestionId: "field-tax", field: "code" };
    const started = { questionId: "field-client", sourceQuestionId: "", field: "" };
    const reading = { enabled: true, recognition: "Comprobante.", lookups: [complete, started] };
    expect(documentLookupsIncomplete(reading)).toBe(true);
    expect(documentLookupsIncomplete({ ...reading, lookups: [complete] })).toBe(false);
    expect(documentLookupsIncomplete(undefined)).toBe(false);
    expect(withoutIncompleteLookups(value([], reading)).draft.documentReading?.lookups).toEqual([complete]);
    // Without anything else, the reading that was only a lookup started goes away with it.
    expect(withoutIncompleteLookups(value([], { enabled: false, recognition: "", lookups: [started] })).draft).not.toHaveProperty("documentReading");
    expect(maxDocumentLookups).toBe(5);
  });

  it("turned off, drops a lookup left half chosen, which nothing would show, and keeps the complete ones", () => {
    const complete = { questionId: "field-client", sourceQuestionId: "field-tax", field: "code" };
    const started = { questionId: "", sourceQuestionId: "field-tax", field: "" };
    const off = changeDocumentReading(value([]), { enabled: false, recognition: "Comprobante.", lookups: [complete, started] });
    expect(off.draft.documentReading).toEqual({ enabled: false, recognition: "Comprobante.", lookups: [complete] });
    expect(documentLookupsIncomplete(off.draft.documentReading)).toBe(false);
    // On, it is still being chosen and stays.
    expect(changeDocumentReading(value([]), { enabled: true, recognition: "", lookups: [started] }).draft.documentReading?.lookups).toEqual([started]);
  });

  it("asks for «Cómo reconocerlo» and complete lookups only while it is on", () => {
    const complete = { questionId: "field-client", sourceQuestionId: "field-tax", field: "code" };
    expect(documentReadingIncomplete({ enabled: true, recognition: "Comprobante.", lookups: [complete] })).toBe(false);
    expect(documentReadingIncomplete({ enabled: true, recognition: "  \n ", lookups: [] })).toBe(true);
    expect(documentReadingIncomplete({ enabled: true, recognition: "Comprobante.", lookups: [{ ...complete, field: "" }] })).toBe(true);
    expect(documentReadingIncomplete({ enabled: false, recognition: "", lookups: [] })).toBe(false);
    expect(documentReadingIncomplete(undefined)).toBe(false);
  });
});

describe("a lookup never names what is no longer there", () => {
  const client = catalog("client", "field-client");
  const tax = question("tax", "field-tax");
  const date = question("date-local", null, { type: "date" } as Partial<DraftQuestion>);
  const byTax = { questionId: "field-client", sourceQuestionId: "FIELD-TAX", field: "code" };
  const byDate = { questionId: "field-client", sourceQuestionId: "date-local", field: "field-since" };
  const started = { questionId: "", sourceQuestionId: "", field: "" };
  const draft = (fields: readonly DraftQuestion[], enabled = true) => value(fields, { enabled, recognition: "Comprobante.", lookups: [byTax, byDate, started] });
  const lookups = (result: DraftEditorValue) => result.draft.documentReading?.lookups;

  it("keeps what names its questions, a new one by its local identity, and what is still being chosen", () => {
    const whole = draft([client, tax, date]);
    expect(withoutDanglingLookups(whole)).toBe(whole);
  });

  it("drops the lookups of a removed question, as what it reads or what it fills, on or off", () => {
    expect(lookups(withoutDanglingLookups(draft([client, date])))).toEqual([byDate, started]);
    expect(lookups(withoutDanglingLookups(draft([tax, date], false)))).toEqual([]);
    // Off without a text, the reading that was only those lookups goes with them, as the server leaves it.
    expect(withoutDanglingLookups(value([tax], { enabled: false, recognition: "", lookups: [byTax] })).draft).not.toHaveProperty("documentReading");
  });

  it("drops them when a question takes another identity: another type or, once saved, another catalog", () => {
    expect(lookups(withoutDanglingLookups(draft([replaceQuestionType(client, "choice", "client-again", "es"), tax, date])))).toEqual([started]);
    expect(lookups(withoutDanglingLookups(draft([client, replaceQuestionType(tax, "longText", "tax-again", "es"), date])))).toEqual([byDate, started]);
    expect(lookups(withoutDanglingLookups(draft([changeQuestionCatalog(client, "catalog-other", "client-other"), tax, date])))).toEqual([started]);
  });

  it("drops them when a catalog question stops being one a lookup can fill, or a question goes into the block", () => {
    const several = { ...client, type: "multiChoice", selection: { minSelected: 0, maxSelected: 2 } } as DraftQuestion;
    expect(lookups(withoutDanglingLookups(draft([several, tax, date])))).toEqual([started]);
    expect(lookups(withoutDanglingLookups(draft([{ ...client, repeated: true } as DraftQuestion, tax, date])))).toEqual([started]);
    expect(lookups(withoutDanglingLookups(draft([client, { ...tax, repeated: true } as DraftQuestion, date])))).toEqual([byDate, started]);
  });
});

describe("what a lookup can name", () => {
  const block = question("block", "field-block", { type: "group", rows: { minRows: 1, maxRows: 5 }, required: true } as Partial<DraftQuestion>);
  const fields = [
    catalog("client", "field-client"), question("tax", "field-tax"), question("amount", "field-amount", { type: "decimal" } as Partial<DraftQuestion>),
    question("date", null, { type: "date" } as Partial<DraftQuestion>), question("notes", "field-notes", { type: "longText", maxLength: 600 } as Partial<DraftQuestion>),
    catalog("pending", "field-pending", null), catalog("tags", "field-tags", "catalog-tags", { type: "multiChoice", selection: { minSelected: 0, maxSelected: 3 } } as Partial<DraftQuestion>),
    question("done", "field-done", { type: "boolean" } as Partial<DraftQuestion>), block, question("detail", "field-detail", { repeated: true } as Partial<DraftQuestion>),
    catalog("product", "field-product", "catalog-products", { repeated: true } as Partial<DraftQuestion>),
  ];

  it("reads a text, a number or a date outside the block, and fills a catalog question of one choice outside it", () => {
    const { sources, targets } = lookupQuestions(fields, "es", "es");
    // A new question is named by its local identity; the numbers are the list's.
    expect(sources.map(item => [item.id, item.number, item.type])).toEqual([["field-tax", "2", "shortText"], ["field-amount", "3", "decimal"], ["date", "4", "date"], ["field-notes", "5", "longText"]]);
    expect(targets.map(item => [item.id, item.number, item.catalog])).toEqual([["field-client", "1", "catalog-clients"]]);
    expect(readingQuestionName(fields, "FIELD-TAX", "es", "es")).toBe("tax");
    expect(readingQuestionName(fields, "gone", "es", "es")).toBeNull();
  });

  it("compares a text with the option's code, its text or a text field, and a number or a date with a field of its kind", () => {
    const catalogFields = [field("tax-id", "text"), field("limit", "decimal"), field("count", "integer"), field("since", "date"), field("active", "boolean"),
      field("zone", "catalog"), field("old", "text", false)];
    const values = (type: string | null) => lookupComparisons(type, catalogFields).map(item => item.value);
    expect(values("shortText")).toEqual(["code", "text", "tax-id"]);
    expect(values("longText")).toEqual(["code", "text", "tax-id"]);
    expect(values("decimal")).toEqual(["limit", "count"]);
    expect(values("date")).toEqual(["since"]);
    // Before choosing what is read, everything that can be compared with something.
    expect(values(null)).toEqual(["code", "text", "tax-id", "limit", "count", "since"]);
    expect(lookupComparisons("shortText", []).map(item => item.value)).toEqual(["code", "text"]);
  });

  it("keeps what the lookup compares while it still can be compared, and asks again when it no longer can", () => {
    const catalogFields = [field("tax-id", "text"), field("limit", "decimal")];
    // Reading a number, the option's code no longer serves; reading a text, it still does.
    expect(keptComparison("code", "decimal", catalogFields)).toBe("");
    expect(keptComparison("code", "longText", catalogFields)).toBe("code");
    expect(keptComparison("limit", "decimal", catalogFields)).toBe("limit");
    expect(keptComparison("limit", "shortText", catalogFields)).toBe("");
    // A field of another catalog, or one of a catalog it cannot read, stays until it is known.
    expect(keptComparison("tax-id", "shortText", undefined)).toBe("tax-id");
    expect(keptComparison("other", "shortText", catalogFields)).toBe("");
  });
});

describe("the data of the standard", () => {
  it("pairs each datum with the question that receives it through its key, renamed or moved, with that question's fixed validation", () => {
    const account = question("account", "field-account", { label: { es: "Cuenta que transfirió" }, validation: "bankAccount" } as Partial<DraftQuestion>);
    const holder = question("holder", "FIELD-HOLDER");
    const fields = [holder, account];
    const reads = [{ key: "sourceAccount", name: "Cuenta de origen" }, { key: "sourceHolder", name: "Titular de origen" }, { key: "sourceTaxId", name: "CUIT o CUIL de origen" }];
    const rows = standardDataRows(reads, { sourceAccount: "field-account", sourceHolder: "field-holder", operation: "field-gone" }, fields);
    // In the standard's order, whatever the order of the questions; a renamed question still receives its datum, and the validation
    // is the one its question carries: a datum without a question has none.
    expect(rows.map(row => [row.key, row.name, row.question?.localId ?? null, row.validation])).toEqual([
      ["sourceAccount", "Cuenta de origen", "account", "bankAccount"], ["sourceHolder", "Titular de origen", "holder", null], ["sourceTaxId", "CUIT o CUIL de origen", null, null]]);
  });
});

describe("how it is reading", () => {
  it("never says that all of it was confirmed without changes when something was corrected", () => {
    expect(unchangedShare(999, 1000)).toBe(0.99);
    expect(unchangedShare(98, 112)).toBe(0.87);
    expect(unchangedShare(112, 112)).toBe(1);
    expect(unchangedShare(0, 5)).toBe(0);
  });
});

describe("the latest corrections", () => {
  it("groups the corrections of one response, in the order they came", () => {
    const correction = (recordId: string, questionId: string) => ({ recordId, recordNumber: recordId.toUpperCase(), confirmedAtUtc: "2026-11-10T14:30:00Z", questionId, read: "a", confirmed: "b" });
    const groups = groupReadingExamples([correction("rec-2", "q1"), correction("rec-2", "q2"), correction("rec-1", "q1")]);
    expect(groups.map(group => [group.recordId, group.items.map(item => item.questionId)])).toEqual([["rec-2", ["q1", "q2"]], ["rec-1", ["q1"]]]);
  });
});

// A 409 while saving: the reading is one change of the review, compared and kept as a whole, like the section titles.
describe("the reading in a conflict", () => {
  const scope = { actorId: "actor", editorId: "editor" };
  const choose = (review: DraftReview, choice: "mine" | "current") => Object.fromEntries(review.rows.map(row => [row.id, choice]));
  const readingRow = (review: DraftReview) => review.rows.find(row => row.kind === "documentReading");
  const lines = (review: DraftReview) => draftReviewLines(review, readingRow(review)!, { culture: "es", catalogs: true });

  it("lists the reading turned on and written here, and «Conservar mis cambios» keeps it", () => {
    const server = fixtureDefinition("es");
    // Meanwhile someone else renamed the form.
    const current = { ...server, revision: server.revision + 1, name: { ...server.name, es: "Visita guardada" } };
    const reading = { enabled: true, recognition: "Remito firmado por el cliente.", lookups: [] };
    const review = createDraftReview(changeDocumentReading(openDraftSession(scope, server).value, reading), current);
    expect(readingRow(review)).toMatchObject({ id: "documentReading", canKeep: true, mine: reading, current: null });
    expect(resolveDraftReview(review, choose(review, "mine"))?.draft.documentReading).toEqual(reading);
    expect(resolveDraftReview(review, choose(review, "current"))?.draft).not.toHaveProperty("documentReading");
    // Its lines say only what differs: on, and the text.
    expect(lines(review)).toEqual([
      { key: "enabled", label: { kind: "key", key: "documentReading.enabled" }, before: { kind: "key", key: "no" }, after: { kind: "key", key: "yes" } },
      { key: "recognition", label: { kind: "key", key: "documentReading.recognition" }, before: { kind: "none" }, after: { kind: "text", text: "Remito firmado por el cliente." } }]);
  });

  it("names each lookup by the question it reads and the one it fills, and a version without a reading takes it away", () => {
    const saved = readingDefinition("es");
    const opened = openDraftSession(scope, saved).value;
    const reading = opened.draft.documentReading!;
    const mine = changeDocumentReading(opened, { ...reading, lookups: [...reading.lookups, { questionId: readingIds.sourceBank, sourceQuestionId: readingIds.sourceAccount, field: "code" }] });
    const review = createDraftReview(mine, { ...saved, revision: saved.revision + 1 });
    expect(lines(review)).toEqual([{ key: "lookups", label: { kind: "key", key: "documentReading.lookups" },
      before: { kind: "list", items: [{ value: { kind: "text", text: "CUIT o CUIL de origen → Cliente" }, moved: false }] },
      after: { kind: "list", items: [{ value: { kind: "text", text: "CUIT o CUIL de origen → Cliente" }, moved: false },
        { value: { kind: "text", text: "Cuenta de origen → Banco o billetera de origen" }, moved: true }] } }]);
    expect(resolveDraftReview(review, choose(review, "mine"))?.draft.documentReading?.lookups).toHaveLength(2);
    // Mine without the reading: keeping mine takes the saved one away.
    const { documentReading: _saved, ...without } = opened.draft;
    const removed = createDraftReview({ ...opened, draft: without }, { ...saved, revision: saved.revision + 1 });
    expect(resolveDraftReview(removed, choose(removed, "mine"))?.draft).not.toHaveProperty("documentReading");
    expect(resolveDraftReview(removed, choose(removed, "current"))?.draft.documentReading).toEqual(reading);
  });
});
