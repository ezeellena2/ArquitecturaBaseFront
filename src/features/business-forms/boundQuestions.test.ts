import { describe, expect, it } from "vitest";
import { boundQuestionIds, isBoundQuestion, removesBoundQuestion, standardName } from "./boundQuestions";
import type { DraftQuestion } from "./model";

const question = (localId: string, fieldId: string | null, extra: Partial<DraftQuestion> = {}): DraftQuestion =>
  ({ localId, fieldId, replacesFieldId: null, type: "decimal", label: { es: localId }, help: null, required: false, ...extra } as DraftQuestion);
const standard = { key: "arca.invoice", version: 1, bound: { total: "FIELD-TOTAL", amount: "field-amount" } };

describe("the questions a library standard needs (BI1-A)", () => {
  it("knows the bound questions by their field identity, without a standard none", () => {
    const bound = boundQuestionIds(standard);
    expect(isBoundQuestion(question("total", "field-total"), bound)).toBe(true);
    expect(isBoundQuestion(question("notes", "field-notes"), bound)).toBe(false);
    // A new question, or one whose type changed (a new identity), is never bound.
    expect(isBoundQuestion(question("new", null), bound)).toBe(false);
    expect(boundQuestionIds(undefined).size).toBe(0);
  });

  it("does not remove the block when it, or a question in it, is bound", () => {
    const block = question("block", "field-block", { type: "group", rows: { minRows: 1, maxRows: 5 }, required: true } as Partial<DraftQuestion>);
    const amount = question("amount", "field-amount", { repeated: true } as Partial<DraftQuestion>);
    const notes = question("notes", "field-notes");
    const bound = boundQuestionIds(standard);
    expect(removesBoundQuestion([block, amount, notes], "block", bound)).toBe(true);
    expect(removesBoundQuestion([block, question("other", "field-other", { repeated: true } as Partial<DraftQuestion>), notes], "block", bound)).toBe(false);
    expect(removesBoundQuestion([block, amount, notes], "notes", bound)).toBe(false);
    expect(removesBoundQuestion([block, amount, notes], "amount", bound)).toBe(true);
  });

  it("names the standard as the library lists it, and by its key when the library does not list it", () => {
    expect(standardName(standard, [{ key: "arca.invoice", name: "Factura" }])).toBe("Factura");
    expect(standardName(standard, [{ key: "other", name: "Otro" }])).toBe("arca.invoice");
    expect(standardName(standard, undefined)).toBe("arca.invoice");
  });
});
