import { describe, expect, it } from "vitest";
import { readFormEntry, readFormEntryCorrection } from "./entries";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base = { definitionId: id(901), versionId: id(902), versionNumber: 1, prefix: "INS", name: "Recepción", culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25 };
const question = (n: number, type: string, extra: Record<string, unknown> = {}) => ({ fieldId: id(n), type, label: "Pregunta " + n, help: null, required: true,
  maxLength: type === "shortText" ? 80 : null, options: null, selection: null, files: null, catalog: null, ...extra });
const block = (extra: Record<string, unknown> = {}) => question(2, "group", { rows: { minRows: 1, maxRows: 3 }, ...extra });
const quantity = question(3, "decimal", { repeated: true });
const entry = (...questions: unknown[]) => ({ ...base, questions });

describe("the block of rows in the entry contract", () => {
  it("reads the block with its rows and its questions marked as repeated", () => {
    const body = entry(question(1, "shortText"), block(), quantity, question(4, "choice", { required: false, repeated: true, options: [{ id: id(40), label: "Litros" }] }));
    expect(readFormEntry(body)).toEqual(body);
  });

  it("takes forty questions besides the block, and no more", () => {
    const questions = Array.from({ length: 39 }, (_, index) => question(100 + index, "shortText"));
    expect(readFormEntry(entry(block(), quantity, ...questions)).questions).toHaveLength(41);
    expect(() => readFormEntry(entry(block(), quantity, ...questions, question(200, "shortText")))).toThrow();
  });

  it.each([
    ["a block without its rows", [question(2, "group"), quantity]],
    ["rows on another question", [question(1, "shortText", { rows: { minRows: 1, maxRows: 3 } })]],
    ["a minimum above the maximum", [block({ rows: { minRows: 4, maxRows: 3 } }), quantity]],
    ["a maximum above one hundred", [block({ rows: { minRows: 1, maxRows: 101 } }), quantity]],
    ["a required block with minimum zero", [block({ rows: { minRows: 0, maxRows: 3 } }), quantity]],
    ["a repeated block", [block({ repeated: true }), quantity]],
    ["a repeated photo", [block(), question(5, "photo", { required: false, repeated: true, files: { minFiles: 0, maxFiles: 1, photoSource: "camera" } })]],
    ["two blocks", [block(), quantity, question(6, "group", { rows: { minRows: 1, maxRows: 3 } }), question(7, "decimal", { repeated: true })]],
    ["a repeated question apart from the block", [block(), quantity, question(1, "shortText"), question(8, "decimal", { repeated: true })]],
    ["a repeated question without a block", [question(1, "shortText"), quantity]],
    ["repeated set to false", [block(), question(3, "decimal", { repeated: false })]],
  ])("rejects %s", (_, questions) => {
    expect(() => readFormEntry(entry(...questions))).toThrow();
  });

  it("reads a correction with the items of the block, each answer as at the top", () => {
    const body = { entry: entry(block(), quantity), recordId: id(950), number: "INS-000005", files: [], answers: [
      { fieldId: id(2), value: null, choiceIds: null, options: null, rows: [[{ fieldId: id(3), value: "200.5", choiceIds: null, options: null }], []] },
    ] };
    expect(readFormEntryCorrection(body)).toEqual(body);
    const nested = { ...body, answers: [{ ...body.answers[0], rows: [[{ fieldId: id(3), value: null, choiceIds: null, options: null, rows: [] }]] }] };
    expect(() => readFormEntryCorrection(nested)).toThrow();
  });
});
