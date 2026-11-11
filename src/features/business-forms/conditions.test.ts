import { describe, expect, it } from "vitest";
import type { FormEntry, FormEntryQuestion } from "./api/entries";
import {
  canHaveCondition, chooseConditionQuestion, conditionAnswers, conditionCandidates, conditionIncomplete, entryHiddenQuestions, toggleConditionAnswer, withCondition,
} from "./conditions";
import type { EntryDraft } from "./entryForm";
import type { DraftQuestion } from "./model";

const base = { fieldId: null, replacesFieldId: null, help: null, required: false } as const;
const concept: DraftQuestion = { ...base, localId: "concept", type: "choice", label: { es: "Concepto" },
  options: [{ localId: "goods", choiceId: "choice-goods", label: { es: "Productos" } }, { localId: "services", choiceId: null, label: { es: "Servicios" } }] };
const client: DraftQuestion = { ...base, localId: "field-client", fieldId: "field-client", type: "choice", label: { es: "Cliente" }, source: { catalog: "clients" } };
const paid: DraftQuestion = { ...base, localId: "paid", type: "boolean", label: { es: "¿Pagó?" } };
const crops: DraftQuestion = { ...base, localId: "crops", type: "multiChoice", label: { es: "Cultivos" }, selection: { minSelected: 0, maxSelected: 3 },
  options: [{ localId: "soy", choiceId: null, label: { es: "Soja" } }] };
const block: DraftQuestion = { ...base, localId: "block", type: "group", label: { es: "Artículos" }, required: true, rows: { minRows: 1, maxRows: 5 } };
const unit: DraftQuestion = { ...base, localId: "unit", type: "choice", label: { es: "Unidad" }, repeated: true, options: [{ localId: "kg", choiceId: null, label: { es: "Kg" } }] };
const from: DraftQuestion = { ...base, localId: "from", type: "date", label: { es: "Período desde" } };

describe("a condition in the editor (CO1-A)", () => {
  it("names only an earlier choose-one question, own or from a catalog, or a yes or no, outside the block", () => {
    expect(conditionCandidates([concept, client, paid, crops, block, unit, from], "from", "es", "es")).toEqual([
      { id: "concept", number: "1", label: "Concepto", kind: "own" },
      { id: "field-client", number: "2", label: "Cliente", kind: "catalog", catalog: "clients" },
      { id: "paid", number: "3", label: "¿Pagó?", kind: "boolean" },
    ]);
    expect(conditionCandidates([from, concept], "from", "es", "es")).toEqual([]);
  });

  it("is not offered on the block nor on its questions in this stage", () => {
    expect(canHaveCondition(block)).toBe(false);
    expect(canHaveCondition(unit)).toBe(false);
    expect(canHaveCondition(from)).toBe(true);
  });

  it("starts «Según otra respuesta» without a question, and «Siempre» takes the condition away", () => {
    const conditioned = withCondition(from, true);
    expect(conditioned.showWhen).toEqual({ questionId: null, values: [] });
    expect(withCondition(conditioned, false)).not.toHaveProperty("showWhen");
    expect(withCondition({ ...from, showWhen: { questionId: "concept", values: ["services"] } }, true).showWhen).toEqual({ questionId: "concept", values: ["services"] });
  });

  it("clears the chosen answers when another question is chosen", () => {
    const conditioned = { ...from, showWhen: { questionId: "concept", values: ["services"] } };
    expect(chooseConditionQuestion(conditioned, "paid").showWhen).toEqual({ questionId: "paid", values: [] });
    expect(chooseConditionQuestion(conditioned, "concept")).toBe(conditioned);
  });

  it("adds and removes an answer, in the order of the question's answers", () => {
    const conditioned = { ...from, showWhen: { questionId: "concept", values: ["services"] } };
    expect(toggleConditionAnswer(conditioned, "choice-goods", true, ["choice-goods", "services"]).showWhen?.values).toEqual(["choice-goods", "services"]);
    expect(toggleConditionAnswer(conditioned, "services", false, ["choice-goods", "services"]).showWhen?.values).toEqual([]);
  });

  it("offers the own options by their identity, or the local one while new, and yes or no", () => {
    expect(conditionAnswers(concept)).toEqual([{ id: "choice-goods", label: { es: "Productos" } }, { id: "services", label: { es: "Servicios" } }]);
    expect(conditionAnswers(paid)).toEqual([{ id: "true", yes: true }, { id: "false", yes: false }]);
    expect(conditionAnswers(client)).toBeNull();
  });

  it("cannot be saved without its question or an answer", () => {
    expect(conditionIncomplete({ ...from, showWhen: { questionId: null, values: [] } })).toBe(true);
    expect(conditionIncomplete({ ...from, showWhen: { questionId: "concept", values: [] } })).toBe(true);
    expect(conditionIncomplete({ ...from, showWhen: { questionId: "concept", values: ["services"] } })).toBe(false);
    expect(conditionIncomplete(from)).toBe(false);
  });
});

describe("questions that appear and disappear while loading (CO1-A)", () => {
  const ids = {
    concept: "00000000-0000-4000-8000-000000000001", from: "00000000-0000-4000-8000-000000000002", until: "00000000-0000-4000-8000-000000000003",
    paid: "00000000-0000-4000-8000-000000000004", receipt: "00000000-0000-4000-8000-000000000005", goods: "00000000-0000-4000-8000-0000000000a1",
    services: "00000000-0000-4000-8000-0000000000a2", client: "00000000-0000-4000-8000-000000000006", agro: "00000000-0000-4000-8000-0000000000b1",
    discount: "00000000-0000-4000-8000-000000000007",
  };
  function question(fieldId: string, type: FormEntryQuestion["type"], extra: Partial<FormEntryQuestion> = {}): FormEntryQuestion {
    return { fieldId, type, label: type, help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null, ...extra };
  }
  const entry: FormEntry = {
    definitionId: "00000000-0000-4000-8000-0000000000f1", versionId: "00000000-0000-4000-8000-0000000000f2", versionNumber: 1, prefix: "FAC",
    name: "Factura", culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25,
    questions: [
      question(ids.concept, "choice", { options: [{ id: ids.goods, label: "Productos" }, { id: ids.services, label: "Servicios" }] }),
      question(ids.from, "date", { showWhen: { questionId: ids.concept, values: [ids.services] } }),
      question(ids.paid, "boolean", { showWhen: { questionId: ids.concept, values: [ids.services] } }),
      question(ids.receipt, "shortText", { maxLength: 80, showWhen: { questionId: ids.paid, values: ["true"] } }),
      question(ids.client, "choice", { catalog: { onlyOption: null, issue: null, missingData: null } }),
      question(ids.discount, "decimal", { showWhen: { questionId: ids.client, values: [ids.agro] } }),
    ],
  };
  const draft = (values: Record<string, string>, choices: EntryDraft["choices"] = {}): EntryDraft => ({ values, choices, files: {} });
  const option = (id: string) => [{ id, title: id, description: null }];

  it("hides what depends on an answer that is missing or another", () => {
    expect(entryHiddenQuestions(entry, draft({}))).toEqual(new Set([ids.from, ids.paid, ids.receipt, ids.discount]));
    expect(entryHiddenQuestions(entry, draft({}, { [ids.concept]: option(ids.goods) }))).toEqual(new Set([ids.from, ids.paid, ids.receipt, ids.discount]));
  });

  it("shows a question with one of its answers, by an own option, a yes or no or a catalog option", () => {
    expect(entryHiddenQuestions(entry, draft({ [ids.paid]: "true" }, { [ids.concept]: option(ids.services), [ids.client]: option(ids.agro) }))).toEqual(new Set());
    expect(entryHiddenQuestions(entry, draft({ [ids.paid]: "false" }, { [ids.concept]: option(ids.services) }))).toEqual(new Set([ids.receipt, ids.discount]));
  });

  it("hides a chain when its first question hides, whatever was answered below", () => {
    expect(entryHiddenQuestions(entry, draft({ [ids.paid]: "true" }, { [ids.concept]: option(ids.goods) }))).toEqual(new Set([ids.from, ids.paid, ids.receipt, ids.discount]));
  });
});
