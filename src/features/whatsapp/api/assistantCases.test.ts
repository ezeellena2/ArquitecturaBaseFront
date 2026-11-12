import { afterEach, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { getThread, listChats } from "./chat";
import { parseAssistantSuggestion } from "./assistant";

// Casos del asistente (AS4): «Necesita una persona», «Por qué respondió esto», the lines of what the assistant decided without a
// message and the text for the composer. Every new field is absent when it does not apply: today's answers keep their shape.
afterEach(resetHttpClient);
const contact = { id: "chat-1", profileName: "Ana", phoneNumber: null, mode: "Manual", modeRevision: 2, lastInboundAtUtc: "2026-11-11T13:00:00Z", lastInboundSequence: 1, unreadCount: 1, preview: "Hola" };
const message = { audio: null, quickReplies: null, id: "019abcde-1000-7000-8000-000000000001", direction: "Outbound", kind: "Text", body: "Sí: enviamos al interior.", occurredAtUtc: "2026-11-11T13:01:00Z", inboundSequence: 0, operatorUserId: null, status: "Read", errorCode: null, origin: "Assistant", assistant: null };
const outgoing = { quickReplies: null, id: "019abcde-1000-7000-8000-000000000002", requestId: "019abcde-1000-7000-8000-000000000003", body: "Te paso con una persona.", requestedAtUtc: "2026-11-11T13:02:00Z", operatorUserId: null, waMessageId: null, state: "Pending", kind: "Text", origin: "Assistant", assistant: null };
const thread = { assistantAvailability: { state: "available" }, assistantSuggestion: null, contact, messages: [message], outgoing: [outgoing], beforeAtUtc: null, beforeId: null, canReadFormRecords: true };
const reply = { kind: "DraftedReply", caseSource: "Fallback", caseTitle: null, reason: "Pregunta por envíos.", used: ["La pregunta frecuente «¿Hacen envíos?»"], ordinal: 1, count: 1, handoffReasonCode: null, handoffReason: null, button: null };
const handoff = { ...reply, kind: "Handoff", caseSource: "Own", caseTitle: "Pide hablar con una persona.", reason: "", used: [], handoffReasonCode: "case", handoffReason: "Pide hablar con una persona." };
const needsPerson = { reasonCode: "case", reason: "Pide hablar con una persona.", atUtc: "2026-11-11T13:02:00Z" };
const event = { id: "019abcde-1000-7000-8000-000000000004", atUtc: "2026-11-11T13:03:00Z", reply: { ...reply, kind: "NoReply", caseSource: "Own", caseTitle: "Manda cadenas.", used: [] } };
const readThread = async (body: Record<string, unknown>) => { server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json(body))); return getThread("chat-1"); };

it("reads today's thread without the new fields and invents none", async () => {
  const read = await readThread(thread);
  expect(read.contact.needsPerson).toBeUndefined();
  expect(read.assistantEvents).toBeUndefined();
  expect(read.messages[0].assistantReply).toBeUndefined();
  expect(read.outgoing[0].assistantReply).toBeUndefined();
});
it("reads the mark, the why of a message and of an outgoing, and the lines of the thread as the server sends them", async () => {
  const read = await readThread({ ...thread, contact: { ...contact, needsPerson }, messages: [{ ...message, assistantReply: reply }], outgoing: [{ ...outgoing, assistantReply: handoff }], assistantEvents: [event] });
  expect(read.contact.needsPerson).toEqual(needsPerson);
  expect(read.messages[0].assistantReply).toEqual(reply);
  expect(read.outgoing[0].assistantReply).toEqual(handoff);
  expect(read.assistantEvents).toEqual([event]);
});
it("keeps the why of a reply when the values of form responses cannot be read: it carries none", async () => {
  const read = await readThread({ ...thread, canReadFormRecords: false, messages: [{ ...message, assistantReply: reply }], assistantEvents: [event] });
  expect(read.messages[0].assistantReply).toEqual(reply);
  expect(read.assistantEvents).toEqual([event]);
});
it.each([
  { ...thread, contact: { ...contact, needsPerson: null } },
  { ...thread, contact: { ...contact, needsPerson: { ...needsPerson, atUtc: "yesterday" } } },
  { ...thread, contact: { ...contact, needsPerson: { ...needsPerson, reasonCode: "" } } },
  { ...thread, contact: { ...contact, needsPerson: { ...needsPerson, since: "PRIVATE" } } },
  { ...thread, messages: [{ ...message, assistantReply: null }] },
  { ...thread, messages: [{ ...message, assistantReply: { ...reply, kind: "Invented" } }] },
  { ...thread, messages: [{ ...message, assistantReply: { ...reply, caseSource: "Model" } }] },
  { ...thread, messages: [{ ...message, assistantReply: { ...reply, ordinal: 4, count: 3 } }] },
  { ...thread, messages: [{ ...message, assistantReply: { ...reply, button: undefined } }] },
  { ...thread, outgoing: [{ ...outgoing, assistantReply: { ...handoff, prompt: "PRIVATE" } }] },
  { ...thread, assistantEvents: null },
  { ...thread, assistantEvents: [] },
  { ...thread, assistantEvents: [{ ...event, id: "line-1" }] },
  { ...thread, assistantEvents: [{ ...event, reply: { ...event.reply, used: [1] } }] },
])("rejects a thread whose new data do not keep their contract %#", async body => {
  await expect(readThread(body)).rejects.toThrow("Unsupported chat response.");
});

const inbox = (items: unknown[], counts: Record<string, unknown> = {}) => ({ page: { items, totalCount: items.length, page: 1, pageSize: 20, totalPages: 1 }, allCount: items.length, unreadCount: 0, ...counts });
it("reads the mark of each conversation and how many need a person, and takes a missing count as 0", async () => {
  server.use(http.get("/api/whatsapp/chats", () => HttpResponse.json(inbox([{ ...contact, needsPerson }, { ...contact, id: "chat-2" }], { needsPersonCount: 1 }))));
  const read = await listChats(1, "", "all");
  expect(read.needsPersonCount).toBe(1);
  expect(read.page.items.map(item => item.needsPerson)).toEqual([needsPerson, undefined]);
  server.use(http.get("/api/whatsapp/chats", () => HttpResponse.json(inbox([contact]))));
  expect((await listChats(1, "", "all")).needsPersonCount).toBe(0);
});
it.each([
  inbox([{ ...contact, needsPerson: { ...needsPerson, reason: 3 } }], { needsPersonCount: 1 }),
  inbox([contact], { needsPersonCount: -1 }),
  inbox([contact], { needsPersonCount: "1" }),
])("rejects an inbox whose mark or count does not keep its contract %#", async body => {
  server.use(http.get("/api/whatsapp/chats", () => HttpResponse.json(body)));
  await expect(listChats(1, "", "all")).rejects.toThrow("Unsupported chat response.");
});
it("asks only for the conversations that need a person with its filter, and keeps the other filters' query", async () => {
  const queries: URLSearchParams[] = [];
  server.use(http.get("/api/whatsapp/chats", ({ request }) => { queries.push(new URL(request.url).searchParams); return HttpResponse.json(inbox([])); }));
  await listChats(2, "ana", "needsPerson");
  await listChats(1, "", "unread");
  await listChats(1, "", "all");
  expect(queries.map(query => [query.get("page"), query.get("search"), query.get("unreadOnly"), query.get("needsPerson")])).toEqual([
    ["2", "ana", "false", "true"], ["1", "", "true", null], ["1", "", "false", null],
  ]);
});

const contactId = "019abcde-1000-7000-8000-000000000010";
const requestId = "019abcde-1000-7000-8000-000000000011";
const sourceMessageId = "019abcde-1000-7000-8000-000000000012";
const textProposal = { text: "Sí: al interior enviamos por transporte.", caseSource: "Fallback", caseTitle: null, used: ["La zona de entrega"] };
const proposal = { proposalId: null, definitionId: "019abcde-1000-7000-8000-000000000013", versionId: "019abcde-1000-7000-8000-000000000014", versionNumber: 1, name: "Visita", culture: "es", reason: "Pidió una visita", fields: [] };
it("reads a ready text for the composer, with its case and what it used, instead of a form", () => {
  const ready = { requestId, sourceMessageId, state: "Ready", proposal: null, outgoing: null, textProposal };
  expect(parseAssistantSuggestion(ready, contactId)).toEqual(ready);
});
it.each([
  { requestId, sourceMessageId, state: "Ready", proposal, outgoing: null, textProposal },
  { requestId, sourceMessageId, state: "Ready", proposal: null, outgoing: null },
  { requestId, sourceMessageId, state: "Pending", proposal: null, outgoing: null, textProposal },
  { requestId, sourceMessageId, state: "Discarded", proposal: null, outgoing: null, textProposal },
  { requestId, sourceMessageId, state: "Ready", proposal: null, outgoing: null, textProposal: null },
  { requestId, sourceMessageId, state: "Ready", proposal: null, outgoing: null, textProposal: { ...textProposal, text: "  " } },
  { requestId, sourceMessageId, state: "Ready", proposal: null, outgoing: null, textProposal: { ...textProposal, text: "a".repeat(4097) } },
  { requestId, sourceMessageId, state: "Ready", proposal: null, outgoing: null, textProposal: { ...textProposal, caseSource: "Model" } },
  { requestId, sourceMessageId, state: "Ready", proposal: null, outgoing: null, textProposal: { ...textProposal, prompt: "PRIVATE" } },
])("rejects a text suggestion that does not keep its contract %#", value => {
  let error: unknown; try { parseAssistantSuggestion(value, contactId); } catch (caught) { error = caught; }
  expect(String(error)).toBe("Error: Unsupported assistant response.");
  expect(JSON.stringify(error)).not.toContain("PRIVATE");
});
