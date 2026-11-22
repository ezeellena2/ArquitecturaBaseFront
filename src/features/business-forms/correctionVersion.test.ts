import { expect, it } from "vitest";
import type { FormEntry, FormEntryCorrection, FormEntryQuestion } from "./api/entries";
import { answeredQuestions, correctionVersionNotice } from "./correctionVersion";

const id = (n: number) => "0199a0c0-0000-7000-8000-" + String(n).padStart(12, "0");
const question = (n: number, type: FormEntryQuestion["type"], label: string, extra: Partial<FormEntryQuestion> = {}): FormEntryQuestion => ({
  fieldId: id(n), type, label, help: null, required: false, maxLength: null, options: null, selection: null, files: null, catalog: null, ...extra,
});
const entry = (version: number, questions: FormEntryQuestion[]): FormEntry => ({ definitionId: id(100), versionId: id(100 + version), versionNumber: version,
  prefix: "APL", name: "Aplicación", culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 10, questions });
const lot = question(1, "shortText", "Lote");
const dose = question(2, "decimal", "Dosis");
const notes = question(3, "longText", "Observaciones");
const recipe = question(4, "document", "Receta agronómica", { files: { minFiles: 0, maxFiles: 1, photoSource: null } });
const answered = new Set([id(1), id(2)]);
const correction = (questions: FormEntryQuestion[], answers: string[]): FormEntryCorrection => ({ entry: entry(2, questions), recordId: id(200), number: "APL-000006",
  answers: answers.map(fieldId => ({ fieldId, value: "x", choiceIds: null, options: null })), files: [] });

it("says nothing when the response is corrected with the version it was answered with", () => {
  expect(correctionVersionNotice(entry(2, [lot, dose]), correction([lot, dose], [id(1), id(2)]), answered)).toBeNull();
});

it("names the active version and what starts empty: what it added and what was answered but does not come along", () => {
  const recordEntry = entry(1, [lot, dose, notes]);
  const changedDose = { ...dose, type: "shortText" as const };

  expect(correctionVersionNotice(recordEntry, correction([lot, changedDose, notes, recipe], [id(1)]), answered))
    .toEqual({ versionNumber: 2, empty: ["Dosis", "Receta agronómica"] });
  // «Observaciones» was left empty in the response: it starts empty as it was, and is not named.
});

it("names only the version when everything comes along", () => {
  expect(correctionVersionNotice(entry(1, [lot, dose]), correction([lot, dose], [id(1), id(2)]), answered)).toEqual({ versionNumber: 2, empty: [] });
});

it("counts as answered every value of the detail that is not empty, a «No» included", () => {
  const values = [{ fieldId: id(1), value: "Lote 4" }, { fieldId: id(2), value: null }, { fieldId: id(3), value: "" }, { fieldId: id(4), value: [] },
    { fieldId: id(5), value: false }, { fieldId: id(6), value: [{ choiceId: id(7), label: "Litros" }] }];

  expect([...answeredQuestions(values)]).toEqual([id(1), id(5), id(6)]);
});
