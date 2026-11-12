import { afterEach, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { getThread } from "./chat";

// W3: what the person shares while a form is open. A shared contact brings the name and the phones of its first card, a resend of
// the form brings «Prellenado con» (with the privacy of «Por qué lo mandó») and the second response of a send says which response
// was kept. Every new field is absent when it does not apply: today's answers keep their shape. Synthetic bodies until the joint
// export brings the backend's.
afterEach(resetHttpClient);
const id = (n: number) => "019abcde-1000-7000-8000-" + String(n).padStart(12, "0");
const form = { definitionId: id(10), versionId: id(11), versionNumber: 1, name: { es: "Registrar entrega" }, culture: "es" };
const contact = { id: "chat-1", profileName: "Juan", phoneNumber: null, mode: "Manual", modeRevision: 2, lastInboundAtUtc: "2026-11-12T13:00:00Z", lastInboundSequence: 4, unreadCount: 1, preview: "Contacto" };
const shared = { audio: null, quickReplies: null, assistant: null, origin: "Conversation", id: id(1), direction: "Inbound", kind: "Contact", body: null, occurredAtUtc: "2026-11-12T13:00:00Z", inboundSequence: 3, operatorUserId: null, status: null, errorCode: null };
const resent = { audio: null, quickReplies: null, assistant: null, origin: "Conversation", id: id(2), direction: "Outbound", kind: "Flow", form, occurredAtUtc: "2026-11-12T13:00:05Z", inboundSequence: 0, operatorUserId: id(20), status: "Delivered", errorCode: null,
  body: "Puse el contacto en «Recibió» y «Teléfono de quien recibe». Revisá el formulario «Registrar entrega» y confirmalo." };
const rejected = { state: "Rejected", definitionId: id(10), versionId: id(11), versionNumber: 1, name: "Registrar entrega", recordId: null, number: null, values: null, rejectionCode: "Forms.Record.ReplayConflict" };
const reply = { audio: null, quickReplies: null, assistant: null, origin: "Conversation", id: id(5), direction: "Inbound", kind: "FlowReply", body: null, occurredAtUtc: "2026-11-12T13:05:00Z", inboundSequence: 4, operatorUserId: null, status: null, errorCode: null, purpose: "Business", formReply: rejected };
const outgoing = { quickReplies: null, assistant: null, origin: "Conversation", id: id(3), requestId: id(4), kind: "Flow", form, requestedAtUtc: "2026-11-12T13:01:00Z", operatorUserId: id(20), waMessageId: null, state: "Pending",
  body: "Puse tu ubicación en «Dirección de entrega». Revisá el formulario «Registrar entrega» y confirmalo." };
const thread = { assistantAvailability: { state: "available" }, assistantSuggestion: null, contact, messages: [shared, resent, reply], outgoing: [outgoing], beforeAtUtc: null, beforeId: null, canReadFormRecords: true };
const card = { name: "María Gómez", phones: ["+54 9 341 555-0101", "+54 341 444-0202"] };
const prefill = [{ label: "Recibió", value: "María Gómez" }, { label: "Teléfono de quien recibe", value: "+54 9 341 555-0101" }];
const place = [{ label: "Dirección de entrega", value: "Córdoba 1452, Rosario" }];
const readThread = async (body: Record<string, unknown>) => { server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json(body))); return getThread("chat-1"); };

it("reads today's thread without the new fields and invents none", async () => {
  const read = await readThread(thread);
  expect(read.messages[0]).not.toHaveProperty("contact");
  expect(read.messages[1]).not.toHaveProperty("prefill");
  expect(read.outgoing[0]).not.toHaveProperty("prefill");
  expect(read.messages[2].formReply).toEqual(rejected);
});
it("reads a shared contact with its name and its phones, also one without a phone or without a name", async () => {
  const read = await readThread({ ...thread, messages: [{ ...shared, contact: card }, { ...shared, id: id(6), contact: { name: "Recepción", phones: [] } },
    { ...shared, id: id(7), contact: { name: null, phones: ["+54 9 341 555-0303"] } }] });
  expect(read.messages.map(message => message.contact)).toEqual([card, { name: "Recepción", phones: [] }, { name: null, phones: ["+54 9 341 555-0303"] }]);
});
it("reads up to ten phones of a card", async () => {
  const phones = Array.from({ length: 10 }, (_, index) => "+54 9 341 555-01" + String(index).padStart(2, "0"));
  expect((await readThread({ ...thread, messages: [{ ...shared, contact: { name: "Central", phones } }] })).messages[0].contact).toEqual({ name: "Central", phones });
});
it("reads a contact whose content was cleared with the history, without a contact", async () => {
  expect((await readThread({ ...thread, messages: [shared] })).messages[0]).not.toHaveProperty("contact");
});
it("reads «Prellenado con» of a resend in a message and in an outgoing", async () => {
  const read = await readThread({ ...thread, messages: [shared, { ...resent, prefill }], outgoing: [{ ...outgoing, prefill: place }] });
  expect(read.messages[1].prefill).toEqual(prefill);
  expect(read.outgoing[0].prefill).toEqual(place);
});
// A8: the contact is a message of the chat, seen with whatsapp.read; «Prellenado con» carries values of the form, like «Por qué lo mandó».
it("keeps a shared contact and drops «Prellenado con» when the responses cannot be read", async () => {
  const read = await readThread({ ...thread, canReadFormRecords: false, messages: [{ ...shared, contact: card }, { ...resent, prefill }], outgoing: [{ ...outgoing, prefill: place }] });
  expect(read.messages[0].contact).toEqual(card);
  expect(read.messages[1]).not.toHaveProperty("prefill");
  expect(read.outgoing[0]).not.toHaveProperty("prefill");
  for (const item of prefill) expect(JSON.stringify(read.messages[1])).not.toContain(item.value);
  expect(JSON.stringify(read.outgoing[0])).not.toContain(place[0].value);
  expect(read.messages[1].body).toBe(resent.body);
});
// «Sin permiso, los valores se descartan antes de validar»: a reader who never sees «Prellenado con» does not depend on its shape.
it("validates «Prellenado con» only for a reader who may see it and drops it unread for the others", async () => {
  const body = { ...thread, messages: [shared, { ...resent, prefill: [{ value: "PRIVATE" }] }], outgoing: [{ ...outgoing, prefill: null }] };
  await expect(readThread(body)).rejects.toThrow("Unsupported chat response.");
  for (const canReadFormRecords of [false, undefined]) {
    const read = await readThread({ ...body, canReadFormRecords });
    expect(read.messages[1]).not.toHaveProperty("prefill");
    expect(read.outgoing[0]).not.toHaveProperty("prefill");
    expect(JSON.stringify(read)).not.toContain("PRIVATE");
  }
});
it("reads the number of the response that was kept in the second response of a send, also without permission to read responses", async () => {
  const kept = { ...rejected, savedNumber: "ENT-000124" };
  expect((await readThread({ ...thread, messages: [{ ...reply, formReply: kept }] })).messages[0].formReply).toEqual(kept);
  expect((await readThread({ ...thread, canReadFormRecords: false, messages: [{ ...reply, formReply: kept }] })).messages[0].formReply).toEqual(kept);
});
it.each([
  { ...shared, contact: null },
  { ...shared, contact: { ...card, phones: [5493415550101] } },
  { ...shared, contact: { ...card, phones: [...card.phones, ...Array.from({ length: 9 }, (_, index) => "+54 9 341 555-02" + index)] } },
  { ...shared, contact: { ...card, phones: [""] } },
  { ...shared, contact: { ...card, phones: undefined } },
  { ...shared, contact: { ...card, name: undefined } },
  { ...shared, contact: { ...card, name: "" } },
  { ...shared, contact: { ...card, vcard: "PRIVATE" } },
  { ...resent, prefill: null },
  { ...resent, prefill: [] },
  { ...resent, prefill: [{ value: "María Gómez" }] },
  { ...resent, prefill: [{ label: "", value: "María Gómez" }] },
  { ...resent, prefill: [{ label: "Recibió", value: 5 }] },
  { ...resent, prefill: [{ label: "Recibió", value: "" }] },
  { ...resent, prefill: [{ ...prefill[0], fieldId: "PRIVATE" }] },
  { ...resent, prefill: [...prefill, ...place, { label: "Otra", value: "Otro" }] },
])("rejects a message whose shared data do not keep their contract %#", async message => {
  await expect(readThread({ ...thread, messages: [message] })).rejects.toThrow("Unsupported chat response.");
});
it.each([null, [], [{ label: "Dirección de entrega" }], [{ ...place[0], value: ["Córdoba 1452"] }]])("rejects an outgoing whose «Prellenado con» does not keep its contract %#", async value => {
  await expect(readThread({ ...thread, outgoing: [{ ...outgoing, prefill: value }] })).rejects.toThrow("Unsupported chat response.");
});
// Like the rest of a form response, a malformed one is not shown: the chat says it is unavailable.
it.each([
  { ...rejected, savedNumber: 124 },
  { ...rejected, savedNumber: "124" },
  { ...rejected, savedNumber: null },
  { state: "Completed", definitionId: id(10), versionId: id(11), versionNumber: 1, name: "Registrar entrega", recordId: id(12), number: "ENT-000125", values: [], savedNumber: "ENT-000124" },
])("does not accept a kept number out of its contract %#", async formReply => {
  expect((await readThread({ ...thread, messages: [{ ...reply, formReply }] })).messages[0].formReply).toBeNull();
});
