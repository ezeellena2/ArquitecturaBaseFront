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
      { id: "field-1", number: "1", label: "Campo", catalog: "fields", reason: null },
      { id: "seed", number: "4", label: "Semilla", catalog: "articles", reason: "otherCatalog" },
      { id: "crops", number: "5", label: "Cultivos", catalog: "fields", reason: "multiple" },
      { id: "field-9", number: "7", label: "Producto", catalog: "fields", reason: "later" },
    ]);
  });

  it("shows a translated label in the menu language and the original while it is missing", () => {
    const translated = { ...field, label: { es: "Campo", en: "Field" } };
    expect(answerChoices([translated, seed, lot], "lot", "fields", "en", "es").map(choice => choice.label)).toEqual(["Field", "Semilla"]);
  });

  // LD3-A (2026-11-07): a list of the block takes the answer of its own item or the one for all the items; a list outside
  // the block cannot take one of an item. The questions keep their number in the list («2.1»).
  const block: DraftQuestion = { localId: "block", fieldId: null, replacesFieldId: null, type: "group", label: { es: "Artículos" }, help: null, required: true,
    rows: { minRows: 1, maxRows: 20 } };
  const inBlock = (question: DraftQuestion): DraftQuestion => ({ ...question, repeated: true }) as DraftQuestion;
  const category = inBlock(catalogQuestion("category", null, "Rubro", "fields"));
  const article = inBlock(catalogQuestion("article", null, "Artículo", "articles"));
  const destination = catalogQuestion("destination", null, "Destino", "fields");

  it("tells a list of the block whether the answer is the one of its own item or the one for all the items", () => {
    expect(answerChoices([field, block, category, article, destination], "article", "fields", "es", "es")).toEqual([
      { id: "field-1", number: "1", label: "Campo", catalog: "fields", reason: null, items: "all" },
      { id: "category", number: "2.1", label: "Rubro", catalog: "fields", reason: null, items: "same" },
      { id: "destination", number: "3", label: "Destino", catalog: "fields", reason: "later", items: "all" },
    ]);
  });

  it("turns off the questions of the block for a list outside it, even when they come after", () => {
    expect(answerChoices([field, block, category, article, destination], "destination", "fields", "es", "es")).toEqual([
      { id: "field-1", number: "1", label: "Campo", catalog: "fields", reason: null },
      { id: "category", number: "2.1", label: "Rubro", catalog: "fields", reason: "inBlock" },
      { id: "article", number: "2.2", label: "Artículo", catalog: "articles", reason: "inBlock" },
    ]);
    expect(answerChoices([destination, block, category], "destination", "fields", "es", "es").map(choice => choice.reason)).toEqual(["inBlock"]);
  });

  it("names a saved question by its field identity and a new one by its local identity", () => {
    expect(questionIdentity(product)).toBe("field-9");
    expect(questionIdentity({ ...lot, localId: "local-lot" })).toBe("local-lot");
  });
});
