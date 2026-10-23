import { expect, it } from "vitest";
import { beginDraftSave, confirmDraftSave, openDraftSession } from "./draftSession";
import { createDraftReview } from "./editorModel";
import type { FormDefinitionSnapshot, FormDraftSaveResult } from "./model";
const source = { catalog: "catalog", match: [{ fieldId: "b", value: "false" }, { fieldId: "a", personAttributeId: "attribute" }], presentation: { title: ["text", "a"], description: ["detail"] } };
const question = { fieldId: "question", key: "field_question", type: "choice" as const, required: true, label: { es: "Equipo" }, help: null, source };
const definition: FormDefinitionSnapshot = { id: "form", revision: 1, prefixLocked: false, prefix: "VIS", offerWhen: null, name: { es: "Visita" }, draft: { format: 1, culture: "es", submitLabel: { es: "Enviar" }, fields: [question] } };
const scope = { actorId: "actor", editorId: "editor" };
it("normalizes and freezes the entire source in one draft attempt", () => {
  const body = beginDraftSave(openDraftSession(scope, definition), "request").pending!.body;
  expect(body.draft.fields[0]!.source?.match?.map(item => item.fieldId)).toEqual(["a", "b"]);
  expect(Object.isFrozen(body.draft.fields[0]!.source?.presentation?.title)).toBe(true);
  expect(body.draft.fields[0]!.fieldId).toBe("question");
});
it.each([{ catalog: "catalog" }, { ...source, match: [] }, { ...source, presentation: { title: ["text"], description: ["detail"] } }])("keeps a receipt unconfirmed if it loses source metadata", changed => {
  const saving = beginDraftSave(openDraftSession(scope, definition), "request");
  const saved: FormDraftSaveResult = { requestId: "request", definition: { ...definition, revision: 2, draft: { ...definition.draft, fields: [{ ...question, source: changed }] } }, identityMap: { fields: [{ localId: "question", fieldId: "question", key: "field_question", replacesFieldId: null }], choices: [] }, recovery: { path: "/api/forms/draft-changes/request", resultExpiresAtUtc: "2099-10-10T16:00:00Z" } };
  expect(confirmDraftSave(saving, { ...scope, requestId: "request" }, saved).phase).toBe("Unconfirmed");
});
it("does not invent source differences from condition ordering or empty inheritance", () => {
  const value = openDraftSession(scope, definition).value;
  const current = { ...definition, draft: { ...definition.draft, fields: [{ ...question, source: { ...source, match: [...source.match].reverse() } }] } };
  expect(createDraftReview(value, current).rows).toEqual([]);
});
