import type { AssistantEvent, AssistantReply, Chat, ChatMessage, Thread } from "@/features/whatsapp/api/chat";

// Casos del asistente (AS4) in the operator's chat, with the data of the board: Ana needs a person (the assistant answered with the
// business information and handed off when she asked for someone; the day before it had reached the daily limit), Juan is in
// Asistente (a reply of two actions, the button he tapped and a chain without reply) and Marta has a text for the composer.
const guid = (n: number) => "01990000-0000-7000-8000-" + String(n).padStart(12, "0");
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const day = (time: string) => `2026-11-11T${time}Z`;

export function createChatAssistantVisualFixtures(language: "es" | "en") {
  const es = language === "es";
  const text = (spanish: string, english: string) => es ? spanish : english;
  const why = (reply: Partial<AssistantReply> & Pick<AssistantReply, "kind" | "caseSource">): AssistantReply =>
    ({ caseTitle: null, reason: "", used: [], ordinal: 1, count: 1, handoffReasonCode: null, handoffReason: null, button: null, ...reply });
  const inbound = (id: number, body: string, occurredAtUtc: string, kind = "Text"): ChatMessage => ({ audio: null, quickReplies: null, assistant: null, origin: "Conversation",
    id: guid(id), direction: "Inbound", kind, body, occurredAtUtc, inboundSequence: id, operatorUserId: null, status: null, errorCode: null, purpose: "Business" });
  const answer = (id: number, body: string, occurredAtUtc: string, assistantReply: AssistantReply, status = "Read", extra: Partial<ChatMessage> = {}): ChatMessage => ({ audio: null, quickReplies: null,
    assistant: null, origin: "Assistant", id: guid(id), direction: "Outbound", kind: "Text", body, occurredAtUtc, inboundSequence: 0, operatorUserId: null, status, errorCode: null, purpose: "Business", assistantReply, ...extra });
  const shipping = text("Sí: al interior enviamos por transporte, a cargo del cliente. En CABA y GBA entregamos nosotros.", "Yes: we ship to other provinces by carrier, paid by the customer. In the city and the suburbs we deliver ourselves.");
  const used = [text("La pregunta frecuente «¿Hacen envíos o entregas?»", "The frequent question «Do you ship or deliver?»"), text("La zona de entrega", "The delivery area")];
  const personCase = text("Pide hablar con una persona o con alguien del equipo.", "Asks to talk to a person or someone on the team.");
  const visitCase = text("Dice que pasó por un cliente, sin aclarar si fue una visita o una entrega.", "Says they stopped by a customer, without saying whether it was a visit or a delivery.");
  const assistantPreview = text("Mensaje del asistente", "Assistant message");

  const ana: Chat = { id: "chat-ana", profileName: "Ana Martínez", phoneNumber: "+54 9 11 4444-5678", mode: "Manual", modeRevision: 5, lastInboundAtUtc: day("13:19:00"), lastInboundSequence: 4,
    unreadCount: 0, preview: assistantPreview, linkedAccount: { userId: guid(901), displayName: "Ana Martínez", email: "ana.martinez@example.com", isActive: true },
    formEligibility: { status: "NoEligibleForms", recipientCulture: language, recipientContextRevision: "context-ana" },
    needsPerson: { reasonCode: "case", reason: text("Pide hablar con una persona.", "Asks to talk to a person."), atUtc: day("13:19:15") } };
  const juan: Chat = { id: "chat-juan", profileName: "Juan Gómez", phoneNumber: "+54 9 351 555-1234", mode: "Assistant", modeRevision: 2, lastInboundAtUtc: day("14:40:00"), lastInboundSequence: 14,
    unreadCount: 0, preview: text("Reenviá esta cadena a 10 contactos y ganá un premio.", "Forward this chain to 10 contacts and win a prize."), linkedAccount: { userId: guid(902), displayName: "Juan Gómez", email: "juan@example.com", isActive: true },
    formEligibility: { status: "NoEligibleForms", recipientCulture: language, recipientContextRevision: "context-juan" } };
  const luis: Chat = { id: "chat-luis", profileName: "Luis Pérez", phoneNumber: "+54 9 341 555-9876", mode: "Assistant", modeRevision: 1, lastInboundAtUtc: day("12:05:00"), lastInboundSequence: 3,
    unreadCount: 0, preview: text("¡Gracias!", "Thanks!") };
  const marta: Chat = { id: "chat-marta", profileName: "Marta Ruiz", phoneNumber: "+54 9 11 5555-3210", mode: "Manual", modeRevision: 3, lastInboundAtUtc: day("15:30:00"), lastInboundSequence: 21,
    unreadCount: 1, preview: text("¿Hacen envíos a Córdoba?", "Do you ship to Córdoba?"), linkedAccount: { userId: guid(903), displayName: "Marta Ruiz", email: "marta@example.com", isActive: true },
    formEligibility: { status: "NoEligibleForms", recipientCulture: language, recipientContextRevision: "context-marta" } };
  const chats = [ana, juan, luis, marta];

  const limit: AssistantEvent = { id: guid(110), atUtc: "2026-11-10T20:30:10Z", reply: why({ kind: "Handoff", caseSource: "Fallback", handoffReasonCode: "dailyReplyLimit" }) };
  const chain: AssistantEvent = { id: guid(111), atUtc: day("14:40:10"), reply: why({ kind: "NoReply", caseSource: "Own",
    caseTitle: text("Manda cadenas, publicidad o mensajes que no son para el negocio.", "Sends chains, ads or messages that are not for the business."), reason: text("Es una cadena: no es para el negocio.", "It is a chain: it is not for the business.") }) };
  const suggestionId = guid(120);
  let suggestionState: "Ready" | "Discarded" = "Ready";
  const threads: Record<string, () => Thread> = {
    "chat-ana": () => ({ assistantSuggestion: { requestId: guid(121), sourceMessageId: guid(4), state: "NoReply" }, assistantAvailability: { state: "available" }, contact: ana, outgoing: [], beforeAtUtc: null, beforeId: null, canReadFormRecords: true,
      assistantEvents: [limit],
      messages: [
        inbound(1, text("¿Y los sábados también entregan?", "Do you also deliver on Saturdays?"), "2026-11-10T20:30:00Z"),
        { ...inbound(2, text("Sí, los sábados de 9 a 13.", "Yes, on Saturdays from 9 to 1."), "2026-11-10T21:00:00Z"), direction: "Outbound", inboundSequence: 0, operatorUserId: "visual-test", status: "Read" },
        inbound(3, text("Hola, ¿hacen envíos a Córdoba?", "Hi, do you ship to Córdoba?"), day("13:11:00")),
        answer(30, shipping, day("13:11:20"), why({ kind: "DraftedReply", caseSource: "Fallback", reason: text("Pregunta por envíos: no encaja en ningún caso propio.", "Asks about shipping: it fits no own case."), used })),
        inbound(4, text("Perfecto. Quiero hablar con alguien para coordinar.", "Great. I want to talk to someone to arrange it."), day("13:19:00")),
        answer(40, text("Te paso con una persona del equipo. Te va a escribir por acá en el horario de atención.", "I'm passing you to a person on the team. They will write to you here during business hours."), day("13:19:15"),
          why({ kind: "Handoff", caseSource: "Own", caseTitle: personCase, reason: text("Pide hablar con alguien para coordinar.", "Asks to talk to someone to arrange it."), handoffReasonCode: "case", handoffReason: ana.needsPerson!.reason }), "Delivered"),
      ] }),
    "chat-juan": () => ({ assistantSuggestion: null, assistantAvailability: { state: "available" }, contact: juan, outgoing: [], beforeAtUtc: null, beforeId: null, canReadFormRecords: true,
      assistantEvents: [chain],
      messages: [
        inbound(11, text("Hola", "Hi"), day("14:30:00")),
        inbound(12, text("Pasé por lo de Pérez.", "I stopped by Pérez's."), day("14:30:05")),
        answer(31, text("¡Hola! Gracias por escribirnos.", "Hi! Thanks for writing to us."), day("14:30:20"), why({ kind: "ExactText", caseSource: "Own", caseTitle: text("Saluda.", "Says hello."),
          reason: text("Saluda antes de contar qué pasó.", "Says hello before telling what happened."), count: 2 })),
        answer(32, text("¿Fue una visita o una entrega?", "Was it a visit or a delivery?"), day("14:30:21"), why({ kind: "AskButtons", caseSource: "Own", caseTitle: visitCase,
          reason: text("No dice si fue una visita o una entrega.", "It doesn't say whether it was a visit or a delivery."), ordinal: 2, count: 2 }), "Read",
          { kind: "Interactive", quickReplies: [text("Visita", "Visit"), text("Entrega", "Delivery")] }),
        inbound(13, text("Visita", "Visit"), day("14:31:00"), "ButtonReply"),
        answer(33, text("Gracias, lo anotamos como visita.", "Thanks, we noted it as a visit."), day("14:31:05"), why({ kind: "ExactText", caseSource: "Own", caseTitle: visitCase, button: text("Visita", "Visit") }), "Delivered"),
        inbound(14, juan.preview!, day("14:40:00")),
      ] }),
    "chat-luis": () => ({ assistantSuggestion: null, assistantAvailability: { state: "available" }, contact: luis, outgoing: [], beforeAtUtc: null, beforeId: null, canReadFormRecords: true,
      messages: [inbound(5, luis.preview!, day("12:05:00"))] }),
    "chat-marta": () => ({ assistantSuggestion: { requestId: suggestionId, sourceMessageId: guid(21), state: suggestionState }, assistantAvailability: { state: "available" }, contact: marta, outgoing: [],
      beforeAtUtc: null, beforeId: null, canReadFormRecords: true, messages: [inbound(21, marta.preview!, day("15:30:00"))] }),
  };
  const suggestion = (state: "Ready" | "Discarded" | "NoReply", requestId: string, sourceMessageId: string) => ({ requestId, sourceMessageId, state, proposal: null, outgoing: null,
    ...state === "Ready" ? { textProposal: { text: shipping, caseSource: "Fallback", caseTitle: null, used } } : {} });
  const discards: string[] = [];
  async function handle(request: Request): Promise<Response | undefined> {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith("/api/whatsapp/chats")) return undefined;
    if (path === "/api/whatsapp/chats") {
      const items = url.searchParams.get("needsPerson") === "true" ? chats.filter(chat => chat.needsPerson) : url.searchParams.get("unreadOnly") === "true" ? chats.filter(chat => chat.unreadCount) : chats;
      return json({ page: { items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasPrevious: false, hasNext: false }, allCount: chats.length, unreadCount: 1, needsPersonCount: 1 });
    }
    const contactId = path.split("/")[4];
    if (path.endsWith("/read")) return new Response(null, { status: 204 });
    if (request.method === "GET" && path.endsWith("/messages") && threads[contactId]) return json(threads[contactId]());
    if (path.endsWith("/discard") && request.method === "POST") {
      discards.push(contactId);
      suggestionState = "Discarded";
      return json(suggestion("Discarded", suggestionId, guid(21)));
    }
    if (request.method === "GET" && path.includes("/assistant-suggestions/")) {
      const requestId = path.split("/").at(-1)!;
      return requestId === suggestionId ? json(suggestion(suggestionState, suggestionId, guid(21))) : json(suggestion("NoReply", requestId, guid(4)));
    }
    return json({ code: "General.NotFound" }, 404);
  }
  return { handle, discards, permissions: ["whatsapp.read", "whatsapp.send", "whatsapp.configureassistant"] };
}
