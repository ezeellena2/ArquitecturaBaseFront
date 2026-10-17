import { afterEach, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { getThread } from "./chat";
afterEach(resetHttpClient);
const message = { audio: null, quickReplies: null, id: "019abcde-1000-7000-8000-000000000001", direction: "Outbound", kind: "Text", body: "Hola", occurredAtUtc: "2026-10-17T12:00:00Z", inboundSequence: 0, operatorUserId: null, status: "Sent", errorCode: null, origin: "Assistant", assistant: null };
const outgoing = { quickReplies: null, id: "019abcde-1000-7000-8000-000000000002", requestId: "019abcde-1000-7000-8000-000000000003", body: "Hola", requestedAtUtc: "2026-10-17T12:00:00Z", operatorUserId: null, waMessageId: null, state: "Pending", kind: "Text", origin: "Assistant", assistant: null };
const thread = { assistantAvailability: { state: "available" }, assistantSuggestion: null, contact: { id: "chat-1", profileName: "Ana", phoneNumber: null, mode: "Manual", modeRevision: 2, lastInboundAtUtc: "2026-10-17T12:00:00Z", lastInboundSequence: 1, unreadCount: 1, preview: null }, messages: [message], outgoing: [outgoing], beforeAtUtc: null, beforeId: null, canReadFormRecords: false };
it.each([
  { ...thread, assistantSuggestion: undefined },
  { ...thread, messages: [{ ...message, assistant: undefined }] },
  { ...thread, outgoing: [{ ...outgoing, assistant: undefined }] },
  { ...thread, assistantSuggestion: { requestId: "019abcde-1000-7000-8000-000000000003", sourceMessageId: message.id, state: "Invented" } },
  { ...thread, messages: [{ ...message, assistant: { reason: "PRIVATE", proposedFields: [{ fieldId: message.id, label: "Cliente", displayValue: "Ana", canonicalValue: "PRIVATE" }] } }] },
])("requires the exact nullable assistant projection in every thread page %#", async body => {
  server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json(body)));
  await expect(getThread("chat-1")).rejects.toThrow("Unsupported chat response.");
});
it("reads an explicit null without inventing a proposal or a historical explanation", async () => {
  server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json(thread)));
  expect(await getThread("chat-1")).toMatchObject({ assistantSuggestion: null, messages: [{ assistant: null }], outgoing: [{ assistant: null }] });
});

it.each([
  { ...thread, messages: [{ ...message, quickReplies: undefined }] },
  { ...thread, outgoing: [{ ...outgoing, quickReplies: undefined }] },
  { ...thread, messages: [{ ...message, kind: "Interactive", quickReplies: [{ id: "PRIVATE_TOKEN", title: "Visita" }] }] },
  { ...thread, outgoing: [{ ...outgoing, kind: "QuickReplies", quickReplies: [] }] },
])("requires captured quick-reply titles without provider selection IDs %#", async body => {
  server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json(body)));
  await expect(getThread("chat-1")).rejects.toThrow("Unsupported chat response.");
});
it("reads captured clarification titles without creating operator actions", async () => {
  const body = { ...thread, messages: [{ ...message, kind: "Interactive", body: "¿Visita o entrega?", quickReplies: ["Visita", "Entrega"] }] };
  server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json(body)));
  expect((await getThread("chat-1")).messages[0]).toMatchObject({ quickReplies: ["Visita", "Entrega"], origin: "Assistant" });
});
