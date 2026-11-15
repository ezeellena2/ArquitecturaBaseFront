import { describe, expect, it } from "vitest";
import { readFormEntry, type FormEntry } from "./api/entries";
import { responseCellSchema } from "./api/responses";
import { replaceQuestionType, newQuestion } from "./editorModel";
import { entryAnswerText, initialEntryDraft, toEntrySend, validateEntry } from "./entryForm";
import type { DraftQuestion } from "./model";
import { responseValueText } from "./responses";
import { mappableSource } from "./suggestions";

const id = (value: number) => "0199b0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const point = '{"latitude":-34.603722,"longitude":-58.381592,"accuracyMeters":15}';
// Synthetic behavior DTO; the bodies the backend exports qualify the contract in entriesLocationHttpContract.
const location = (required: boolean, extra: Record<string, unknown> = {}) => ({ fieldId: id(11), type: "location", label: "Dónde estás", help: null, required,
  maxLength: null, options: null, selection: null, files: null, catalog: null, ...extra });
const entry = (required = true): FormEntry => readFormEntry({ definitionId: id(1), versionId: id(2), versionNumber: 1, prefix: "REG", name: "Registro de visita",
  culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25, questions: [location(required)] });

describe("the location question (UB1-A)", () => {
  it("is read in the entry only required or optional, without a length or a condition of its own", () => {
    expect(entry().questions[0]!.type).toBe("location");
    const body = { ...entry(), questions: [location(true, { maxLength: 80 })] };
    expect(() => readFormEntry(body)).toThrow();
    expect(() => readFormEntry({ ...entry(), questions: [location(true, { showWhen: { questionId: id(12), values: ["true"] } })] })).toThrow();
  });

  it("is required until the point is there, and travels as the text of the point", () => {
    const form = entry();
    const empty = initialEntryDraft(form);
    expect(validateEntry(form, empty, "es")[id(11)]).toBe("required");
    expect(validateEntry(entry(false), initialEntryDraft(entry(false)), "es")[id(11)]).toBeUndefined();

    const loaded = { ...empty, values: { [id(11)]: point } };
    expect(validateEntry(form, loaded, "es")).toEqual({});
    expect(toEntrySend(form, loaded, id(3), "es").answers).toEqual([{ fieldId: id(11), value: point }]);
    expect(toEntrySend(entry(false), initialEntryDraft(entry(false)), id(3), "es").answers).toEqual([]);
  });

  it("reads as its coordinates in «Antes: …» of a correction", () => {
    const words = { yes: "Sí", no: "No", date: (iso: string) => iso };
    expect(entryAnswerText(entry().questions[0]!, { ...initialEntryDraft(entry()), values: { [id(11)]: point } }, words)).toBe("-34.603722, -58.381592");
    expect(entryAnswerText(entry().questions[0]!, initialEntryDraft(entry()), words)).toBe("");
  });

  it("is one datum in the sheet and the detail, with a valid point", () => {
    const cell = { fieldId: id(11), type: "location", state: "Answered", value: { latitude: -34.603722, longitude: -58.381592, accuracyMeters: 15 } } as const;
    expect(responseCellSchema.parse(cell)).toEqual(cell);
    expect(responseValueText(cell, "Sin respuesta", "Sí", "No")).toBe("-34.603722, -58.381592");
    expect(() => responseCellSchema.parse({ ...cell, value: { latitude: 91, longitude: 0 } })).toThrow();
    expect(() => responseCellSchema.parse({ ...cell, value: "-34.603722, -58.381592" })).toThrow();
    expect(responseCellSchema.parse({ ...cell, state: "NotAsked", value: null }).value).toBeNull();
  });

  it("is never mapped to the next form by a suggestion", () => {
    expect(mappableSource({ fieldId: id(11), type: "location", label: { es: "Dónde estás" }, required: true } as Parameters<typeof mappableSource>[0])).toBe(false);
  });

  it("drops a condition and never stays in the block when a question changes to it", () => {
    const shown: DraftQuestion = { ...newQuestion("shortText", "es", "a"), fieldId: id(20), repeated: true, showWhen: { questionId: id(21), values: ["true"] } } as DraftQuestion;
    const next = replaceQuestionType(shown, "location", "b", "es");

    expect(next.type).toBe("location");
    expect(next.replacesFieldId).toBe(id(20));
    expect("showWhen" in next && next.showWhen).toBeFalsy();
    expect("repeated" in next && next.repeated).toBeFalsy();
    expect(newQuestion("location", "es", "c")).toEqual({ localId: "c", fieldId: null, replacesFieldId: null, label: { es: "" }, help: null, required: false, type: "location" });
  });
});
