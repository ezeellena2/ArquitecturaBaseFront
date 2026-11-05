import { describe, expect, it } from "vitest";
import type { FormEntry, FormEntryCorrection, FormEntryQuestion } from "./api/entries";
import { correctionBefore, correctionDraft, correctionSignature, entryAnswered, entryDraftKey, keptFileIds, validateEntry } from "./entryForm";

const ids = { lot: "00000000-0000-4000-8000-000000000001", crop: "00000000-0000-4000-8000-000000000002", density: "00000000-0000-4000-8000-000000000003",
  date: "00000000-0000-4000-8000-000000000004", photos: "00000000-0000-4000-8000-000000000006", seven: "00000000-0000-4000-8000-0000000000aa",
  soy: "00000000-0000-4000-8000-0000000000bb", gone: "00000000-0000-4000-8000-0000000000cc", file: "00000000-0000-4000-8000-0000000000dd" };
function question(fieldId: string, type: FormEntryQuestion["type"], extra: Partial<FormEntryQuestion> = {}): FormEntryQuestion {
  return { fieldId, type, label: type, help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null, ...extra };
}
const entry: FormEntry = {
  definitionId: "00000000-0000-4000-8000-0000000000f1", versionId: "00000000-0000-4000-8000-0000000000f2", versionNumber: 4, prefix: "APL", name: "Aplicación",
  culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25,
  questions: [
    question(ids.lot, "choice", { catalog: { onlyOption: null, issue: null, missingData: null } }),
    question(ids.crop, "choice", { options: [{ id: ids.soy, label: "Soja 1ª" }] }),
    question(ids.density, "decimal"),
    question(ids.date, "date", { required: false }),
    question(ids.photos, "photo", { files: { minFiles: 1, maxFiles: 2, photoSource: "cameraOrGallery" } }),
  ],
};
const correction: FormEntryCorrection = {
  entry, recordId: "00000000-0000-4000-8000-0000000000e1", number: "APL-000124",
  answers: [
    { fieldId: ids.lot, value: ids.seven, choiceIds: null, options: [{ id: ids.seven, title: "Lote 7 · 48 ha", description: null }] },
    { fieldId: ids.crop, value: ids.soy, choiceIds: null, options: null },
    { fieldId: ids.density, value: "1.2", choiceIds: null, options: null },
  ],
  files: [{ fileId: ids.file, fieldId: ids.photos, name: "lote.jpg", contentType: "image/jpeg", size: 2048, hasThumbnail: true }],
};
const words = { yes: "Sí", no: "No", date: (iso: string) => iso.split("-").reverse().join("/") };

describe("correcting a response (CW10-A)", () => {
  it("starts from the response as it was, with the decimal as the menu writes it and its files kept", () => {
    const draft = correctionDraft(correction, "es");

    expect(draft.values).toEqual({ [ids.density]: "1,2" });
    expect(draft.choices[ids.lot]).toEqual([{ id: ids.seven, title: "Lote 7 · 48 ha", description: null }]);
    expect(draft.choices[ids.crop]).toEqual([{ id: ids.soy, title: "Soja 1ª", description: null }]);
    expect(keptFileIds(draft)).toEqual([ids.file]);
    expect(correctionDraft(correction, "en").values[ids.density]).toBe("1.2");
    expect(validateEntry(entry, draft)).toEqual({});
    expect(entryAnswered(entry.questions[4], draft)).toBe(true);
  });

  it("drops an own option the active version no longer has", () => {
    const draft = correctionDraft({ ...correction, answers: [{ fieldId: ids.crop, value: ids.gone, choiceIds: null, options: null }] }, "es");
    expect(draft.choices[ids.crop]).toEqual([]);
  });

  it("says what each changed question had before, and nothing for the unchanged ones", () => {
    const initial = correctionDraft(correction, "es");
    const changed = { ...initial, values: { ...initial.values, [ids.density]: "1,5", [ids.date]: "2026-11-05" } };

    expect(correctionBefore(entry, initial, initial, words)).toEqual({});
    expect(correctionBefore(entry, initial, changed, words)).toEqual({ [ids.density]: "1,2", [ids.date]: "" });
  });

  it("counts the kept files for the limits of their question and a removed one leaves it without answer", () => {
    const initial = correctionDraft(correction, "es");
    const removed = { ...initial, kept: { [ids.photos]: [] } };

    expect(validateEntry(entry, removed)).toEqual({ [ids.photos]: "filesAtLeast" });
    expect(keptFileIds(removed)).toEqual([]);
    expect(correctionBefore(entry, initial, removed, words)).toEqual({ [ids.photos]: "lote.jpg" });
  });

  it("is a new send when the reason or the kept files change, and the same while nothing changes", () => {
    const initial = correctionDraft(correction, "es");
    const signature = correctionSignature(entry, initial, "La dosis era 1,5.");

    expect(correctionSignature(entry, initial, " La dosis era 1,5. ")).toBe(signature);
    expect(correctionSignature(entry, initial, "Otro motivo")).not.toBe(signature);
    expect(correctionSignature(entry, { ...initial, kept: {} }, "La dosis era 1,5.")).not.toBe(signature);
    expect(entryDraftKey(initial)).toBe(entryDraftKey(correctionDraft(correction, "es")));
    expect(entryDraftKey({ ...initial, values: { ...initial.values, [ids.density]: "1,5" } })).not.toBe(entryDraftKey(initial));
  });
});
