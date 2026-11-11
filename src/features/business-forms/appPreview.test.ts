import { describe, expect, it } from "vitest";
import { appPreviewEntry, type AppPreviewWords } from "./appPreview";
import type { DraftEditorValue, DraftQuestion } from "./model";

const words: AppPreviewWords = { question: "Pregunta", option: number => `Opción ${number}`, section: "Título", form: "Nuevo formulario",
  submit: "Texto del botón final", catalog: "Las opciones del catálogo se ven al cargar." };
const base = { localId: "", fieldId: null, replacesFieldId: null, help: null, required: false } as const;
const value = (fields: DraftQuestion[], extra: Partial<DraftEditorValue["draft"]> = {}): DraftEditorValue => ({ offerWhen: null, name: { es: "Remito de prueba" },
  prefix: "REM", draft: { format: 1, culture: "es", submitLabel: { es: "Enviar remito" }, fields, ...extra } });

describe("the app preview of a draft (SA2-A)", () => {
  it("names the form, its button and its questions in the preview language, with the editor's names while they have no text", () => {
    const entry = appPreviewEntry({ offerWhen: null, name: { es: " " }, prefix: "REM", draft: { format: 1, culture: "es", submitLabel: { es: "" }, fields: [
      { ...base, localId: "q", type: "decimal", label: { es: "Cantidad", en: "Quantity" }, help: { es: "En kilos" } },
      { ...base, localId: "r", type: "date", label: { es: "Fecha", en: "" }, required: true },
    ] } }, "en", words);
    expect(entry).toMatchObject({ name: "Nuevo formulario", submitLabel: "Texto del botón final", culture: "en", prefix: "REM" });
    expect(entry.questions).toEqual([
      { fieldId: "q", type: "decimal", label: "Quantity", help: null, required: false, maxLength: null, options: null, selection: null, files: null, catalog: null },
      { fieldId: "r", type: "date", label: "Pregunta", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null },
    ]);
  });

  it("keeps the identity of a saved question and gives a new one its local identity", () => {
    const entry = appPreviewEntry(value([{ ...base, localId: "local", fieldId: "field", type: "date", label: { es: "Fecha" } },
      { ...base, localId: "new", type: "date", label: { es: "Otra" } }]), "es", words);
    expect(entry.questions.map(question => question.fieldId)).toEqual(["field", "new"]);
  });

  it("lists own options, naming the ones without a text by their place, and leaves a catalog waiting for its options", () => {
    const entry = appPreviewEntry(value([
      { ...base, localId: "state", type: "choice", label: { es: "Estado" }, options: [{ localId: "good", choiceId: "c1", label: { es: "Bueno" } }, { localId: "o2", choiceId: null, label: { es: "" } }] },
      { ...base, localId: "client", type: "choice", label: { es: "Cliente" }, source: { catalog: "catalog" } },
      { ...base, localId: "tags", type: "multiChoice", label: { es: "Etiquetas" }, required: true, selection: { minSelected: 1, maxSelected: null }, options: [{ localId: "a", choiceId: null, label: { es: "A" } }] },
    ]), "es", words);
    expect(entry.questions[0]).toMatchObject({ options: [{ id: "c1", label: "Bueno" }, { id: "o2", label: "Opción 2" }], catalog: null });
    expect(entry.questions[1]).toMatchObject({ options: null, catalog: { onlyOption: null, issue: words.catalog, missingData: null } });
    expect(entry.questions[2]).toMatchObject({ options: [{ id: "a", label: "A" }], selection: { minSelected: 1, maxSelected: 20 } });
  });

  it("carries files, text lengths and the block with its questions", () => {
    const entry = appPreviewEntry(value([
      { ...base, localId: "notes", type: "longText", label: { es: "Notas" }, maxLength: null },
      { ...base, localId: "photos", type: "photo", label: { es: "Fotos" }, files: { minFiles: null, maxFiles: 3 } },
      { ...base, localId: "pdf", type: "document", label: { es: "Remito" }, files: { minFiles: 1, maxFiles: 1, photoSource: null } },
      { ...base, localId: "items", type: "group", label: { es: "Artículos" }, required: true, rows: { minRows: 1, maxRows: null } },
      { ...base, localId: "article", type: "shortText", label: { es: "Artículo" }, maxLength: 120, repeated: true },
    ]), "es", words);
    expect(entry.questions.map(({ fieldId, maxLength, files, rows, repeated }) => ({ fieldId, maxLength, files, rows, repeated }))).toEqual([
      { fieldId: "notes", maxLength: null, files: null, rows: undefined, repeated: undefined },
      { fieldId: "photos", maxLength: null, files: { minFiles: 0, maxFiles: 3, photoSource: "cameraOrGallery" }, rows: undefined, repeated: undefined },
      { fieldId: "pdf", maxLength: null, files: { minFiles: 1, maxFiles: 1, photoSource: null }, rows: undefined, repeated: undefined },
      { fieldId: "items", maxLength: null, files: null, rows: { minRows: 1, maxRows: 1 }, repeated: undefined },
      { fieldId: "article", maxLength: 120, files: null, rows: undefined, repeated: true },
    ]);
    expect(Object.keys(entry.questions[0]!)).not.toContain("repeated");
  });

  it("opens a zone with a section title at its first question, with the editor's name while it has no text", () => {
    const entry = appPreviewEntry(value([{ ...base, localId: "a", type: "date", label: { es: "Fecha" } }, { ...base, localId: "b", type: "date", label: { es: "Hora" } }],
      { sections: [{ localId: "s1", start: 0, title: { es: "Entrega" } }, { localId: "s2", start: 1, title: { es: "" } }] }), "es", words);
    expect(entry.questions.map(question => question.section)).toEqual(["Entrega", "Título"]);
  });
});
