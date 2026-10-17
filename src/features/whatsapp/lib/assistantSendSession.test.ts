import { expect, it } from "vitest";
import type { AssistantProposal } from "../api/assistant";
import { freezeAssistantSend } from "./assistantSendSession";
const proposal: AssistantProposal = { proposalId: "proposal", definitionId: "form", versionId: "version", versionNumber: 1, name: "Visita", culture: "es", reason: "Pidió una visita", fields: [{ fieldId: "first", label: "Cliente", displayValue: "Ana" }, { fieldId: "second", label: "Fecha", displayValue: "17/10/2026" }] };
it("freezes only offered selected IDs in proposal order without values or form authority", () => {
  const selected = ["second", "first", "second", "foreign"];
  const attempt = freezeAssistantSend(proposal, selected, "send-request");
  selected.length = 0;
  expect(attempt).toEqual({ requestId: "send-request", includedFieldIds: ["first", "second"] });
  expect(Object.isFrozen(attempt)).toBe(true);
  expect(Object.isFrozen(attempt.includedFieldIds)).toBe(true);
  expect(JSON.stringify(attempt)).not.toContain("Ana");
});
it("allows explicitly unticking all proposed fields without inventing empty canonical values", () => {
  expect(freezeAssistantSend(proposal, [], "send-request")).toEqual({ requestId: "send-request", includedFieldIds: [] });
});
