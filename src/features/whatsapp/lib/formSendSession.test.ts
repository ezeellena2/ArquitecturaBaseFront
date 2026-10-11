import { describe, expect, it } from "vitest";
import { freezeFormMessage, recipientChanged, selectedVersionChanged } from "./formSendSession";
const option = { definitionId: "a", versionId: "v1", versionNumber: 1, prefix: "VIS", name: { en: "Visit" }, questionCount: 2, submitLabel: { en: "Confirm" } };
const draft = { message: " Original text ", selection: option, recipientCulture: "es" as const, recipientContextRevision: "opaque-1", modeRevision: 7 };
describe("Form send intent", () => {
  it("freezes the complete intent and retains the operator text and opaque recipient revision", () => {
    const body = freezeFormMessage(draft, "request");
    expect(body).toEqual({ requestId: "request", definitionId: "a", versionId: "v1", expectedModeRevision: 7, expectedRecipientContextRevision: "opaque-1", message: " Original text " });
    expect(Object.isFrozen(body)).toBe(true);
  });
  it("detects a changed recipient or culture without rewriting the message or selection", () => {
    expect(recipientChanged(draft, "opaque-2", "es")).toBe(true);
    expect(recipientChanged(draft, "opaque-1", "en")).toBe(true);
    expect(recipientChanged(draft, "opaque-1", "es")).toBe(false);
    expect(draft.message).toBe(" Original text ");
    expect(draft.selection).toBe(option);
  });
  it("preserves a selection outside the current page but rejects its replaced published version", () => {
    expect(selectedVersionChanged(option, [])).toBe(false);
    expect(selectedVersionChanged(option, [{...option,definitionId:'other',versionId:'other-version'}])).toBe(false);
    expect(selectedVersionChanged(option, [{...option,versionId:'v2',versionNumber:2}])).toBe(true);
  });
});
