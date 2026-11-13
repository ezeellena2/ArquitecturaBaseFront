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
// Task 9 of the documents: «Por qué lo propuso» keeps the form and how many data were read with doubts; what was read is a value.
it("removes what the assistant read of a received document and keeps why it proposed or asked", () => {
 const read = { fieldId: "019abcde-1000-7000-8000-000000000101", label: "Monto", displayValue: "PRIVATE value" };
 const message = { ...thread.messages[0], id: "document", direction: "Inbound" as const, kind: "ReceivedDocument", body: "Te paso el pago", origin: "Conversation" as const, assistant: null };
 const documents = { ...thread, messages: [
  { ...message, document: { name: "comprobante.pdf", kind: "pdf" as const, pages: 1, why: { kind: "proposed" as const, forms: ["Pagos de clientes"] as [string], doubtful: 1, fields: [read] } } },
  { ...message, id: "question", document: { name: "captura.png", why: { kind: "asked" as const, forms: ["Pagos de clientes", "Gastos"], chosen: "Gastos" } } },
 ] } satisfies Thread;
 const scrubbed = withoutFormReplyValues(documents);
 expect(JSON.stringify(scrubbed)).not.toContain("PRIVATE");
 expect(scrubbed.messages.map(item => item.document)).toEqual([{ name: "comprobante.pdf", kind: "pdf", pages: 1, why: { kind: "proposed", forms: ["Pagos de clientes"], doubtful: 1 } },
  { name: "captura.png", why: { kind: "asked", forms: ["Pagos de clientes", "Gastos"], chosen: "Gastos" } }]);
 expect(scrubbed.messages[0].body).toBe("Te paso el pago");
 expect(documents.messages[0].document.why.fields).toEqual([read]);
});
// Task 9 of the documents: what the assistant sent for a file the person sent (`loadsFile`) may say in its body what it read; the rest stays.
it("removes the body of what the assistant sent for a file and keeps everything else", () => {
 const flow = { ...thread.messages[0], id: "flow", body: "PRIVATE read", assistant: null, loadsFile: true as const };
 const sent = { ...thread.outgoing[0], id: "sent", origin: "Assistant" as const, operatorUserId: null, kind: "Flow" as const, body: "PRIVATE queued", assistant: null, loadsFile: true as const };
 const scrubbed = withoutFormReplyValues({ ...thread, messages: [flow, thread.messages[0]], outgoing: [sent] });
 expect(JSON.stringify(scrubbed)).not.toContain("PRIVATE");
 expect(scrubbed.messages[0]).toEqual({ ...flow, body: null });
 expect(scrubbed.outgoing[0]).toEqual({ ...sent, body: null });
 expect(scrubbed.messages[1].body).toBe("Mensaje autorizado");
});
