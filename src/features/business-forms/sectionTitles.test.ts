import { describe, expect, it } from "vitest";
import type { DraftQuestion, DraftSection } from "./model";
import { addSectionTitle, listEntries, markRepeatedWithTitles, moveListEntry, removeQuestionWithTitles, addRowQuestionWithTitles, titlesByFirstQuestion } from "./sectionTitles";

const question = (localId: string, type: "shortText" | "photo" = "shortText"): DraftQuestion =>
  type === "photo" ? { localId, fieldId: null, replacesFieldId: null, type, label: { es: localId }, help: null, required: false, files: { minFiles: 0, maxFiles: 1, photoSource: "cameraOrGallery" } }
    : { localId, fieldId: null, replacesFieldId: null, type, label: { es: localId }, help: null, required: false, maxLength: 80 };
const block = (): DraftQuestion => ({ localId: "block", fieldId: null, replacesFieldId: null, type: "group", label: { es: "Artículos" }, help: null, required: true, rows: { minRows: 1, maxRows: 20 } });
const row = (localId: string): DraftQuestion => ({ ...question(localId), repeated: true } as DraftQuestion);
const title = (localId: string, start: number): DraftSection => ({ localId, start, title: { es: localId } });
const ids = (prefix: string) => { let next = 0; return () => `${prefix}-${++next}`; };
// The list as the editor shows it: «#» before a title.
const shown = (fields: readonly DraftQuestion[], sections: readonly DraftSection[]) =>
  listEntries(fields, sections).flatMap(entry => entry.kind === "title" ? ["#" + entry.section.localId] : entry.questions.map(item => item.localId));

describe("section titles in the editor (CW15-B)", () => {
  const lot = question("lot"), area = question("area"), product = question("product"), dose = question("dose");

  it("shows each title right before the question it starts at, the ones at the end last", () => {
    expect(shown([lot, area, product], [title("Lote", 0), title("Productos", 2), title("Final", 3)]))
      .toEqual(["#Lote", "lot", "area", "#Productos", "product", "#Final"]);
  });
  it("adds a title at the end, so the next question goes below it", () => {
    const sections = addSectionTitle([lot], [], "es", "new-title");

    expect(sections).toEqual([{ localId: "new-title", start: 1, title: { es: "" } }]);
    expect(shown([lot, area], sections)).toEqual(["lot", "#new-title", "area"]);
  });
  it("moves a question across a title into the other section, without moving the title", () => {
    const sections = [title("Productos", 2)];

    const down = moveListEntry([lot, area, product], sections, "area", 1);
    expect(shown(down.fields, down.sections)).toEqual(["lot", "#Productos", "area", "product"]);
    const up = moveListEntry(down.fields, down.sections, "area", -1);
    expect(shown(up.fields, up.sections)).toEqual(["lot", "area", "#Productos", "product"]);
  });
  it("moves a title among the questions and over the whole block", () => {
    const fields = [lot, block(), row("quantity"), product];
    const sections = [title("Productos", 3)];

    const up = moveListEntry(fields, sections, "Productos", -1);
    expect(shown(up.fields, up.sections)).toEqual(["lot", "#Productos", "block", "quantity", "product"]);
    expect(moveListEntry(up.fields, up.sections, "Productos", -1).sections).toEqual([title("Productos", 0)]);
    expect(moveListEntry(fields, sections, "lot", -1)).toEqual({ fields, sections });
  });
  it("keeps the titles in place when a question or the block is removed", () => {
    const sections = [title("Datos", 0), title("Productos", 2), title("Final", 4)];

    const removed = removeQuestionWithTitles([lot, area, product, dose], sections, "area");
    expect(shown(removed.fields, removed.sections)).toEqual(["#Datos", "lot", "#Productos", "product", "dose", "#Final"]);
    const withBlock = removeQuestionWithTitles([lot, block(), row("a"), row("b"), product], [title("Productos", 4)], "block");
    expect(shown(withBlock.fields, withBlock.sections)).toEqual(["lot", "#Productos", "product"]);
  });
  it("keeps a title right after the block after it when the block grows or a question enters or leaves it", () => {
    const fields = [lot, block(), row("quantity"), product];
    const sections = [title("Cierre", 3)];
    const marker = { question: ids("q"), choice: ids("c"), block: ids("b") };

    const added = addRowQuestionWithTitles(fields, sections, "es", "price");
    expect(shown(added.fields, added.sections)).toEqual(["lot", "block", "quantity", "price", "#Cierre", "product"]);
    const entering = markRepeatedWithTitles(fields, sections, "product", true, "es", "Renglones", marker);
    expect(shown(entering.fields, entering.sections)).toEqual(["lot", "block", "quantity", "product", "#Cierre"]);
    const leaving = markRepeatedWithTitles([lot, block(), row("quantity"), row("price"), product], [title("Cierre", 4)], "price", false, "es", "Renglones", marker);
    expect(shown(leaving.fields, leaving.sections)).toEqual(["lot", "block", "quantity", "price", "#Cierre", "product"]);
  });
  it("keeps a title before the question that becomes the block, before the new block", () => {
    const created = markRepeatedWithTitles([lot, area, product], [title("Artículos", 1), title("Final", 2)], "area", true, "es", "Renglones",
      { question: ids("q"), choice: ids("c"), block: ids("b") });

    expect(shown(created.fields, created.sections)).toEqual(["lot", "#Artículos", "b-1", "area", "#Final", "product"]);
  });
  it("finds the title before the first question of each section, and none for an empty one", () => {
    const titles = titlesByFirstQuestion([lot, area, product], [title("Datos", 0), title("Vacío", 2), title("Productos", 2), title("Final", 3)]);

    expect([...titles.entries()].map(([localId, section]) => [localId, section.localId])).toEqual([["lot", "Datos"], ["product", "Productos"]]);
  });
});
