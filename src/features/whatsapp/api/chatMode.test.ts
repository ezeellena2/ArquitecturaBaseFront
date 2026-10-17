import { afterEach, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { changeMode, getThread } from "./chat";

afterEach(resetHttpClient);
const response = { mode: "Manual", modeRevision: 3, assistantSendInProgress: false };
it.each([
  { ...response, mode: "Bot" }, { ...response, mode: "Assistant" }, { ...response, modeRevision: -1 },
  { ...response, modeRevision: 1.5 }, { ...response, modeRevision: 1 },
  { mode: "Manual", modeRevision: 3 }, { ...response, assistantSendInProgress: "yes" },
  { ...response, privateReason: "PRIVATE" },
])("rejects a mode reply outside its closed operation contract: %j", async body => {
  server.use(http.put("/api/whatsapp/chats/chat-1/mode", () => HttpResponse.json(body)));
  await expect(changeMode("chat-1", "Manual", 2)).rejects.toThrow("Unsupported chat response.");
});
it("rejects an empty legacy mode acknowledgement instead of inventing an observed result", async () => {
  server.use(http.put("/api/whatsapp/chats/chat-1/mode", () => new HttpResponse(null, { status: 204 })));
  await expect(changeMode("chat-1", "Manual", 2)).rejects.toThrow("Unsupported chat response.");
});
it("returns the observed mode revision and in-progress fact from the exact shared mode request", async () => {
  const received: unknown[] = [];
  server.use(http.put("/api/whatsapp/chats/chat-1/mode", async ({ request }) => { received.push(await request.json()); return HttpResponse.json({ ...response, assistantSendInProgress: true }); }));
  expect(await changeMode("chat-1", "Manual", 2)).toEqual({ ...response, assistantSendInProgress: true });
  expect(received).toEqual([{ mode: "Manual", expectedRevision: 2 }]);
});

const thread = { contact: { id: "chat-1", profileName: "Ana", phoneNumber: null, mode: "Manual", modeRevision: 2, lastInboundAtUtc: "2026-10-17T12:00:00Z", lastInboundSequence: 1, unreadCount: 1, preview: null }, messages: [], outgoing: [], beforeAtUtc: null, beforeId: null, canReadFormRecords: false };
it.each([undefined, null, { state: "Available" }, { state: "available", model: "PRIVATE" }])("rejects an absent or unsupported assistant availability projection: %j", async assistantAvailability => {
  server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json({ ...thread, assistantAvailability })));
  await expect(getThread("chat-1")).rejects.toThrow("Unsupported chat response.");
});
it.each(["available", "notInstalled", "notConfigured", "paused", "modelNotQualified"])("reads the safe assistant availability state %s from WhatsApp", async state => {
  server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json({ ...thread, assistantAvailability: { state } })));
  expect((await getThread("chat-1"))).toHaveProperty("assistantAvailability", { state });
});

it.each([undefined, "Unknown"])("rejects an unclassified message origin instead of falling back to Conversation: %s", async origin => {
  const message = { id: "message", direction: "Inbound", kind: "Text", body: "Hola", occurredAtUtc: "2026-10-17T12:00:00Z", inboundSequence: 1, operatorUserId: null, status: null, errorCode: null, origin };
  server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json({ ...thread, assistantAvailability: { state: "available" }, messages: [message] })));
  await expect(getThread("chat-1")).rejects.toThrow("Unsupported chat response.");
});
it.each([undefined, "Unknown"])("rejects an unclassified outgoing origin instead of offering manual recovery: %s", async origin => {
  const operation = { id: "operation", requestId: "request", body: "Hola", requestedAtUtc: "2026-10-17T12:00:00Z", operatorUserId: "actor", waMessageId: null, state: "Failed", kind: "Text", origin };
  server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json({ ...thread, assistantAvailability: { state: "available" }, outgoing: [operation] })));
  await expect(getThread("chat-1")).rejects.toThrow("Unsupported chat response.");
});

it("rejects a mode revision beyond this operation instead of publishing an unrelated state", async () => {
  server.use(http.put("/api/whatsapp/chats/chat-1/mode", () => HttpResponse.json({ ...response, modeRevision: 10 })));
  await expect(changeMode("chat-1", "Manual", 7)).rejects.toThrow("Unsupported chat response.");
});

it.each([7, Number.MAX_SAFE_INTEGER])("accepts the unchanged revision of a mode no-op without adding an unsafe next revision: %s", async expectedRevision => {
  server.use(http.put("/api/whatsapp/chats/chat-1/mode", () => HttpResponse.json({ ...response, modeRevision: expectedRevision })));
  expect(await changeMode("chat-1", "Manual", expectedRevision)).toEqual({ ...response, modeRevision: expectedRevision });
});
