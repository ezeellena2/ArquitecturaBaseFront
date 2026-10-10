import { describe, expect, it } from "vitest";
import {
  beginDraftSave, changeDraft, confirmDraftSave, discardDraft, markDraftSaveUnconfirmed,
  openDraftSession, requestDraftReview, rejectDraftSave, startDraftSession,
} from "./draftSession";
import type { DraftEditorValue, FormDraftSaveResult, FormDefinitionSnapshot } from "./model";

const scope = { actorId: "actor-a", editorId: "editor-a" };
const initial: DraftEditorValue = {
  name: { es: "Pedido" }, prefix: "PED", draft: {
    format: 1, culture: "es", submitLabel: { es: "Enviar pedido", en: "Submit request" },
    fields: [
      { localId: "q-a", fieldId: null, replacesFieldId: null, type: "choice", label: { es: "Turno", en: "Shift" }, help: null, required: true,
        options: [{ localId: "opt-1", choiceId: null, label: { es: "Mañana" } }] },
      { localId: "q-b", fieldId: null, replacesFieldId: null, type: "choice", label: { es: "Entrega" }, help: { es: "Elegí", en: "Choose" }, required: false,
        options: [{ localId: "opt-1", choiceId: null, label: { es: "Retiro" } }] },
    ],
  },
};
function result(requestId = "request-a", revision = 1): FormDraftSaveResult {
  return {
    requestId, definition: {
      id: "definition-a", name: { es: "Pedido" }, prefix: "PED", prefixLocked: false, revision,
      draft: { ...initial.draft, fields: [
        { fieldId: "field-a", key: "field_1", type: "choice", label: { es: "Turno", en: "Shift" }, help: null, required: true,
          options: [{ choiceId: "choice-a", label: { es: "Mañana" } }] },
        { fieldId: "field-b", key: "field_2", type: "choice", label: { es: "Entrega" }, help: { es: "Elegí", en: "Choose" }, required: false,
          options: [{ choiceId: "choice-b", label: { es: "Retiro" } }] },
      ] },
    },
    identityMap: {
      fields: [
        { localId: "q-b", fieldId: "field-b", key: "field_2", replacesFieldId: null },
        { localId: "q-a", fieldId: "field-a", key: "field_1", replacesFieldId: null },
      ],
      choices: [
        { fieldLocalId: "q-b", localId: "opt-1", fieldId: "field-b", choiceId: "choice-b" },
        { fieldLocalId: "q-a", localId: "opt-1", fieldId: "field-a", choiceId: "choice-a" },
      ],
    },
    recovery: { path: `/api/forms/draft-changes/${requestId}`, resultExpiresAtUtc: "2026-11-08T12:00:00Z" },
  };
}
const identity = { ...scope, requestId: "request-a" };
const saving = () => beginDraftSave(startDraftSession(scope, initial), "request-a");

describe("form draft session", () => {
  it("requires an explicit review after a read conflict without changing the saved revision or values", () => {
    const session = changeDraft(openDraftSession(scope, result().definition), { ...initial, name: { es: "Private changes" } });
    const review = requestDraftReview(session);
    expect(review.phase).toBe("ReviewRequired");
    expect(review.value).toBe(session.value);
    expect(review.baseline).toBe(session.baseline);
    expect(review.confirmed?.revision).toBe(1);
    expect(review.pending).toBeNull();
    expect(beginDraftSave(review, "new-attempt")).toBe(review);
  });
  it("cannot release an uncertain attempt or turn a new form into an external read review", () => {
    const uncertain = markDraftSaveUnconfirmed(saving(), identity);
    expect(requestDraftReview(uncertain)).toBe(uncertain);
    const fresh = startDraftSession(scope, initial);
    expect(requestDraftReview(fresh)).toBe(fresh);
  });
  it("creates one frozen complete attempt without assigning canonical identities", () => {
    const session = saving();
    expect(session.pending?.body).toEqual({ requestId: "request-a", ...initial });
    expect(session.pending?.definitionId).toBeNull();
    expect(session.phase).toBe("Saving");
    expect(session.confirmed).toBeNull();
    expect(Object.isFrozen(session.pending?.body.draft.fields[0].label)).toBe(true);
    expect(session.pending?.body.draft.fields[0]).not.toBe(initial.draft.fields[0]);
  });

  it("keeps the attempt, values and baseline during uncertainty, another submit or discard", () => {
    const session = markDraftSaveUnconfirmed(saving(), identity);
    expect(session.phase).toBe("Unconfirmed");
    expect(beginDraftSave(session, "different-request")).toBe(session);
    expect(changeDraft(session, { ...initial, name: { es: "Other" } })).toBe(session);
    expect(discardDraft(session)).toBe(session);
    expect(session.pending?.body.requestId).toBe("request-a");
    expect(session.baseline).toEqual(initial);
  });

  it("binds identical option localIds in two parents and applies snapshot/map/baseline together", () => {
    const session = confirmDraftSave(saving(), identity, result());
    expect(session.phase).toBe("Editing");
    expect(session.pending).toBeNull();
    expect(session.confirmed?.revision).toBe(1);
    expect(session.identityMap).toEqual(result().identityMap);
    expect(session.value.draft.fields.map(field => field.localId)).toEqual(["q-a", "q-b"]);
    expect(session.value.draft.fields.map(field => field.fieldId)).toEqual(["field-a", "field-b"]);
    expect(session.value.draft.fields.flatMap(field => field.type === "choice" ? field.options.map(option => option.choiceId) : [])).toEqual(["choice-a", "choice-b"]);
    expect(session.baseline).toEqual(session.value);
    expect(session.value.draft.submitLabel.en).toBe("Submit request");
    expect(session.value.draft.fields[1].help?.en).toBe("Choose");
  });

  it("uses canonical content from the result and isolates it from later object mutation", () => {
    const canonical = result();
    const changed = { ...canonical, definition: { ...canonical.definition, prefix: "NORMALIZED" } };
    const session = confirmDraftSave(saving(), identity, changed);
    changed.definition.prefix = "MUTATED";
    expect(session.value.prefix).toBe("NORMALIZED");
    expect(session.confirmed?.prefix).toBe("NORMALIZED");
    expect(Object.isFrozen(session.identityMap?.choices)).toBe(true);
  });

  it.each([
    { ...identity, actorId: "actor-b" },
    { ...identity, editorId: "editor-b" },
    { ...identity, requestId: "request-b" },
  ])("ignores callbacks outside the active actor/editor/attempt: %j", callback => {
    const session = saving();
    expect(confirmDraftSave(session, callback, result())).toBe(session);
    expect(markDraftSaveUnconfirmed(session, callback)).toBe(session);
  });

  it("ignores an old mount even when the same actor reopens the same definition", () => {
    const opened = openDraftSession({ ...scope, editorId: "editor-new" }, result().definition);
    const session = beginDraftSave(opened, "request-a");
    expect(confirmDraftSave(session, identity, result())).toBe(session);
  });

  it("does not apply duplicate confirmation to a later edit or its new attempt", () => {
    const confirmed = confirmDraftSave(saving(), identity, result());
    const edited = changeDraft(confirmed, { ...confirmed.value, name: { es: "Later edit" } });
    expect(confirmDraftSave(edited, identity, result())).toBe(edited);
    const next = beginDraftSave(edited, "request-b");
    expect(confirmDraftSave(next, identity, result())).toBe(next);
    expect(next.pending?.body.expectedRevision).toBe(1);
    expect(next.pending?.definitionId).toBe("definition-a");
    expect(next.pending?.body.name.es).toBe("Later edit");
  });

  it("recovers the original revision/map after another save and blocks overwrite pending review", () => {
    const unconfirmed = markDraftSaveUnconfirmed(saving(), identity);
    const session = confirmDraftSave(unconfirmed, identity, result(), 3);
    expect(session.phase).toBe("ReviewRequired");
    expect(session.confirmed?.revision).toBe(1);
    expect(session.currentRevision).toBe(3);
    expect(session.value.draft.fields[0].fieldId).toBe("field-a");
    expect(beginDraftSave(session, "request-b")).toBe(session);
  });

  it.each(["missing", "duplicate-parent", "wrong-parent", "changed-existing", "wrong-request", "wrong-revision"])("preserves uncertainty for an inconsistent canonical result: %s", defect => {
    const started = saving();
    let response = result();
    if (defect === "missing") response = { ...response, identityMap: { ...response.identityMap, choices: [] } };
    if (defect === "duplicate-parent") response = { ...response, identityMap: { ...response.identityMap, choices: [response.identityMap.choices[0], response.identityMap.choices[0]] } };
    if (defect === "wrong-parent") response = { ...response, identityMap: { ...response.identityMap, choices: response.identityMap.choices.map(choice => ({ ...choice, fieldId: "field-a" })) } };
    if (defect === "changed-existing") response = { ...response, identityMap: { ...response.identityMap, fields: response.identityMap.fields.map(field => ({ ...field, replacesFieldId: "unrelated" })) } };
    if (defect === "wrong-request") response = { ...response, requestId: "other" };
    if (defect === "wrong-revision") response = { ...response, definition: { ...response.definition, revision: 2 } };
    const session = confirmDraftSave(started, identity, response);
    expect(session.phase).toBe("Unconfirmed");
    expect(session.pending).toBe(started.pending);
    expect(session.value).toBe(started.value);
    expect(session.confirmed).toBeNull();
  });

  it("opens existing identities as local handles and excludes keys from the frozen write", () => {
    const session = beginDraftSave(openDraftSession(scope, result().definition), "request-next");
    const field = session.pending?.body.draft.fields[0];
    expect(field?.localId).toBe("field-a");
    expect(field?.fieldId).toBe("field-a");
    expect(field).not.toHaveProperty("key");
    expect(field?.type === "choice" && field.options[0].localId).toBe("choice-a");
    expect(session.pending?.body.expectedRevision).toBe(1);
  });

  it("confirms a type replacement as a new identity and removes replacement intent for the next save", () => {
    const definition: FormDefinitionSnapshot = { ...result().definition, draft: { ...initial.draft, fields: [
      { fieldId: "field-a", key: "field_1", type: "shortText", label: { es: "Referencia" }, help: null, required: false, maxLength: 80 },
    ] } };
    const opened = openDraftSession(scope, definition);
    const local = { ...opened.value, draft: { ...opened.value.draft, fields: [
      { localId: "field-a", fieldId: null, replacesFieldId: "field-a", type: "longText" as const, label: { es: "Referencia" }, help: null, required: false, maxLength: 600 },
    ] } };
    const session = beginDraftSave(changeDraft(opened, local), "request-a");
    const canonical = { ...result(), definition: { ...definition, revision: 2, draft: { ...definition.draft, fields: [
      { fieldId: "field-new", key: "field_2", type: "longText" as const, label: { es: "Referencia" }, help: null, required: false, maxLength: 600 },
    ] } }, identityMap: { fields: [{ localId: "field-a", fieldId: "field-new", key: "field_2", replacesFieldId: "field-a" }], choices: [] } };
    const confirmed = confirmDraftSave(session, identity, canonical);
    expect(confirmed.phase).toBe("Editing");
    expect(confirmed.value.draft.fields[0]).toMatchObject({ localId: "field-a", fieldId: "field-new", replacesFieldId: null, maxLength: 600 });
    const next = beginDraftSave(confirmed, "request-b");
    expect(next.pending?.body.draft.fields[0].fieldId).toBe("field-new");
    expect(next.pending?.body.draft.fields[0].replacesFieldId).toBeNull();
  });

  it("discards only local changes without reloading or replacing the confirmed baseline", () => {
    const opened = openDraftSession(scope, result().definition);
    const edited = changeDraft(opened, { ...opened.value, name: { es: "Unsaved" } });
    const discarded = discardDraft(edited);
    expect(discarded.value).toEqual(opened.baseline);
    expect(discarded.confirmed).toBe(opened.confirmed);
    expect(discarded.pending).toBeNull();
  });

  it("releases a definitively rejected validation attempt while preserving local changes and baseline", () => {
    const original = startDraftSession(scope, initial);
    const local = changeDraft(original, { ...initial, name: { es: "Invalid local name" } });
    const session = rejectDraftSave(beginDraftSave(local, "request-a"), identity, "Validation");
    expect(session.phase).toBe("Editing");
    expect(session.pending).toBeNull();
    expect(session.value.name.es).toBe("Invalid local name");
    expect(session.baseline.name.es).toBe("Pedido");
    expect(beginDraftSave(session, "request-b").pending?.body.requestId).toBe("request-b");
  });

  it.each(["RevisionConflict", "IdentityRetired", "PrefixLocked"] as const)("requires review after a definitive %s without discarding local intent", reason => {
    const started = saving();
    const session = rejectDraftSave(started, identity, reason);
    expect(session.phase).toBe("ReviewRequired");
    expect(session.pending).toBeNull();
    expect(session.value).toBe(started.value);
    expect(beginDraftSave(session, "request-b")).toBe(session);
  });

  it("retains the original attempt on request conflict instead of generating a new UUID", () => {
    const started = saving();
    const session = rejectDraftSave(started, identity, "RequestConflict");
    expect(session.phase).toBe("Unconfirmed");
    expect(session.pending).toBe(started.pending);
    expect(beginDraftSave(session, "request-b")).toBe(session);
    expect(rejectDraftSave(started, { ...identity, editorId: "old-editor" }, "Validation")).toBe(started);
  });
});
