import { describe, expect, it } from "vitest";
import type { FormEntry, FormEntryCorrection, FormEntryQuestion } from "./api/entries";
import { correctionDraft, entryProblemKeys, entryZones, toEntrySend, validateEntry, type EntryDraft } from "./entryForm";

const ids = {
  concept: "00000000-0000-4000-8000-000000000001", from: "00000000-0000-4000-8000-000000000002", block: "00000000-0000-4000-8000-000000000003",
  quantity: "00000000-0000-4000-8000-000000000004", price: "00000000-0000-4000-8000-000000000005", amount: "00000000-0000-4000-8000-000000000006",
  total: "00000000-0000-4000-8000-000000000007", period: "00000000-0000-4000-8000-000000000008", goods: "00000000-0000-4000-8000-0000000000a1",
  services: "00000000-0000-4000-8000-0000000000a2",
};
function question(fieldId: string, type: FormEntryQuestion["type"], extra: Partial<FormEntryQuestion> = {}): FormEntryQuestion {
  return { fieldId, type, label: type, help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null, ...extra };
}
const entry: FormEntry = {
  definitionId: "00000000-0000-4000-8000-0000000000f1", versionId: "00000000-0000-4000-8000-0000000000f2", versionNumber: 1, prefix: "FAC",
  name: "Factura", culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25,
  questions: [
    question(ids.concept, "choice", { options: [{ id: ids.goods, label: "Productos" }, { id: ids.services, label: "Servicios" }] }),
    question(ids.period, "shortText", { maxLength: 80, section: "Período", showWhen: { questionId: ids.concept, values: [ids.services] } }),
    question(ids.from, "date", { showWhen: { questionId: ids.concept, values: [ids.services] } }),
    question(ids.block, "group", { label: "Artículos", section: "Detalle", rows: { minRows: 1, maxRows: 5 } }),
    question(ids.quantity, "decimal", { repeated: true }),
    question(ids.price, "decimal", { repeated: true }),
    question(ids.amount, "decimal", { repeated: true, required: false, calculation: { operation: "multiply", operands: [ids.quantity, ids.price] } }),
    question(ids.total, "decimal", { required: false, calculation: { operation: "sum", operands: [ids.amount] } }),
  ],
};
const item = { key: "item-a", values: { [ids.quantity]: "2", [ids.price]: "10" }, choices: {} };
const goods = (values: Record<string, string> = {}): EntryDraft =>
  ({ values, choices: { [ids.concept]: [{ id: ids.goods, title: "Productos", description: null }] }, files: {}, rows: { [ids.block]: [item] } });
const services = (values: Record<string, string> = {}): EntryDraft => ({ ...goods(values), choices: { [ids.concept]: [{ id: ids.services, title: "Servicios", description: null }] } });

describe("loading a form with calculations and conditions (CA1-A, CO1-A)", () => {
  it("does not ask for a hidden question, and asks again when it shows", () => {
    expect(validateEntry(entry, goods())).toEqual({});
    expect(validateEntry(entry, services())).toEqual({ [ids.period]: "required", [ids.from]: "required" });
    expect(entryProblemKeys(entry, goods())).not.toContain(ids.from);
  });

  it("never sends a calculation nor what was typed in a hidden question", () => {
    const send = toEntrySend(entry, goods({ [ids.period]: "Noviembre", [ids.from]: "2026-11-01", [ids.total]: "99" }), "00000000-0000-4000-8000-0000000000e1");
    expect(send.answers).toEqual([
      { fieldId: ids.concept, value: ids.goods },
      { fieldId: ids.block, rows: [[{ fieldId: ids.quantity, value: "2" }, { fieldId: ids.price, value: "10" }]] },
    ]);
    const shown = toEntrySend(entry, services({ [ids.period]: "Noviembre", [ids.from]: "2026-11-01" }), "00000000-0000-4000-8000-0000000000e1");
    expect(shown.answers.map(answer => answer.fieldId)).toEqual([ids.concept, ids.period, ids.from, ids.block]);
  });

  it("hides in place, and a section title with no question in sight hides too", () => {
    expect(entryZones(entry, goods()).map(zone => zone.key)).toEqual(["data", "section:" + ids.block]);
    expect(entryZones(entry, services()).map(zone => [zone.key, zone.questions.map(question => question.fieldId)])).toEqual([
      ["data", [ids.concept]], ["section:" + ids.period, [ids.period, ids.from]], ["section:" + ids.block, [ids.block, ids.total]],
    ]);
  });

  it("starts a correction without the calculated values: the server computes them again", () => {
    const correction: FormEntryCorrection = { entry, recordId: "00000000-0000-4000-8000-0000000000d1", number: "FAC-1", files: [],
      answers: [{ fieldId: ids.concept, value: ids.goods, choiceIds: null, options: null },
        { fieldId: ids.block, value: null, choiceIds: null, options: null, rows: [[
          { fieldId: ids.quantity, value: "2", choiceIds: null, options: null }, { fieldId: ids.amount, value: "20", choiceIds: null, options: null }]] },
        { fieldId: ids.total, value: "20", choiceIds: null, options: null }] };
    const draft = correctionDraft(correction, "es");
    expect(draft.values).toEqual({});
    expect(draft.rows?.[ids.block]?.[0]?.values).toEqual({ [ids.quantity]: "2" });
  });
});
