import { describe, expect, it } from "vitest";
import { createDraftReview, resolveDraftReview, replaceQuestionType, localizedValue, newQuestion, missingFormTexts, changeQuestionCatalog } from "./editorModel";
import { openDraftSession } from "./draftSession";
import type { FormDefinitionSnapshot } from "./model";

const current: FormDefinitionSnapshot = { offerWhen: null, id: "form", name: { es: "Visita" }, prefix: "VIS", prefixLocked: true, revision: 3,
  draft: { format: 1, culture: "es", submitLabel: { es: "Enviar", en: "Send" }, fields: [
    { fieldId: "second", key: "second", type: "longText", label: { es: "Observaciones" }, help: null, required: false, maxLength: 300 },
    { fieldId: "first", key: "first", type: "choice", label: { es: "Cliente" }, help: null, required: true,
      options: [{ choiceId: "live", label: { es: "Norte" } }] },
  ] } };
const scope = { actorId: "actor", editorId: "editor" };
describe("explicit draft review", () => {
  it("reviews translations separately without overwriting another language", () => {
    const baseline: FormDefinitionSnapshot = { ...current, name: { es: "Visita", en: "Visit" }, draft: { ...current.draft,
      fields: current.draft.fields.map(q => ({ ...q, label: { es: "Original", en: "Original English" } })) } };
    const saved = openDraftSession(scope, baseline).value;
    const mine = { ...saved, name: { ...saved.name, en: "My translation" }, draft: { ...saved.draft,
      fields: saved.draft.fields.map(q => ({ ...q, label: { ...q.label, en: "My question" } })) } };
    const actual = { ...baseline, name: { ...baseline.name, es: "Nombre actualizado" }, draft: { ...baseline.draft,
      fields: baseline.draft.fields.map(q => ({ ...q, label: { ...q.label, es: "Pregunta actualizada" } })) } };
    const review = createDraftReview(mine, actual);
    expect(review.rows.some(row => row.kind === "name" && row.culture === "en")).toBe(true);
    const resolved = resolveDraftReview(review, Object.fromEntries(review.rows.map(row => [row.id, row.culture === "en" ? "mine" : "current"])));
    expect(resolved?.name).toEqual({ es: "Nombre actualizado", en: "My translation" });
    expect(resolved?.draft.fields[0]!.label).toEqual({ es: "Pregunta actualizada", en: "My question" });
  });
  it.each([{ es: null, en: "Details" }, { es: null, en: null }])("preserves explicit help erasure when keeping changes after a conflict: %j", help => {
    const definition: FormDefinitionSnapshot = { ...current, draft: { ...current.draft,
      fields: current.draft.fields.map(field => ({ ...field, help: { es: "Detalle", en: "Details" } })) } };
    const saved = openDraftSession(scope, definition).value;
    const mine = { ...saved, draft: { ...saved.draft, fields: saved.draft.fields.map(field => ({ ...field, help })) } };
    const review = createDraftReview(mine, definition);
    const resolved = resolveDraftReview(review, Object.fromEntries(review.rows.map(row => [row.id, "mine"])));
    expect(resolved?.draft.fields.map(field => field.help)).toEqual([help, help]);
    expect(resolved?.draft.submitLabel).toEqual({ es: "Enviar", en: "Send" });
  });

  it("counts every missing required text and only counts help when help exists", () => {
    const saved = openDraftSession(scope, current).value;
    const value = { ...saved, name: { es: "Visita", en: "" }, draft: { ...saved.draft, submitLabel: { es: "Enviar", en: "Send" },
      fields: saved.draft.fields.map(q => q.type === "choice" && !q.source ? { ...q, label: { es: "Cliente", en: "Customer" }, options: q.options.map(o => ({ ...o, label: { es: "Norte" } })) }
        : { ...q, label: { es: "Notas", en: "Notes" }, help: { es: "Ayuda", en: null } }) } };
    expect(missingFormTexts(value, "en")).toBe(3);
    expect(missingFormTexts(value, "es")).toBe(0);
    expect(value.name.en).toBe("");
  });

  it("creates valid option tokens in the original culture without deriving them from the parent token", () => {
    const question = newQuestion("choice", "en", "x".repeat(64));
    expect(question.type).toBe("choice");
    if (question.type !== "choice" || question.source) throw new Error("Expected choice");
    expect(question.options[0]!.localId).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(question.options[0]!.label).toEqual({ en: "" });
  });
  it("resolves each healthy option independently within its parent and keeps translations", () => {
    const definition: FormDefinitionSnapshot = { ...current, draft: { ...current.draft, fields: [
      { fieldId: "a", key: "a", type: "choice", label: { es: "Cliente" }, help: null, required: true, options: [{ choiceId: "a-choice", label: { es: "Norte", en: "North" } }] },
      { fieldId: "b", key: "b", type: "choice", label: { es: "Depósito" }, help: null, required: false, options: [{ choiceId: "b-choice", label: { es: "Sur", en: "South" } }] },
    ] } };
    const saved = openDraftSession(scope, definition).value;
    const mine = { ...saved, draft: { ...saved.draft, fields: saved.draft.fields.map(q => q.type === "choice" && !q.source ? { ...q, options: q.options.map(o => ({ ...o, localId: "same-local", label: { ...o.label, en: "Changed" } })) } : q) } };
    const review = createDraftReview(mine, definition);
    expect(review.rows).toHaveLength(2);
    expect(new Set(review.rows.map(r => r.id)).size).toBe(2);
    const decisions = Object.fromEntries(review.rows.map(r => [r.id, r.parentId === "a" ? "mine" : "current"]));
    const resolved = resolveDraftReview(review, decisions);
    expect(resolved?.draft.fields).toMatchObject([{ options: [{ choiceId: "a-choice", label: { es: "Norte", en: "Changed" } }] }, { options: [{ choiceId: "b-choice", label: { es: "Sur", en: "South" } }] }]);
  });

  it("compares by field identity despite changed positions and requires all decisions before rebasing", () => {
    const saved = openDraftSession(scope, current).value;
    const mine = { ...saved, prefix: "ENT", draft: { ...saved.draft, fields: [...saved.draft.fields].reverse().map(q => q.type === "longText" ? { ...q, maxLength: 600 } : q) } };
    const review = createDraftReview(mine, current);
    expect(review.rows.map(row => row.id)).toEqual(expect.arrayContaining(["prefix", "order", "field:second"]));
    expect(resolveDraftReview(review, {})).toBeNull();
    const decisions = Object.fromEntries(review.rows.map(row => [row.id, row.canKeep ? "mine" : "current"]));
    const resolved = resolveDraftReview(review, decisions);
    expect(resolved?.prefix).toBe("VIS");
    expect(resolved?.draft.fields.map(q => q.fieldId)).toEqual(["first", "second"]);
    expect(resolved?.draft.fields[1]).toMatchObject({ maxLength: 600 });
  });
  it("does not revive a retired question or option and retains the intent for review", () => {
    const saved = openDraftSession(scope, current).value;
    const mine = { ...saved, draft: { ...saved.draft, fields: [...saved.draft.fields,
      { localId: "retired", fieldId: "retired", replacesFieldId: null, type: "date" as const, label: { es: "Fecha" }, help: null, required: true },
    ].map(q => q.type === "choice" && !q.source ? { ...q, options: [...q.options, { localId: "old", choiceId: "retired-option", label: { es: "Sur" } }] } : q) } };
    const review = createDraftReview(mine, current);
    expect(review.rows.find(row => row.id === "field:retired")?.canKeep).toBe(false);
    expect(review.rows.find(row => row.kind === "option" && row.optionId === "retired-option")?.canKeep).toBe(false);
    expect(review.rows.find(row => row.id === "field:first")).toBeUndefined();
    expect(resolveDraftReview(review, Object.fromEntries(review.rows.map(r => [r.id, "mine"])))).toBeNull();
    expect(resolveDraftReview(review, Object.fromEntries(review.rows.map(r => [r.id, "current"])))?.draft.fields).toHaveLength(2);
    expect(mine.draft.fields).toHaveLength(3);
  });
  it("preserves translations and replaces types with a new local identity", () => {
    const original = openDraftSession(scope, current).value.draft.fields[0]!;
    const changed = replaceQuestionType(original, "decimal", "new-local", "es");
    expect(changed).toMatchObject({ localId: "new-local", fieldId: null, replacesFieldId: "second", label: original.label });
    expect(changed).not.toHaveProperty("maxLength");
    expect(localizedValue({ es: "Sin traducción" }, "en", "es")).toBe("Sin traducción");
  });
});

it("replaces a confirmed catalog field while preserving texts and keeps an unconfirmed selection local", () => {
  const field = { localId: "saved", fieldId: "old-field", replacesFieldId: null, type: "choice", source: { catalog: "catalog-a" }, label: { es: "Cliente", en: "Customer" }, help: { es: "Elegí" }, required: true } as unknown as import("./model").DraftQuestion;
  const replaced = changeQuestionCatalog(field, "catalog-b", "new-local");
  expect(replaced).toEqual({ ...field, localId: "new-local", fieldId: null, replacesFieldId: "old-field", source: { catalog: "catalog-b" } });
  expect(changeQuestionCatalog(field, "catalog-a", "unused")).toBe(field);
  expect(changeQuestionCatalog(replaced, "catalog-c", "unused")).toEqual({ ...replaced, source: { catalog: "catalog-c" } });
});

it("rebases one monolingual offer instruction explicitly without creating translation changes", () => {
  const definition = { ...current, offerWhen: "Cuando entrega un pedido" };
  const mine = { ...openDraftSession(scope, definition).value, offerWhen: "Cuando visita a un cliente" };
  const review = createDraftReview(mine, definition);
  expect(review.rows).toEqual([{ id: "offerWhen", kind: "offerWhen", mine: mine.offerWhen, current: definition.offerWhen, canKeep: true }]);
  expect(resolveDraftReview(review, { offerWhen: "mine" })).toHaveProperty("offerWhen", mine.offerWhen);
  expect(resolveDraftReview(review, { offerWhen: "current" })).toHaveProperty("offerWhen", definition.offerWhen);
  expect(resolveDraftReview(review, {})).toBeNull();
});

it("counts each missing own multi-choice translation and keeps range-only conflicts explicit", () => {
  const multiple: FormDefinitionSnapshot = { ...current, name: { es: "Visita", en: "Visit" }, draft: { ...current.draft, fields: [{
    fieldId: "multi", key: "field_multi", type: "multiChoice", label: { es: "Fallas", en: "Faults" }, help: null, required: true,
    selection: { minSelected: 1, maxSelected: 3 },
    options: [{ choiceId: "cold", label: { es: "Frío", en: "" } }, { choiceId: "noise", label: { es: "Ruido", en: "Noise" } }],
  }] } };
  const saved = openDraftSession(scope, multiple).value;
  expect(missingFormTexts(saved, "en")).toBe(1);
  expect(missingFormTexts(saved, "es")).toBe(0);
  const mine = { ...saved, draft: { ...saved.draft, fields: saved.draft.fields.map(field => field.type === "multiChoice"
    ? { ...field, selection: { ...field.selection, maxSelected: 2 } } : field) } };
  const review = createDraftReview(mine, multiple);
  expect(review.rows).toContainEqual(expect.objectContaining({ id: "field:multi", canKeep: true }));
  const keepMine = Object.fromEntries(review.rows.map(row => [row.id, "mine"]));
  const keepCurrent = Object.fromEntries(review.rows.map(row => [row.id, "current"]));
  expect(resolveDraftReview(review, keepMine)?.draft.fields[0]).toHaveProperty("selection.maxSelected", 2);
  expect(resolveDraftReview(review, keepCurrent)?.draft.fields[0]).toHaveProperty("selection.maxSelected", 3);
  expect(mine.draft.fields[0]).toHaveProperty("selection.maxSelected", 2);
});
