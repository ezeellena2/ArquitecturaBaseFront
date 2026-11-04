import { describe, expect, it } from "vitest";
import { answerChoices, questionIdentity } from "./dependentLists";
import type { DraftQuestion } from "./model";

function catalogQuestion(localId: string, fieldId: string | null, label: string, catalog: string, type: "choice" | "multiChoice" = "choice"): DraftQuestion {
  const common = { localId, fieldId, replacesFieldId: null, label: { es: label }, help: null, source: { catalog } };
  return type === "choice" ? { ...common, type, required: true } : { ...common, type, required: false, selection: { minSelected: 0, maxSelected: 3 } };
}

describe("answers a list can depend on (CW7)", () => {
  const field = catalogQuestion("field-1", "field-1", "Campo", "fields");
  const notes: DraftQuestion = { localId: "notes", fieldId: null, replacesFieldId: null, type: "shortText", label: { es: "Notas" }, help: null, required: false, maxLength: 80 };
  const own: DraftQuestion = { localId: "own", fieldId: null, replacesFieldId: null, type: "choice", label: { es: "Turno" }, help: null, required: true,
    options: [{ localId: "a", choiceId: null, label: { es: "Mañana" } }] };
  const seed = catalogQuestion("seed", null, "Semilla", "articles");
  const crops = catalogQuestion("crops", null, "Cultivos", "fields", "multiChoice");
  const lot = catalogQuestion("lot", null, "Lote", "lots");
  const product = catalogQuestion("field-9", "field-9", "Producto", "fields");

  it("lists the other catalog questions, and only an earlier single choice of the field's catalog can give the answer", () => {
    expect(answerChoices([field, notes, own, seed, crops, lot, product], "lot", "fields", "es", "es")).toEqual([
      { id: "field-1", number: 1, label: "Campo", catalog: "fields", reason: null },
      { id: "seed", number: 4, label: "Semilla", catalog: "articles", reason: "otherCatalog" },
      { id: "crops", number: 5, label: "Cultivos", catalog: "fields", reason: "multiple" },
      { id: "field-9", number: 7, label: "Producto", catalog: "fields", reason: "later" },
    ]);
  });

  it("shows a translated label in the menu language and the original while it is missing", () => {
    const translated = { ...field, label: { es: "Campo", en: "Field" } };
    expect(answerChoices([translated, seed, lot], "lot", "fields", "en", "es").map(choice => choice.label)).toEqual(["Field", "Semilla"]);
  });

  it("names a saved question by its field identity and a new one by its local identity", () => {
    expect(questionIdentity(product)).toBe("field-9");
    expect(questionIdentity({ ...lot, localId: "local-lot" })).toBe("local-lot");
  });
});
