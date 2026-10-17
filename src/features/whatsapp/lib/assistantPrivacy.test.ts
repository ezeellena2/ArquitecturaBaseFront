import { expect, it } from "vitest";
import type { Thread } from "../api/chat";
import { withoutFormReplyValues } from "./threadPrivacy";
const explanation = { reason: "PRIVATE reason", proposedFields: [{ fieldId: "field", label: "Cliente", displayValue: "PRIVATE value" }] };
const thread = { assistantAvailability: { state: "available" }, assistantSuggestion: null, contact: { id: "chat", profileName: "Ana", phoneNumber: null, mode: "Manual", modeRevision: 1, lastInboundAtUtc: "2026-10-17T12:00:00Z", lastInboundSequence: 1, unreadCount: 0, preview: null }, messages: [{ audio: null, quickReplies: null, id: "message", direction: "Outbound", kind: "Flow", body: "Mensaje autorizado", occurredAtUtc: "2026-10-17T12:00:00Z", inboundSequence: 0, operatorUserId: null, status: "Sent", errorCode: null, origin: "Assistant", assistant: explanation }], outgoing: [{ quickReplies: null, id: "outgoing", requestId: "request", operatorUserId: "operator", body: "Manual autorizado", requestedAtUtc: "2026-10-17T12:00:00Z", state: "Pending", waMessageId: null, origin: "Conversation", assistant: explanation }], beforeAtUtc: null, beforeId: null } satisfies Thread;
it("removes captured assistant values from confirmed and pending history while preserving authors and ordinary chat", () => {
 const scrubbed = withoutFormReplyValues(thread);
 expect(JSON.stringify(scrubbed)).not.toContain("PRIVATE");
 expect(scrubbed.messages[0]).toMatchObject({ origin: "Assistant", body: "Mensaje autorizado", assistant: null });
 expect(scrubbed.outgoing[0]).toMatchObject({ origin: "Conversation", body: "Manual autorizado", operatorUserId: "operator", assistant: null });
 expect(thread.messages[0].assistant).toEqual(explanation);
});
