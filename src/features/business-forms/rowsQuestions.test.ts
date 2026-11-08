import { describe, expect, it } from "vitest";
import type { DraftQuestion } from "./model";
import { addBlock, addRowQuestion, canRepeat, markRepeated, moveInRows, moveTopLevel, previewScreens, questionCount, questionNumbers, removeBlock, rowsBlock, rowsItems } from "./rowsQuestions";

const question = (localId: string, type: "shortText" | "decimal" | "photo" = "shortText", fieldId: string | null = null): DraftQuestion =>
  type === "photo" ? { localId, fieldId, replacesFieldId: null, type, label: { es: localId }, help: null, required: false, files: { minFiles: 0, maxFiles: 1, photoSource: "cameraOrGallery" } }
    : type === "shortText" ? { localId, fieldId, replacesFieldId: null, type, label: { es: localId }, help: null, required: false, maxLength: 80 }
    : { localId, fieldId, replacesFieldId: null, type, label: { es: localId }, help: null, required: false };
const block = (localId = "block"): DraftQuestion =>
  ({ localId, fieldId: null, replacesFieldId: null, type: "group", label: { es: "Artículos" }, help: null, required: true, rows: { minRows: 1, maxRows: 20 } });
const row = (localId: string): DraftQuestion => ({ ...question(localId, "decimal"), repeated: true } as DraftQuestion);
const ids = (prefix: string) => { let next = 0; return () => `${prefix}-${++next}`; };
const local = (fields: readonly DraftQuestion[]) => fields.map(field => field.localId);

describe("the block of rows in the editor", () => {
  it("creates «Bloque» in the place of the first marked question and moves it in as a new question", () => {
    const supplier = question("supplier");
    const quantity = question("quantity", "decimal", "field-quantity");

    const fields = markRepeated([supplier, quantity, question("notes")], "quantity", true, "es", "Bloque", { question: ids("q"), choice: ids("c"), block: ids("b") });

    expect(local(fields)).toEqual(["supplier", "b-1", "q-1", "notes"]);
    expect(fields[1]).toMatchObject({ type: "group", label: { es: "Bloque" }, required: true, rows: { minRows: 1, maxRows: 20 } });
    expect(fields[2]).toMatchObject({ type: "decimal", repeated: true, fieldId: null, replacesFieldId: "field-quantity" });
  });
  it("adds the block at the end of the list as one more question, named and with 1 to 20 items, only once (RG10-D)", () => {
    const fields = addBlock([question("supplier"), question("notes")], "es", "Bloque", "new-block");

    expect(local(fields)).toEqual(["supplier", "notes", "new-block"]);
    expect(fields[2]).toMatchObject({ type: "group", fieldId: null, label: { es: "Bloque" }, required: true, rows: { minRows: 1, maxRows: 20 } });
    expect(addBlock(fields, "es", "Bloque", "other-block")).toBe(fields);
  });
  it("says the items of the block by its minimum and maximum, with the plural of the last number (RG12-A)", () => {
    expect(rowsItems({ minRows: 1, maxRows: 1 })).toEqual({ key: "rows.items", count: 1 });
    expect(rowsItems({ minRows: 3, maxRows: 3 })).toEqual({ key: "rows.items", count: 3 });
    expect(rowsItems({ minRows: 0, maxRows: 10 })).toEqual({ key: "rows.itemsUpTo", count: 10 });
    expect(rowsItems({ minRows: 1, maxRows: 10 })).toEqual({ key: "rows.itemsRange", count: 10, minimum: 1, maximum: 10 });
    // While a bound is being written the line shows what there is; without a maximum, the plural is the general one.
    expect(rowsItems({ minRows: null, maxRows: 10 })).toEqual({ key: "rows.itemsRange", count: 10, minimum: "—", maximum: 10 });
    expect(rowsItems({ minRows: 1, maxRows: null })).toEqual({ key: "rows.itemsRange", count: 0, minimum: 1, maximum: "—" });
  });
  it("joins a marked question at the end of the block, from before or after it", () => {
    const start = [question("before"), block(), row("first"), question("after")];
    const marker = { question: ids("q"), choice: ids("c"), block: ids("b") };

    expect(local(markRepeated(start, "after", true, "es", "Bloque", marker))).toEqual(["before", "block", "first", "after"]);
    expect(local(markRepeated(start, "before", true, "es", "Bloque", marker))).toEqual(["block", "first", "before", "after"]);
  });
  it("leaves an unmarked question right after the block, with a new identity if it was saved", () => {
    const saved = { ...row("second"), fieldId: "field-second" } as DraftQuestion;
    const fields = markRepeated([block(), row("first"), saved, row("third"), question("after")], "second", false, "es", "Bloque",
      { question: ids("q"), choice: ids("c"), block: ids("b") });

    expect(local(fields)).toEqual(["block", "first", "third", "q-1", "after"]);
    expect(fields[3]).toMatchObject({ fieldId: null, replacesFieldId: "field-second" });
    expect(fields[3]).not.toHaveProperty("repeated");
  });
  it("gives a saved list question new options when it enters the block, as a new question", () => {
    const list: DraftQuestion = { localId: "unit", fieldId: "field-unit", replacesFieldId: null, type: "choice", label: { es: "Unidad" }, help: null, required: true,
      options: [{ localId: "liters", choiceId: "choice-liters", label: { es: "Litros" } }] };

    const [, moved] = markRepeated([block(), list], "unit", true, "es", "Bloque", { question: ids("q"), choice: ids("c"), block: ids("b") });

    expect(moved).toMatchObject({ localId: "q-1", repeated: true, options: [{ localId: "c-1", choiceId: null, label: { es: "Litros" } }] });
  });
  it("only marks the types a row holds", () => {
    const fields = [block(), question("photo", "photo")];

    expect(markRepeated(fields, "photo", true, "es", "Bloque", { question: ids("q"), choice: ids("c"), block: ids("b") })).toBe(fields);
    expect(canRepeat(question("photo", "photo"))).toBe(false);
    expect(canRepeat(block())).toBe(false);
    expect(canRepeat(question("text"))).toBe(true);
  });
  it("adds a question of the block at its end, marked", () => {
    const fields = addRowQuestion([block(), row("first"), question("after")], "es", "new");

    expect(local(fields)).toEqual(["block", "first", "new", "after"]);
    expect(fields[2]).toMatchObject({ type: "shortText", repeated: true });
  });
  it("moves the block with its questions and jumps a question over the whole block", () => {
    const fields = [question("before"), block(), row("first"), row("second"), question("after")];

    expect(local(moveTopLevel(fields, "block", -1))).toEqual(["block", "first", "second", "before", "after"]);
    expect(local(moveTopLevel(fields, "after", -1))).toEqual(["before", "after", "block", "first", "second"]);
    expect(local(moveTopLevel(fields, "before", 1))).toEqual(["block", "first", "second", "before", "after"]);
  });
  it("moves a question of the block only inside it", () => {
    const fields = [block(), row("first"), row("second"), question("after")];

    expect(local(moveInRows(fields, "second", -1))).toEqual(["block", "second", "first", "after"]);
    expect(moveInRows(fields, "first", -1)).toBe(fields);
    expect(moveInRows(fields, "second", 1)).toBe(fields);
  });
  it("removes the block with its questions", () => {
    expect(local(removeBlock([question("before"), block(), row("first"), row("second"), question("after")]))).toEqual(["before", "after"]);
  });
  it("numbers the questions of the block after it and counts only questions", () => {
    const fields = [question("a"), question("b"), block(), row("c"), row("d"), question("e")];

    expect(questionNumbers(fields)).toEqual(["1", "2", "3", "3.1", "3.2", "4"]);
    expect(questionCount(fields)).toBe(5);
    expect(rowsBlock(fields)).toEqual({ index: 2, end: 5 });
    expect(rowsBlock([question("a")])).toBeNull();
  });
  it("previews the WhatsApp screens: before the block, «¿Agregás un ítem?» with a minimum of 0, one item and after it", () => {
    const optional = { ...block(), required: false, rows: { minRows: 0, maxRows: 5 } } as DraftQuestion;
    const screens = previewScreens([question("before"), optional, row("first"), question("after")]);

    expect(screens.map(screen => screen.kind)).toEqual(["fields", "ask", "row", "fields"]);
    expect(screens[2]).toMatchObject({ kind: "row", asks: true, questions: [{ localId: "first" }] });
    expect(previewScreens([block(), row("first")]).map(screen => screen.kind)).toEqual(["row"]);
    expect(previewScreens([{ ...block(), rows: { minRows: 2, maxRows: 5 } } as DraftQuestion, row("first")])[0]).toMatchObject({ asks: false });
    expect(previewScreens([question("only")])).toEqual([{ kind: "fields", questions: [question("only")] }]);
  });
});
