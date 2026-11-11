import { describe, expect, it } from "vitest";
import type { FormEntry, FormEntryCorrection, FormEntryQuestion } from "./api/entries";
import {
  addEntryItem, carryEntryDraft, clearDependentChoices, correctionDraft, entryBlock, entryDependencyAnswers, entryDraftKey, entryItemsLoaded,
  entryProblemKeys, entryProblemQuestion, entryQuestionSpan, entrySignature, entryZones, initialEntryDraft, keepForNextEntry, moveEntryItem,
  removeEntryItem, toEntrySend, validateEntry, type EntryDraft,
} from "./entryForm";

const ids = {
  supplier: "00000000-0000-4000-8000-000000000001", block: "00000000-0000-4000-8000-000000000002", item: "00000000-0000-4000-8000-000000000003",
  quantity: "00000000-0000-4000-8000-000000000004", unit: "00000000-0000-4000-8000-000000000005", zone: "00000000-0000-4000-8000-000000000006",
  lot: "00000000-0000-4000-8000-000000000007", liter: "00000000-0000-4000-8000-0000000000a1", glifo: "00000000-0000-4000-8000-0000000000b1",
  urea: "00000000-0000-4000-8000-0000000000b2", north: "00000000-0000-4000-8000-0000000000c1", south: "00000000-0000-4000-8000-0000000000c2",
};
function question(fieldId: string, type: FormEntryQuestion["type"], extra: Partial<FormEntryQuestion> = {}): FormEntryQuestion {
  return { fieldId, type, label: type, help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null, ...extra };
}
const catalog = (extra: Partial<NonNullable<FormEntryQuestion["catalog"]>> = {}) => ({ onlyOption: null, issue: null, missingData: null, ...extra });
const glifo = { id: ids.glifo, title: "Glifosato 64%", description: null };
const urea = { id: ids.urea, title: "Urea granulada", description: null };
const liter = { id: ids.liter, title: "Litros", description: null };
function blockEntry(minRows = 1, maxRows = 3, only = false): FormEntry {
  return {
    definitionId: "00000000-0000-4000-8000-0000000000f1", versionId: "00000000-0000-4000-8000-0000000000f2", versionNumber: 1, prefix: "INS",
    name: "Recepción de insumos", culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25,
    questions: [
      question(ids.supplier, "shortText", { maxLength: 80 }),
      question(ids.block, "group", { label: "Artículos", required: minRows > 0, rows: { minRows, maxRows } }),
      question(ids.item, "choice", { label: "Artículo", repeated: true, catalog: catalog(only ? { onlyOption: glifo } : {}) }),
      question(ids.quantity, "decimal", { label: "Cantidad", repeated: true }),
      question(ids.unit, "choice", { label: "Unidad", required: false, repeated: true, options: [{ id: ids.liter, label: "Litros" }] }),
    ],
  };
}
const items = (draft: EntryDraft) => draft.rows?.[ids.block] ?? [];
function filled(entry: FormEntry, ...rows: { item: typeof glifo; quantity: string; unit?: boolean }[]): EntryDraft {
  let draft = initialEntryDraft(entry);
  while (items(draft).length < rows.length) draft = addEntryItem(entry, draft);
  return { ...draft, values: { [ids.supplier]: "Agro Norte" }, rows: { [ids.block]: items(draft).map((current, index) => ({
    ...current, values: { [ids.quantity]: rows[index].quantity }, choices: { [ids.item]: [rows[index].item], ...rows[index].unit ? { [ids.unit]: [liter] } : {} },
  })) } };
}

describe("loading the items of a block", () => {
  it("starts with the minimum of items, each with the only option the filters leave", () => {
    expect(items(initialEntryDraft(blockEntry(2, 3)))).toHaveLength(2);
    expect(items(initialEntryDraft(blockEntry(0, 3)))).toEqual([]);
    const draft = initialEntryDraft(blockEntry(1, 3, true));
    expect(items(draft)[0].choices[ids.item]).toEqual([glifo]);
    expect(draft.choices[ids.item]).toBeUndefined();
  });

  it("starts each new item, and a loose list, at the option the standard declares, which can be changed (IV1-A)", () => {
    const base = blockEntry(1, 3);
    const entry: FormEntry = { ...base, questions: [question(ids.zone, "choice", { catalog: catalog({ default: urea }) }),
      ...base.questions.map(item => item.fieldId === ids.item ? { ...item, catalog: catalog({ default: glifo }) } : item)] };

    const draft = addEntryItem(entry, initialEntryDraft(entry));
    expect(items(draft).map(item => item.choices[ids.item])).toEqual([[glifo], [glifo]]);
    expect(draft.choices[ids.zone]).toEqual([urea]);
    expect(entryItemsLoaded(entry, draft)).toBe(false);
    expect(entryItemsLoaded(entry, { ...draft, rows: { [ids.block]: items(draft).map(item => ({ ...item, choices: { [ids.item]: [urea] } })) } })).toBe(true);
  });

  it("draws the block across the whole row of its zone and its questions only inside it", () => {
    const entry = blockEntry();
    expect(entryBlock(entry)).toEqual({ group: entry.questions[1], questions: entry.questions.slice(2) });
    expect(entryZones(entry).flatMap(zone => zone.questions.map(item => item.fieldId))).toEqual([ids.supplier, ids.block]);
    expect(entryQuestionSpan(entry.questions[1])).toBe(3);
    expect(entryBlock({ ...entry, questions: [entry.questions[0]] })).toBeNull();
  });

  it("adds items up to the maximum, removes them down to the minimum and moves them", () => {
    const entry = blockEntry(1, 2);
    const one = initialEntryDraft(entry);
    const two = addEntryItem(entry, one);
    expect(items(two)).toHaveLength(2);
    expect(addEntryItem(entry, two)).toBe(two);
    const [first, second] = items(two);
    expect(new Set([first.key, second.key]).size).toBe(2);
    expect(items(moveEntryItem(entry, two, second.key, -1)).map(item => item.key)).toEqual([second.key, first.key]);
    expect(moveEntryItem(entry, two, first.key, -1)).toBe(two);
    expect(items(removeEntryItem(entry, two, first.key)).map(item => item.key)).toEqual([second.key]);
    expect(removeEntryItem(entry, one, items(one)[0].key)).toBe(one);
  });

  it("checks each item as loose questions and the number of items", () => {
    const entry = blockEntry(2, 3);
    const draft = filled(entry, { item: glifo, quantity: "200,5" }, { item: urea, quantity: "abc" });
    const missing: EntryDraft = { ...draft, rows: { [ids.block]: [{ ...items(draft)[0], values: {}, choices: {} }] } };

    expect(validateEntry(entry, draft)).toEqual({ [`${ids.block}.1.${ids.quantity}`]: "number" });
    expect(validateEntry(entry, missing)).toEqual({ [ids.block]: "rowsAtLeast", [`${ids.block}.0.${ids.item}`]: "choose", [`${ids.block}.0.${ids.quantity}`]: "required" });
    expect(validateEntry(blockEntry(0, 1), { ...draft, rows: { [ids.block]: [...items(draft), ...items(draft)] } })[ids.block]).toBe("rowsAtMost");
  });

  it("lists the problems in the order of the form and says which question each one names", () => {
    const entry = blockEntry();
    const draft = filled(entry, { item: glifo, quantity: "1" }, { item: urea, quantity: "2" });

    expect(entryProblemKeys(entry, draft)).toEqual([ids.supplier, ids.block,
      `${ids.block}.0.${ids.item}`, `${ids.block}.0.${ids.quantity}`, `${ids.block}.0.${ids.unit}`,
      `${ids.block}.1.${ids.item}`, `${ids.block}.1.${ids.quantity}`, `${ids.block}.1.${ids.unit}`]);
    expect(entryProblemQuestion(entry, `${ids.block}.1.${ids.quantity}`)).toEqual({ question: entry.questions[3], group: entry.questions[1], row: 1 });
    expect(entryProblemQuestion(entry, ids.block)).toEqual({ question: entry.questions[1] });
    expect(entryProblemQuestion(entry, "00000000-0000-4000-8000-0000000000ff")).toBeNull();
  });

  it("tells an item with something loaded from one with only what came chosen", () => {
    const empty = initialEntryDraft(blockEntry(1, 3, true));

    expect(entryItemsLoaded(blockEntry(1, 3, true), empty)).toBe(false);
    expect(entryItemsLoaded(blockEntry(), { ...empty, rows: { [ids.block]: [{ ...items(empty)[0], values: { [ids.quantity]: "3" }, choices: {} }] } })).toBe(true);
    expect(entryItemsLoaded(blockEntry(1, 3, true), { ...empty, rows: { [ids.block]: [{ ...items(empty)[0], choices: { [ids.item]: [urea] } }] } })).toBe(true);
  });

  it("sends the block with its items, each with its answers in the order of the questions", () => {
    const entry = blockEntry();
    const send = toEntrySend(entry, filled(entry, { item: glifo, quantity: "200,5", unit: true }, { item: urea, quantity: "100" }), "00000000-0000-4000-8000-0000000000d1");

    expect(send.answers).toEqual([
      { fieldId: ids.supplier, value: "Agro Norte" },
      { fieldId: ids.block, rows: [
        [{ fieldId: ids.item, value: ids.glifo }, { fieldId: ids.quantity, value: "200.5" }, { fieldId: ids.unit, value: ids.liter }],
        [{ fieldId: ids.item, value: ids.urea }, { fieldId: ids.quantity, value: "100" }],
      ] },
    ]);
    expect(toEntrySend(blockEntry(0, 3), initialEntryDraft(blockEntry(0, 3)), "00000000-0000-4000-8000-0000000000d1").answers)
      .toEqual([{ fieldId: ids.block, rows: [] }]);
  });

  it("keeps the items in a new version while the block stays, with the questions that keep their type", () => {
    const entry = blockEntry();
    const draft = filled(entry, { item: glifo, quantity: "200", unit: true });
    const changed = { ...entry, versionId: "00000000-0000-4000-8000-0000000000f3", questions: [...entry.questions.slice(0, 3), question(ids.quantity, "shortText", { repeated: true })] };
    const carried = items(carryEntryDraft(entry, draft, changed));

    expect(carried).toHaveLength(1);
    expect(carried[0].choices).toEqual({ [ids.item]: [glifo] });
    expect(carried[0].values).toEqual({});
    expect(carryEntryDraft(entry, draft, { ...entry, questions: [entry.questions[0]] }).rows ?? {}).toEqual({});
  });

  it("keeps the items for the next response and tells a different send by them", () => {
    const entry = blockEntry();
    const draft = filled(entry, { item: glifo, quantity: "200" });
    const other = filled(entry, { item: glifo, quantity: "201" });

    expect(items(keepForNextEntry(draft))).toEqual(items(draft));
    expect(entrySignature(entry, other)).not.toBe(entrySignature(entry, draft));
    expect(entryDraftKey(other)).not.toBe(entryDraftKey(draft));
    expect(entryDraftKey({ ...draft, rows: { [ids.block]: items(draft).map(item => ({ ...item, key: "otra" })) } })).toBe(entryDraftKey(draft));
  });

  it("opens a correction with its items, the decimal as the menu writes it", () => {
    const entry = blockEntry();
    const correction: FormEntryCorrection = { entry, recordId: "00000000-0000-4000-8000-0000000000e1", number: "INS-000005", files: [],
      answers: [{ fieldId: ids.supplier, value: "Agro Norte", choiceIds: null, options: null }, { fieldId: ids.block, value: null, choiceIds: null, options: null, rows: [
        [{ fieldId: ids.item, value: ids.glifo, choiceIds: null, options: [glifo] }, { fieldId: ids.quantity, value: "200.5", choiceIds: null, options: null },
          { fieldId: ids.unit, value: ids.liter, choiceIds: null, options: null }],
        [{ fieldId: ids.item, value: ids.urea, choiceIds: null, options: [urea] }],
      ] }] };

    const draft = correctionDraft(correction, "es");

    expect(items(draft).map(item => [item.values, item.choices])).toEqual([
      [{ [ids.quantity]: "200,5" }, { [ids.item]: [glifo], [ids.unit]: [{ id: ids.liter, title: "Litros", description: null }] }],
      [{}, { [ids.item]: [urea] }],
    ]);
    expect(draft.values).toEqual({ [ids.supplier]: "Agro Norte" });
  });

  it("filters a list of the block by the answer of its own item, or by the answer outside the block (LD3-A)", () => {
    const entry: FormEntry = { ...blockEntry(), questions: [
      question(ids.zone, "choice", { catalog: catalog() }),
      question(ids.block, "group", { rows: { minRows: 1, maxRows: 3 } }),
      question(ids.item, "choice", { repeated: true, catalog: catalog() }),
      question(ids.lot, "choice", { repeated: true, catalog: catalog({ dependsOn: [ids.item] }) }),
      question(ids.unit, "choice", { repeated: true, catalog: catalog({ dependsOn: [ids.zone] }) }),
    ] };
    const north = { id: ids.north, title: "Lote norte", description: null };
    const south = { id: ids.south, title: "Lote sur", description: null };
    let draft = addEntryItem(entry, initialEntryDraft(entry));
    draft = { ...draft, choices: { [ids.zone]: [liter] }, rows: { [ids.block]: items(draft).map((item, index) => ({
      ...item, choices: { [ids.item]: [index === 0 ? glifo : urea], [ids.lot]: [index === 0 ? north : south], [ids.unit]: [liter] } })) } };
    const [first, second] = items(draft);

    expect(entryDependencyAnswers(entry.questions[3], draft, first)).toEqual({ [ids.item]: ids.glifo });
    expect(entryDependencyAnswers(entry.questions[3], draft, second)).toEqual({ [ids.item]: ids.urea });
    expect(entryDependencyAnswers(entry.questions[4], draft, second)).toEqual({ [ids.zone]: ids.liter });
    const inItem = clearDependentChoices(entry, draft, ids.item, first.key);
    expect(items(inItem)[0].choices[ids.lot]).toBeUndefined();
    expect(items(inItem)[1].choices[ids.lot]).toEqual([south]);
    const outside = clearDependentChoices(entry, draft, ids.zone);
    expect(items(outside).map(item => item.choices[ids.unit])).toEqual([undefined, undefined]);
    expect(items(outside).map(item => item.choices[ids.lot])).toEqual([[north], [south]]);
  });
});
