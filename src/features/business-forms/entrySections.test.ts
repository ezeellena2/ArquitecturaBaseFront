import { describe, expect, it } from "vitest";
import type { FormEntry, FormEntryQuestion } from "./api/entries";
import { entryZones } from "./entryForm";

// CW15-B: one zone per section title, in the editor's order; what comes before the first title stays in «Datos» and the photos
// and documents go at the end, as before.
const id = (n: number) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
function question(n: number, type: FormEntryQuestion["type"], section?: string): FormEntryQuestion {
  return { fieldId: id(n), type, label: type + n, help: null, required: false, maxLength: null, options: null, selection: null,
    files: type === "photo" ? { minFiles: 0, maxFiles: 3, photoSource: "cameraOrGallery" } : null, catalog: null, ...(section ? { section } : {}) };
}
const form = (...questions: FormEntryQuestion[]): FormEntry => ({ definitionId: id(90), versionId: id(91), versionNumber: 1, prefix: "APL", name: "Aplicación",
  culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25, questions });
const zones = (entry: FormEntry) => entryZones(entry).map(zone => [zone.title ?? zone.key, zone.questions.map(item => item.label)]);

describe("the zones of the loading page with section titles", () => {
  it("opens a zone per title and leaves the files at the end", () => {
    expect(zones(form(question(1, "shortText", "Lote"), question(2, "decimal"), question(3, "photo"), question(4, "shortText", "Productos"), question(5, "decimal"))))
      .toEqual([["Lote", ["shortText1", "decimal2"]], ["Productos", ["shortText4", "decimal5"]], ["files", ["photo3"]]]);
  });
  it("keeps what comes before the first title in «Datos»", () => {
    expect(zones(form(question(1, "shortText"), question(2, "decimal", "Productos")))).toEqual([["data", ["shortText1"]], ["Productos", ["decimal2"]]]);
  });
  it("draws no zone for a section of only files, and the zones of a form without titles as before", () => {
    expect(zones(form(question(1, "shortText"), question(2, "photo", "Fotos")))).toEqual([["data", ["shortText1"]], ["files", ["photo2"]]]);
    expect(zones(form(question(1, "shortText"), question(2, "photo")))).toEqual([["data", ["shortText1"]], ["files", ["photo2"]]]);
  });
  it("names each title's zone by its first question, so folding it survives a new render", () => {
    const [first] = entryZones(form(question(7, "shortText", "Lote")));
    expect(first!.key).toBe("section:" + id(7));
  });
});
