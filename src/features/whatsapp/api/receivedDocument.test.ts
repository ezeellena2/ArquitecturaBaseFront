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
