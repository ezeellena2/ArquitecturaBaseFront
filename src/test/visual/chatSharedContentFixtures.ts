import type { Chat, ChatMessage, Thread } from "@/features/whatsapp/api/chat";
import type { FormReply } from "@/features/whatsapp/api/formReplies";

// W3 in the operator's chat (UC2 to UC6), with the shapes the backend will write (tasks 22 to 24): Ana sent «Registrar entrega» to
// Juan, who shared the place of the delivery and then the contact of whoever received it, with two phones; each one brought the form
// back with «Prellenado con». He answered the form and, later, the one that came back: the second response was not saved and says
// which one was kept. Marta, without a form open, shared a contact without a name, with a long phone written as people write it, and
// one without a phone; an older one expired.
const guid = (n: number) => "01990000-0000-7000-8000-" + String(n).padStart(12, "0");
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const day = (time: string) => `2026-11-11T${time}Z`;

export function createChatSharedContentVisualFixtures(language: "es" | "en") {
  const es = language === "es";
  const text = (spanish: string, english: string) => es ? spanish : english;
  const message = (id: number, occurredAtUtc: string, overrides: Partial<ChatMessage>): ChatMessage => ({ audio: null, quickReplies: null, assistant: null,
    origin: "Conversation", id: guid(id), direction: "Inbound", kind: "Text", body: null, occurredAtUtc, inboundSequence: id, operatorUserId: null, status: null,
    errorCode: null, purpose: "Business", ...overrides });
  // The person gets the form in its language, the operator reads the chat in the language of the menu (UC6).
  const form = { definitionId: guid(500), versionId: guid(501), versionNumber: 1, name: { es: "Registrar entrega", en: "Record delivery" }, culture: language };
  const sent = (id: number, occurredAtUtc: string, body: string, prefill?: ChatMessage["prefill"]): ChatMessage => message(id, occurredAtUtc, { direction: "Outbound",
    kind: "Flow", form, body, inboundSequence: 0, operatorUserId: "visual-test", status: "Read", ...(prefill ? { prefill } : {}) });
  const address = text("Dirección de entrega", "Delivery address");
  const receiver = text("Recibió", "Received by");
  const phone = text("Teléfono de quien recibe", "Recipient's phone");
  const place = "Av. San Martín 1450, Rosario";
  const raul = { name: "Raúl Medina", phones: ["+54 9 341 555-0199", "+54 9 341 555-0142"] };
  const formName = form.name[language];
  const quoted = (value: string) => es ? `«${value}»` : `“${value}”`;
  const kept: FormReply = { state: "Completed", definitionId: form.definitionId, versionId: form.versionId, versionNumber: 1, name: formName, recordId: guid(510), number: "ENT-000031",
    values: [{ fieldId: guid(520), key: "direccion", label: address, type: "shortText", value: place },
      { fieldId: guid(521), key: "recibio", label: receiver, type: "shortText", value: raul.name },
      { fieldId: guid(522), key: "telefono", label: phone, type: "shortText", value: raul.phones[0] }] };
  const second: FormReply = { state: "Rejected", definitionId: form.definitionId, versionId: form.versionId, versionNumber: 1, name: formName, recordId: null, number: null, values: null,
    rejectionCode: "Forms.Record.ReplayConflict", savedNumber: "ENT-000031" };

  const marta: Chat = { id: "chat-marta", profileName: "Marta Ruiz", phoneNumber: "+54 9 341 555-4321", mode: "Manual", modeRevision: 1, lastInboundAtUtc: day("13:23:00"),
    lastInboundSequence: 4, unreadCount: 2, preview: text("Contacto", "Contact"), linkedAccount: { userId: guid(902), displayName: "Marta Ruiz", email: "marta@example.com", isActive: true },
    formEligibility: { status: "NoEligibleForms", recipientCulture: language, recipientContextRevision: "context-marta" } };
  const juan: Chat = { id: "chat-juan", profileName: "Juan Gómez", phoneNumber: "+54 9 341 555-1234", mode: "Manual", modeRevision: 2, lastInboundAtUtc: day("13:19:00"),
    lastInboundSequence: 4, unreadCount: 0, preview: text("Respuesta del formulario", "Form response"), linkedAccount: { userId: guid(901), displayName: "Juan Gómez", email: "juan@example.com", isActive: true },
    formEligibility: { status: "NoEligibleForms", recipientCulture: language, recipientContextRevision: "context-juan" } };
  const chats = [marta, juan];
  const thread = (contact: Chat, messages: ChatMessage[]): Thread => ({ assistantSuggestion: null, assistantAvailability: { state: "notInstalled" }, contact, messages, outgoing: [],
    beforeAtUtc: null, beforeId: null, canReadFormRecords: true });
  const threads: Record<string, () => Thread> = {
    "chat-juan": () => thread(juan, [
      sent(10, day("13:05:00"), text("Completá el formulario «Registrar entrega».", "Complete the form “Record delivery”.")),
      message(1, day("13:12:00"), { kind: "Location", location: { latitude: -32.946823, longitude: -60.639317 } }),
      sent(11, day("13:12:05"), text(`Puse tu ubicación en ${quoted(address)}. Revisá el formulario ${quoted(formName)} y confirmalo.`,
        `I put your location in ${quoted(address)}. Check the form ${quoted(formName)} and confirm it.`), [{ label: address, value: place }]),
      message(2, day("13:14:00"), { kind: "Contact", contact: raul }),
      sent(12, day("13:14:05"), text(`Puse el contacto en ${quoted(receiver)} y ${quoted(phone)}. Revisá el formulario ${quoted(formName)} y confirmalo.`,
        `I put the contact in ${quoted(receiver)} and ${quoted(phone)}. Check the form ${quoted(formName)} and confirm it.`),
        [{ label: address, value: place }, { label: receiver, value: raul.name }, { label: phone, value: raul.phones[0] }]),
      message(3, day("13:16:00"), { kind: "FlowReply", formReply: kept }),
      message(4, day("13:19:00"), { kind: "FlowReply", formReply: second }),
    ]),
    "chat-marta": () => thread(marta, [
      message(1, "2026-11-10T18:40:00Z", { kind: "Contact" }),
      message(2, day("13:20:00"), { body: text("Te paso los contactos del depósito", "Here are the warehouse contacts") }),
      message(3, day("13:21:00"), { kind: "Contact", contact: { name: null, phones: ["+54 9 (0341) 15-555-0177"] } }),
      message(4, day("13:23:00"), { kind: "Contact", contact: { name: text("Recepción Depósito Norte", "North Warehouse Front Desk"), phones: [] } }),
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
  return { handle, permissions: ["whatsapp.read", "whatsapp.send", "formrecords.read"] };
}
