import type { Chat, ChatMessage, Thread } from "@/features/whatsapp/api/chat";
import type { ChatFormMetadata } from "@/features/whatsapp/api/formMetadata";

// Task 8 of the documents in the operator's chat (DOC2 and DOC4), as the backend writes them: Ana, with a linked account, sent a PDF
// with its pages and its caption, a photo WhatsApp sent without a file name, a Word, and one whose content expired; Carlos Díaz,
// without a linked account, sent a PDF and a photo in a row, which were not read: the line of DOC4 goes once, under the last.
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const at = (time: string) => `2026-10-02T${time}Z`;

// VC1-A («chat-document-rows»): Marta Ruiz sends «cobranzas-semana.xlsx» with eight rows of «Cobranzas»; the assistant answers with the
// notice and its «Por qué lo propuso» (three rows sent, four for the team and a repeated one, already in a response), and the three loads,
// each drawn as the card of the form, without the footer that only goes to WhatsApp. Whoever reads it can open «Documentos recibidos».
export function createChatDocumentVisualFixtures(language: "es" | "en", scenario: string | null = "chat-document") {
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
  const marta: Chat = { id: "chat-marta", profileName: "Marta Ruiz", phoneNumber: "+54 9 341 555-2468", mode: "Manual", modeRevision: 1, lastInboundAtUtc: at("11:40:00"),
    lastInboundSequence: 1, unreadCount: 0, preview: text("Planilla", "Spreadsheet"), linkedAccount: { userId: "01990000-0000-7000-8000-000000000903", displayName: "Marta Ruiz",
      email: "marta.ruiz@example.com", isActive: true }, formEligibility: { status: "NoEligibleForms", recipientCulture: language, recipientContextRevision: "context-marta" } };
  const rows = scenario === "chat-document-rows";
  const chats = rows ? [marta] : [carlos, ana];
  const collections: ChatFormMetadata = { definitionId: "01990000-0000-7000-8000-000000000421", versionId: "01990000-0000-7000-8000-000000000431", versionNumber: 2,
    name: { es: "Cobranzas", en: "Collections" }, culture: language };
  const outbound = (id: string, occurredAtUtc: string, overrides: Partial<ChatMessage>): ChatMessage => ({ audio: null, quickReplies: null, assistant: null, origin: "Assistant", id,
    direction: "Outbound", kind: "Text", body: null, occurredAtUtc, inboundSequence: 0, operatorUserId: null, status: "Read", errorCode: null, purpose: "Business", ...overrides });
  const load = (index: number, summary: string) => outbound("load-" + index, at("11:41:0" + index), { kind: "Flow", form: collections,
    body: text(`${index} de 3 · ${summary}`, `${index} of 3 · ${summary}`) });
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
    "chat-marta": () => thread(marta, [
      inbound("marta-spreadsheet", 1, at("11:40:00"), { kind: "Spreadsheet", spreadsheetName: text("cobranzas-semana.xlsx", "weekly-collections.xlsx") }),
      outbound("marta-notice", at("11:41:00"), {
        body: text("Recibí una planilla con 8 filas de «Cobranzas». Te preparé un formulario para cada una de las 3 primeras: revisalos y confirmalos. La fila 9 ya se cargó el 03/11/2026 en COB-000118: no la cargo de nuevo. Las otras 4 se las pasé a una persona del equipo.",
          "I got a spreadsheet with 8 rows of “Collections”. I prepared a form for each of the first 3: check them and confirm them. Row 9 was already loaded on 11/03/2026 in COB-000118: I won't load it again. I passed the other 4 to a person on the team."),
        spreadsheetRows: { recognized: [{ form: text("Cobranzas", "Collections"), count: 8 }], sent: [2, 3, 4].map(number => ({ sheet: null, number })),
          forTeam: [5, 6, 7, 8].map(number => ({ sheet: null, number })), repeated: [{ row: { sheet: null, number: 9 }, recordNumber: "COB-000118", sameAs: null }] } }),
      load(1, text("$95.000 · Ferretería Norte", "$95,000 · North hardware store")),
      load(2, text("$61.250 · Almacén Las Rosas", "$61,250 · Las Rosas grocery")),
      load(3, text("$128.400 · Panadería Don Ángel", "$128,400 · Don Ángel bakery")),
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
  return { handle, permissions: ["whatsapp.read", "whatsapp.send", ...rows ? ["formdocuments.read"] : []] };
}
