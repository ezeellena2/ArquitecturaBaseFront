import type { Chat, ChatMessage, Thread } from "@/features/whatsapp/api/chat";

// Task 8 of the documents in the operator's chat (DOC2 and DOC4), as the backend writes them: Ana, with a linked account, sent a PDF
// with its pages and its caption, a photo WhatsApp sent without a file name, a Word, and one whose content expired; Carlos Díaz,
// without a linked account, sent a PDF and a photo in a row, which were not read: the line of DOC4 goes once, under the last.
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const at = (time: string) => `2026-10-02T${time}Z`;

export function createChatDocumentVisualFixtures(language: "es" | "en") {
  const es = language === "es";
  const text = (spanish: string, english: string) => es ? spanish : english;
  const preview = text("Documento", "Document");
  const inbound = (id: string, sequence: number, occurredAtUtc: string, overrides: Partial<ChatMessage>): ChatMessage => ({ audio: null, quickReplies: null, assistant: null,
    origin: "Conversation", id, direction: "Inbound", kind: "ReceivedDocument", body: null, occurredAtUtc, inboundSequence: sequence, operatorUserId: null, status: null,
    errorCode: null, purpose: "Business", ...overrides });

  const ana: Chat = { id: "chat-ana", profileName: "Ana Martínez", phoneNumber: "+54 9 351 555-1234", mode: "Manual", modeRevision: 1, lastInboundAtUtc: at("12:06:00"),
    lastInboundSequence: 4, unreadCount: 0, preview, linkedAccount: { userId: "01990000-0000-7000-8000-000000000901", displayName: "Ana Martínez", email: "ana.martinez@example.com", isActive: true },
    formEligibility: { status: "NoEligibleForms", recipientCulture: language, recipientContextRevision: "context-ana" } };
  const carlos: Chat = { id: "chat-carlos", profileName: "Carlos Díaz", phoneNumber: "+54 9 351 555-7788", mode: "Manual", modeRevision: 1, lastInboundAtUtc: at("12:09:00"),
    lastInboundSequence: 3, unreadCount: 2, preview, linkedAccount: null, formEligibility: { status: "NoLinkedAccount", recipientCulture: null, recipientContextRevision: null } };
  const chats = [carlos, ana];
  const thread = (contact: Chat, messages: ChatMessage[]): Thread => ({ assistantSuggestion: null, assistantAvailability: { state: "notInstalled" }, contact, messages, outgoing: [],
    beforeAtUtc: null, beforeId: null, canReadFormRecords: true });
  const threads: Record<string, () => Thread> = {
    "chat-ana": () => thread(ana, [
      inbound("document-expired", 1, at("12:03:00"), {}),
      inbound("document-pdf", 2, at("12:04:00"), { body: text("Te paso el pago de La Posta", "Here is the payment from La Posta"),
        document: { name: text("comprobante-la-posta.pdf", "la-posta-payment.pdf"), kind: "pdf", pages: 2 } }),
      inbound("document-photo", 3, at("12:05:00"), { document: { kind: "jpeg", pages: 1 } }),
      inbound("document-word", 4, at("12:06:00"), { body: text("Les mandamos el aviso de pago", "We are sending you the payment notice"),
        document: { name: text("aviso-de-pago-hotel-plaza.docx", "hotel-plaza-payment-notice.docx"), kind: "docx" } }),
    ]),
    "chat-carlos": () => thread(carlos, [
      inbound("carlos-question", 1, at("12:07:00"), { kind: "Text", body: text("Hola, ¿los trabajos tienen garantía?", "Hi, do the jobs come with a warranty?") }),
      inbound("carlos-budget", 2, at("12:08:00"), { document: { name: text("presupuesto-firmado.pdf", "signed-quote.pdf"), kind: "pdf", pages: 1, reasonCode: "notLinked" } }),
      inbound("carlos-receipt", 3, at("12:09:00"), { body: text("Te mando el comprobante de la seña", "I am sending you the deposit receipt"),
        document: { kind: "jpeg", pages: 1, reasonCode: "notLinked" } }),
    ]),
  };

  async function handle(request: Request): Promise<Response | undefined> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith("/api/whatsapp/chats")) return undefined;
    if (path === "/api/whatsapp/chats") {
      const items = url.searchParams.get("unreadOnly") === "true" ? chats.filter(chat => chat.unreadCount) : url.searchParams.get("needsPerson") === "true" ? [] : chats;
      return json({ page: { items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasPrevious: false, hasNext: false }, allCount: chats.length, unreadCount: 1, needsPersonCount: 0 });
    }
    const contactId = path.split("/")[4];
    if (path.endsWith("/read")) return new Response(null, { status: 204 });
    if (request.method === "GET" && path.endsWith("/messages") && threads[contactId]) return json(threads[contactId]());
    return json({ code: "General.NotFound" }, 404);
  }
  return { handle, permissions: ["whatsapp.read", "whatsapp.send"] };
}
