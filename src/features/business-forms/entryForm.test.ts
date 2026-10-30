import { describe, expect, it } from "vitest";
import type { FormEntry, FormEntryQuestion } from "./api/entries";
import { carryEntryDraft, entryAnswered, entryChoiceInRow, entryColumns, entryFileProblem, entryQuestionSpan, entryRows, entrySignature, entryTextRows, entryZones, initialEntryDraft, keepForNextEntry, toEntrySend, validateEntry } from "./entryForm";

const ids = { lot: "00000000-0000-4000-8000-000000000001", crop: "00000000-0000-4000-8000-000000000002", density: "00000000-0000-4000-8000-000000000003",
  date: "00000000-0000-4000-8000-000000000004", notes: "00000000-0000-4000-8000-000000000005", photos: "00000000-0000-4000-8000-000000000006",
  extra: "00000000-0000-4000-8000-000000000007", only: "00000000-0000-4000-8000-0000000000aa", soy: "00000000-0000-4000-8000-0000000000bb" };
function question(fieldId: string, type: FormEntryQuestion["type"], extra: Partial<FormEntryQuestion> = {}): FormEntryQuestion {
  return { fieldId, type, label: type, help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null, ...extra };
}
const entry: FormEntry = {
  definitionId: "00000000-0000-4000-8000-0000000000f1", versionId: "00000000-0000-4000-8000-0000000000f2", versionNumber: 2, prefix: "SIE", name: "Siembra",
  culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25,
  questions: [
    question(ids.lot, "choice", { catalog: { onlyOption: { id: ids.only, title: "Lote 7 · 48 ha", description: "Soja 1ª" }, issue: null, missingData: null } }),
    question(ids.crop, "choice", { options: [{ id: ids.soy, label: "Soja 1ª" }] }),
    question(ids.density, "decimal"),
    question(ids.date, "date"),
    question(ids.notes, "longText", { required: false, maxLength: 10 }),
    question(ids.photos, "photo", { required: false, files: { minFiles: 0, maxFiles: 2, photoSource: "cameraOrGallery" } }),
  ],
};
const photo = (name = "lote.jpg", size = 1024, type = "image/jpeg") => new File([new Uint8Array(size)], name, { type, lastModified: 1 });

describe("entry form", () => {
  it("starts empty except the only catalog option the filters leave", () => {
    const draft = initialEntryDraft(entry);
    expect(draft.choices[ids.lot]).toEqual([{ id: ids.only, title: "Lote 7 · 48 ha", description: "Soja 1ª" }]);
    expect(draft.values).toEqual({});
    expect(draft.files).toEqual({});
  });

  it("marks what is missing or does not fit on its own question", () => {
    const draft = { ...initialEntryDraft(entry), values: { [ids.density]: "72,5x", [ids.notes]: "demasiado largo" } };
    expect(validateEntry(entry, draft)).toEqual({ [ids.crop]: "choose", [ids.density]: "number", [ids.date]: "required", [ids.notes]: "maxLength" });
    expect(validateEntry(entry, { ...draft, values: { [ids.density]: "72,5", [ids.date]: "2026-10-28" }, choices: { ...draft.choices, [ids.crop]: [{ id: ids.soy, title: "Soja 1ª", description: null }] } })).toEqual({});
  });

  it("sends canonical values, the chosen ids and each file with its question", () => {
    const draft = {
      values: { [ids.density]: "72,5", [ids.date]: "2026-10-28", [ids.notes]: "" },
      choices: { [ids.lot]: [{ id: ids.only, title: "Lote 7", description: null }], [ids.crop]: [{ id: ids.soy, title: "Soja 1ª", description: null }] },
      files: { [ids.photos]: [photo("a.jpg"), photo("b.jpg")] },
    };
    const send = toEntrySend(entry, draft, "00000000-0000-4000-8000-0000000000c1");
    expect(send.versionId).toBe(entry.versionId);
    expect(send.answers).toEqual([
      { fieldId: ids.lot, value: ids.only }, { fieldId: ids.crop, value: ids.soy },
      { fieldId: ids.density, value: "72.5" }, { fieldId: ids.date, value: "2026-10-28" },
    ]);
    expect(send.files.map(file => [file.fieldId, file.file.name])).toEqual([[ids.photos, "a.jpg"], [ids.photos, "b.jpg"]]);
  });

  it("sends a multiple choice as its chosen ids, an empty list when none was chosen", () => {
    const multiple: FormEntry = { ...entry, questions: [question(ids.extra, "multiChoice", { required: false, selection: { minSelected: 0, maxSelected: 3 }, options: [{ id: ids.soy, label: "Soja" }] })] };
    expect(toEntrySend(multiple, { values: {}, choices: {}, files: {} }, "00000000-0000-4000-8000-0000000000c1").answers).toEqual([{ fieldId: ids.extra, choiceIds: [] }]);
    expect(validateEntry({ ...multiple, questions: [{ ...multiple.questions[0], required: true, selection: { minSelected: 2, maxSelected: 3 } }] },
      { values: {}, choices: { [ids.extra]: [{ id: ids.soy, title: "Soja", description: null }] }, files: {} })).toEqual({ [ids.extra]: "chooseAtLeast" });
  });

  it("keeps the answers of the questions that stay in a new version and drops the rest", () => {
    const draft = { values: { [ids.density]: "72,5", [ids.notes]: "nota" }, choices: { [ids.crop]: [{ id: ids.soy, title: "Soja 1ª", description: null }] }, files: { [ids.photos]: [photo()] } };
    const next: FormEntry = { ...entry, versionId: "00000000-0000-4000-8000-0000000000f3", questions: [
      question(ids.density, "decimal"), question(ids.notes, "shortText"), question(ids.crop, "choice", { options: [{ id: ids.soy, label: "Soja" }] }), question(ids.photos, "photo", { files: { minFiles: 1, maxFiles: 1, photoSource: "camera" } }),
    ] };
    expect(carryEntryDraft(entry, draft, next)).toEqual({ values: { [ids.density]: "72,5" }, choices: { [ids.crop]: draft.choices[ids.crop] }, files: { [ids.photos]: draft.files[ids.photos] } });
  });

  it("keeps everything but the files for the next response", () => {
    const draft = { values: { [ids.density]: "9" }, choices: { [ids.crop]: [{ id: ids.soy, title: "Soja 1ª", description: null }] }, files: { [ids.photos]: [photo()] } };
    expect(keepForNextEntry(draft)).toEqual({ values: draft.values, choices: draft.choices, files: {} });
  });

  it("checks type, size and count before sending", () => {
    const photos = entry.questions[5];
    expect(entryFileProblem(photos, [], photo("video.mp4", 10, "video/mp4"), 25)).toBe("photoType");
    expect(entryFileProblem(photos, [], photo("grande.jpg", 26 * 1024 * 1024), 25)).toBe("size");
    expect(entryFileProblem(photos, [photo(), photo()], photo(), 25)).toBe("count");
    expect(entryFileProblem(photos, [], photo("captura.png", 10, "image/png"), 25)).toBeNull();
    const document = question(ids.extra, "document", { files: { minFiles: 1, maxFiles: 1, photoSource: null } });
    expect(entryFileProblem(document, [], photo("remito.pdf", 10, "application/pdf"), 25)).toBeNull();
    expect(entryFileProblem(document, [], photo("remito.txt", 10, "text/plain"), 25)).toBe("documentType");
  });

  it("identifies a send by what it carries, so repeating it after a failure keeps its request", () => {
    const draft = { values: { [ids.density]: "9" }, choices: {}, files: { [ids.photos]: [photo()] } };
    expect(entrySignature(entry, draft)).toBe(entrySignature(entry, { ...draft, values: { ...draft.values } }));
    expect(entrySignature(entry, draft)).not.toBe(entrySignature(entry, { ...draft, values: { [ids.density]: "10" } }));
  });

  it("gives each type its width in the three columns, never chosen by the author (CW16)", () => {
    const options = (count: number, label = "Soja") => Array.from({ length: count }, (_, index) => ({ id: "00000000-0000-4000-8000-0000000001" + String(index).padStart(2, "0"), label: label + " " + index }));
    expect([question(ids.density, "decimal"), question(ids.date, "date"), question(ids.extra, "boolean")].map(entryQuestionSpan)).toEqual([1, 1, 1]);
    expect([30, 31, 80, 81, null].map(maxLength => entryQuestionSpan(question(ids.extra, "shortText", { maxLength })))).toEqual([1, 2, 2, 3, 3]);
    expect(entryQuestionSpan(question(ids.notes, "longText", { maxLength: 20 }))).toBe(3);
    expect(entryQuestionSpan(entry.questions[0])).toBe(2);
    expect(entryQuestionSpan(question(ids.crop, "choice", { options: options(5) }))).toBe(2);
    expect(entryQuestionSpan(question(ids.crop, "choice", { options: options(6) }))).toBe(1);
    expect(entryQuestionSpan(question(ids.crop, "choice", { options: options(2, "Una opción demasiado larga") }))).toBe(1);
    expect(entryChoiceInRow(question(ids.crop, "choice", { options: options(2, "Una opción demasiado larga") }))).toBe(false);
    expect(entryQuestionSpan(question(ids.crop, "multiChoice", { options: options(3), selection: { minSelected: 0, maxSelected: 3 } }))).toBe(3);
    expect(entryQuestionSpan(question(ids.lot, "multiChoice", { catalog: { onlyOption: null, issue: null, missingData: null }, selection: { minSelected: 0, maxSelected: 3 } }))).toBe(2);
    expect(entryQuestionSpan(entry.questions[5])).toBe(3);
  });

  it("puts the questions in rows of three in their order, and one that does not fit starts the next row", () => {
    const [lot, crop, density, date, notes] = entry.questions;
    expect(entryRows([lot, density, date, crop, notes]).map(row => row.map(item => item.fieldId))).toEqual([[ids.lot, ids.density], [ids.date, ids.crop], [ids.notes]]);
    expect(entryRows([density, date, density, lot]).map(row => row.length)).toEqual([3, 1]);
  });

  it("counts what was answered and grows a long text box with its maximum length", () => {
    const draft = { ...initialEntryDraft(entry), values: { [ids.density]: "72,5", [ids.date]: "" }, files: { [ids.photos]: [photo()] } };
    expect(entry.questions.map(item => entryAnswered(item, draft))).toEqual([true, false, true, false, false, true]);
    expect([null, 100, 250, 500, 5000].map(maxLength => entryTextRows(question(ids.notes, "longText", { maxLength })))).toEqual([6, 2, 3, 5, 6]);
  });

  it("groups the questions in zones: the data in the editor's order and the files at the end", () => {
    const [lot, crop, density, date, notes, photos] = entry.questions;
    const mixed = { ...entry, questions: [lot, photos, crop, density, date, notes] };
    expect(entryZones(mixed).map(zone => [zone.key, zone.questions.map(item => item.fieldId)])).toEqual([
      ["data", [ids.lot, ids.crop, ids.density, ids.date, ids.notes]], ["files", [ids.photos]]]);
    expect(entryZones({ ...entry, questions: [photos] }).map(zone => zone.key)).toEqual(["files"]);
    expect(entryZones({ ...entry, questions: [] })).toEqual([]);
  });

  it("builds the rows with the columns in use, so every visible row has its line (CW16)", () => {
    const [lot, crop, density, date, notes] = entry.questions;
    const order = [lot, density, date, crop, notes];
    const rows = (columns: 1 | 2 | 3) => entryRows(order, columns).map(row => row.map(item => item.fieldId));
    expect(rows(3)).toEqual([[ids.lot, ids.density], [ids.date, ids.crop], [ids.notes]]);
    expect(rows(2)).toEqual([[ids.lot], [ids.density, ids.date], [ids.crop], [ids.notes]]);
    expect(rows(1)).toEqual([[ids.lot], [ids.density], [ids.date], [ids.crop], [ids.notes]]);
  });

  it("fits three columns on the computer, two on a tablet and one on the phone by the zone's width in rem", () => {
    expect([19, 29.9, 30, 45.9, 46, 90].map(entryColumns)).toEqual([1, 1, 2, 2, 3, 3]);
  });
});
