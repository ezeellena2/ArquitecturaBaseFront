import { afterEach, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { getThread } from "./chat";

// Task 8 of the documents: a photo, a PDF or a Word the person sends by WhatsApp is a message of its own, `ReceivedDocument`, with
// its name, its kind and its pages while its descriptor lives, and why it was not read (DOC4); its caption is the body. A photo
// WhatsApp sends as an image has no file name, and then it has no name. Today's answers keep their shape. Synthetic bodies until
// the joint export brings the backend's.
afterEach(resetHttpClient);
const id = (n: number) => "019abcde-1000-7000-8000-" + String(n).padStart(12, "0");
const contact = { id: "chat-1", profileName: "Carlos Díaz", phoneNumber: "+5493515557788", mode: "Manual", modeRevision: 1, lastInboundAtUtc: "2026-11-12T13:00:00Z", lastInboundSequence: 1, unreadCount: 1, preview: "Documento" };
const received = { audio: null, quickReplies: null, assistant: null, origin: "Conversation", id: id(1), direction: "Inbound", kind: "ReceivedDocument", body: "Te paso el pago de La Posta",
  occurredAtUtc: "2026-11-12T13:00:00Z", inboundSequence: 1, operatorUserId: null, status: null, errorCode: null };
const thread = { assistantAvailability: { state: "available" }, assistantSuggestion: null, contact, messages: [received], outgoing: [], beforeAtUtc: null, beforeId: null, canReadFormRecords: false };
const readThread = async (body: Record<string, unknown>) => { server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json(body))); return getThread("chat-1"); };

it("reads a received document with its name, its kind and its pages, and its caption as the body", async () => {
  const document = { name: "comprobante-la-posta.pdf", kind: "pdf", pages: 2 };
  const read = await readThread({ ...thread, messages: [{ ...received, document }] });
  expect(read.messages[0]).toMatchObject({ kind: "ReceivedDocument", body: "Te paso el pago de La Posta", audio: null, document });
  expect(read.messages[0]).not.toHaveProperty("spreadsheetName");
});
it.each([
  { name: "comprobante.jpg", kind: "jpeg", pages: 1 },
  { name: "captura.png", kind: "png", pages: 1 },
  { name: "aviso-de-pago.docx", kind: "docx" },
  { name: "document.pdf", kind: "pdf" },
  { name: "archivo" },
  { name: "comprobante.jpg", kind: "jpeg", pages: 1, reasonCode: "notLinked" },
  { kind: "jpeg", pages: 1 },
  { kind: "png", pages: 1, reasonCode: "notLinked" },
])("reads each shape of a received document %#", async document => {
  expect((await readThread({ ...thread, messages: [{ ...received, document }] })).messages[0].document).toEqual(document);
});
it("reads a received document whose content was cleared, and today's messages, without a document", async () => {
  const read = await readThread({ ...thread, messages: [{ ...received, body: null }, { ...received, id: id(2), kind: "Text", body: "Hola" }] });
  expect(read.messages[0]).not.toHaveProperty("document");
  expect(read.messages[1]).not.toHaveProperty("document");
});
it.each([
  null,
  "comprobante.pdf",
  {},
  { kind: "pdf", pages: 2 },
  { kind: "docx" },
  { name: null, kind: "jpeg", pages: 1 },
  { name: "" },
  { name: 5 },
  { name: "comprobante.pdf", kind: "xlsx" },
  { name: "comprobante.pdf", kind: "PDF" },
  { name: "comprobante.pdf", kind: null },
  { name: "comprobante.pdf", kind: "pdf", pages: 0 },
  { name: "comprobante.pdf", kind: "pdf", pages: 1.5 },
  { name: "comprobante.pdf", kind: "pdf", pages: "2" },
  { name: "comprobante.pdf", kind: "pdf", pages: null },
  { name: "comprobante.jpg", reasonCode: "notReadable" },
  { name: "comprobante.jpg", reasonCode: null },
  { name: "comprobante.pdf", size: 90_112 },
])("rejects a received document out of its contract %#", async document => {
  await expect(readThread({ ...thread, messages: [{ ...received, document }] })).rejects.toThrow("Unsupported chat response.");
});

// Task 9 of the documents: «Por qué lo propuso» or «Por qué preguntó» under the document, absent when the assistant did nothing with it.
// `proposed` names the form it sent prefilled, how many data it read with doubts and what it read, the two while the sealed content
// lives; `asked`, the forms it offered (without «Otro») and the option the person tapped. What it read is a value of a response
// (formrecords.read): like «Prellenado con», it is validated only for whoever may see it and dropped unread for the others.
const named = { name: "comprobante.pdf", kind: "pdf", pages: 1 };
const readFields = [{ fieldId: id(101), label: "Monto", displayValue: "$ 150.000" }, { fieldId: id(102), label: "Banco o billetera de origen", displayValue: "Banco Galicia" }];
const proposed = { kind: "proposed", forms: ["Pagos de clientes"], doubtful: 1, fields: readFields };
const asked = { kind: "asked", forms: ["Pagos de clientes", "Pagos a proveedores"], chosen: "Pagos a proveedores" };
// The titles of a list are up to 24 characters, the most WhatsApp shows.
const listTitle = (n: number) => "Formulario número " + String(n).padStart(6, "0");
const withWhy = (why: unknown, extra: Record<string, unknown> = {}) => ({ ...received, ...extra, document: { ...named, why } });
const allowed = { ...thread, canReadFormRecords: true };

it("reads why the assistant proposed a form and why it asked which one", async () => {
  const read = await readThread({ ...allowed, messages: [withWhy(proposed), withWhy(asked, { id: id(2), inboundSequence: 2 })] });
  expect(read.messages.map(message => message.document)).toEqual([{ ...named, why: proposed }, { ...named, why: asked }]);
});
it.each([
  // Without formrecords.read the server sends no values; once the sealed content expired, neither the doubts.
  { kind: "proposed", forms: ["Pagos de clientes"], doubtful: 0 },
  { kind: "proposed", forms: ["Pagos de clientes"] },
  { kind: "proposed", forms: ["Formulario de cobranzas de la sucursal del interior de la provincia"], doubtful: 0, fields: [] },
  // Not tapped yet, «Otro» (not offered as a form), the nine forms of a list and a form by its whole name, longer than a row.
  { kind: "asked", forms: ["Pagos de clientes", "Pagos a proveedores"] },
  { kind: "asked", forms: ["Pagos de clientes", "Pagos a proveedores"], chosen: "Otro" },
  { kind: "asked", forms: [1, 2, 3, 4, 5, 6, 7, 8, 9].map(listTitle), chosen: listTitle(9) },
  { kind: "asked", forms: ["Pagos de clientes"] },
  { kind: "asked", forms: ["Cobranzas de la sucursal del interior", "Pagos de clientes"], chosen: "Cobranzas de la sucursal del interior" },
])("reads each shape of the why %#", async why => {
  expect((await readThread({ ...allowed, messages: [withWhy(why)] })).messages[0].document).toEqual({ ...named, why });
});
it("keeps why it proposed a form and drops what it read when the responses cannot be read", async () => {
  for (const canReadFormRecords of [false, undefined]) {
    const read = await readThread({ ...thread, canReadFormRecords, messages: [withWhy(proposed), withWhy(asked, { id: id(2), inboundSequence: 2 })] });
    expect(read.messages.map(message => message.document)).toEqual([{ ...named, why: { kind: "proposed", forms: ["Pagos de clientes"], doubtful: 1 } }, { ...named, why: asked }]);
    expect(JSON.stringify(read)).not.toContain("Banco Galicia");
  }
});
it("validates what it read only for a reader who may see it and drops it unread for the others", async () => {
  const body = { ...allowed, messages: [withWhy({ ...proposed, fields: [{ value: "PRIVATE" }] })] };
  await expect(readThread(body)).rejects.toThrow("Unsupported chat response.");
  for (const canReadFormRecords of [false, undefined]) {
    const read = await readThread({ ...body, canReadFormRecords });
    expect(read.messages[0].document).toEqual({ ...named, why: { kind: "proposed", forms: ["Pagos de clientes"], doubtful: 1 } });
    expect(JSON.stringify(read)).not.toContain("PRIVATE");
  }
});
// None of these is wrong by what it read, so each one is rejected also for whoever cannot read the responses.
const whyOutOfContract = [
  null,
  {},
  "proposed",
  { kind: "offered", forms: ["Pagos de clientes"] },
  { kind: "proposed", forms: [] },
  { kind: "proposed", forms: ["Pagos de clientes", "Gastos"] },
  { kind: "proposed", forms: [""] },
  { kind: "proposed", forms: "Pagos de clientes" },
  { kind: "proposed", forms: ["Pagos de clientes"], doubtful: -1 },
  { kind: "proposed", forms: ["Pagos de clientes"], doubtful: 1.5 },
  { kind: "proposed", forms: ["Pagos de clientes"], doubtful: "1" },
  { kind: "proposed", forms: ["Pagos de clientes"], doubtful: null },
  { ...proposed, chosen: "Pagos de clientes" },
  { kind: "asked", forms: [] },
  { kind: "asked", forms: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(listTitle) },
  { kind: "asked", forms: [""] },
  { kind: "asked", forms: ["Pagos de clientes", 5] },
  { ...asked, chosen: "" },
  { ...asked, chosen: null },
  { ...asked, doubtful: 1 },
  { ...asked, reason: "PRIVATE" },
];
it.each([
  ...whyOutOfContract,
  // What it read comes from the sealed content, with its doubts, and only in a proposal; it is checked only for a reader of the responses.
  { kind: "proposed", forms: ["Pagos de clientes"], fields: readFields },
  { ...proposed, fields: null },
  { ...proposed, fields: [readFields[0], readFields[0]] },
  { ...proposed, fields: [{ ...readFields[0], fieldId: "monto" }] },
  { ...proposed, fields: [{ ...readFields[0], canonicalValue: "150000" }] },
  { ...asked, fields: readFields },
])("rejects a why out of its contract %#", async why => {
  await expect(readThread({ ...allowed, messages: [withWhy(why)] })).rejects.toThrow("Unsupported chat response.");
});
it.each(whyOutOfContract)("rejects a why out of its contract also when the responses cannot be read %#", async why => {
  await expect(readThread({ ...thread, messages: [withWhy(why)] })).rejects.toThrow("Unsupported chat response.");
});

// Task 9 of the documents: the question about a document the assistant did not recognize goes as a WhatsApp list, and a doubt too when a
// name does not fit a button or two names are the same. Only the assistant sends one, with the label of the button that opens it
// (`listButton`, up to 20 characters) in its message and in its outgoing (a `QuickReplies` one); then its options are the rows of the list,
// 1 to 10 titles of up to 24 (repeated ones numbered « (n)»). Without that label they are buttons, 1 to 3 titles of up to 20, whatever the origin.
const question = { audio: null, assistant: null, origin: "Assistant", id: id(3), direction: "Outbound", kind: "Interactive", body: "No reconocí este documento. ¿Qué querés cargar con él?",
  occurredAtUtc: "2026-11-12T13:00:10Z", inboundSequence: 0, operatorUserId: null, status: "Delivered", errorCode: null };
const queued = { assistant: null, origin: "Assistant", id: id(4), requestId: id(5), kind: "QuickReplies", body: question.body, requestedAtUtc: "2026-11-12T13:00:10Z",
  operatorUserId: null, waMessageId: null, state: "Pending" };
const rows = [...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(listTitle), "Otro"];
const list = { listButton: "Elegir formulario", quickReplies: rows };
it("reads the rows of a list of the assistant with the label of its button, in its message and in its outgoing", async () => {
  const read = await readThread({ ...thread, messages: [{ ...question, ...list }], outgoing: [{ ...queued, ...list, listButton: "Choose form" }] });
  expect(read.messages[0]).toMatchObject(list);
  expect(read.outgoing[0]).toMatchObject({ ...list, listButton: "Choose form" });
});
it.each([
  // Forms whose names repeat, numbered; a name that does not fit a button; a single row; the longest label.
  { listButton: "Elegir formulario", quickReplies: ["Pagos de clientes (1)", "Pagos de clientes (2)", "Otro"] },
  { listButton: "Elegir formulario", quickReplies: ["Cobranzas del interior", "Pagos de clientes", "Otro"] },
  { listButton: "Elegir formulario", quickReplies: ["Cobranzas del interior"] },
  { listButton: "B".repeat(20), quickReplies: [listTitle(1), "Otro"] },
])("reads each shape of a list of the assistant %#", async options => {
  expect((await readThread({ ...thread, messages: [{ ...question, ...options }] })).messages[0]).toMatchObject(options);
});
it.each([
  ["the rows of a list without the label of its button", { ...question, quickReplies: rows }],
  ["a title longer than a button without the label of a list", { ...question, quickReplies: ["Cobranzas del interior", "Otro"] }],
  ["four buttons of the assistant", { ...question, quickReplies: ["Uno", "Dos", "Tres", "Cuatro"] }],
  ["eleven rows", { ...question, ...list, quickReplies: [...rows, "Gastos"] }],
  ["a list without rows", { ...question, ...list, quickReplies: [] }],
  ["the label of a list without options", { ...question, ...list, quickReplies: null }],
  ["a row of 25 characters", { ...question, ...list, quickReplies: [listTitle(1) + "0", "Otro"] }],
  ["an empty row", { ...question, ...list, quickReplies: ["Pagos de clientes", ""] }],
  ["an empty label", { ...question, ...list, listButton: "" }],
  ["a label of 21 characters", { ...question, ...list, listButton: "B".repeat(21) }],
  ["a null label", { ...question, ...list, listButton: null }],
  ["the label of a list on the buttons of a person", { ...question, origin: "Conversation", operatorUserId: id(20), listButton: "Elegir formulario", quickReplies: ["Uno", "Dos"] }],
  ["the label of a list on a notice", { ...question, origin: "FormAction", listButton: "Elegir formulario", quickReplies: ["Uno", "Dos"] }],
  ["four buttons of a person", { ...question, origin: "Conversation", operatorUserId: id(20), quickReplies: ["Uno", "Dos", "Tres", "Cuatro"] }],
  ["a button of a notice longer than 20 characters", { ...question, origin: "FormAction", quickReplies: ["Cobranzas del interior", "Otro"] }],
])("rejects options out of their limits: %s", async (_case, message) => {
  await expect(readThread({ ...thread, messages: [message] })).rejects.toThrow("Unsupported chat response.");
});
it.each([
  ["the rows of a list without the label of its button", { ...queued, quickReplies: rows }],
  ["the label of a list on an outgoing of a person", { ...queued, origin: "Conversation", operatorUserId: id(20), listButton: "Elegir formulario", quickReplies: ["Uno", "Dos"] }],
  ["a label of 21 characters", { ...queued, ...list, listButton: "B".repeat(21) }],
])("rejects an outgoing with options out of their limits: %s", async (_case, outgoing) => {
  await expect(readThread({ ...thread, outgoing: [outgoing] })).rejects.toThrow("Unsupported chat response.");
});

// Task 9 of the documents: the Flow the assistant sent for a file the person sent is marked `loadsFile`, in its message and in its
// outgoing, and never `false`. Its body may say what it read: without formrecords.read the server sends it without one, and the private
// retreat takes it away (`withoutFormReplyValues`).
const flow = { ...question, id: id(6), kind: "Flow", quickReplies: null, body: "Leí el comprobante: $ 150.000 de Banco Galicia.", loadsFile: true };
const queuedFlow = { ...queued, id: id(7), requestId: id(8), kind: "Flow", quickReplies: null, body: flow.body, loadsFile: true };
it("reads what the assistant sent for a file, with its body only for a reader of the responses", async () => {
  const read = await readThread({ ...allowed, messages: [flow], outgoing: [queuedFlow] });
  expect([read.messages[0], read.outgoing[0]]).toMatchObject([{ kind: "Flow", body: flow.body, loadsFile: true }, { kind: "Flow", body: flow.body, loadsFile: true }]);
  const hidden = await readThread({ ...thread, messages: [flow], outgoing: [queuedFlow] });
  expect([hidden.messages[0], hidden.outgoing[0]]).toMatchObject([{ kind: "Flow", body: null, loadsFile: true }, { kind: "Flow", body: null, loadsFile: true }]);
  expect(JSON.stringify(hidden)).not.toContain("Banco Galicia");
});
it.each([
  ["false", { messages: [{ ...flow, loadsFile: false }] }],
  ["null", { messages: [{ ...flow, loadsFile: null }] }],
  ["a text", { outgoing: [{ ...queuedFlow, loadsFile: "true" }] }],
  ["on a message that is not a form", { messages: [{ ...question, quickReplies: ["Uno", "Dos"], loadsFile: true }] }],
  ["on an outgoing that is not a form", { outgoing: [{ ...queued, quickReplies: ["Uno", "Dos"], loadsFile: true }] }],
])("rejects the mark of what loads a file out of its contract: %s", async (_case, body) => {
  await expect(readThread({ ...allowed, ...body })).rejects.toThrow("Unsupported chat response.");
});
