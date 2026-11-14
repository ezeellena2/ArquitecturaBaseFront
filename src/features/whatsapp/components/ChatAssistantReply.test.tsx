import { act, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { AssistantEvent, AssistantReply, ChatMessage, Outgoing } from "../api/chat";
import { buildTimeline, withAssistantEvents } from "../lib/timeline";
import { ChatTimeline } from "./ChatTimeline";

// AS4: «Por qué respondió esto» under each answer of the agent, and the lines of what it decided without a message.
const reply: AssistantReply = { kind: "DraftedReply", caseSource: "Fallback", caseTitle: null, reason: "Pregunta por envíos: no encaja en ningún caso propio.",
  used: ["La pregunta frecuente «¿Hacen envíos o entregas?»", "La zona de entrega"], ordinal: 1, count: 1, handoffReasonCode: null, handoffReason: null, button: null };
const sent = (id: string, body: string, assistantReply: AssistantReply, at = "2026-11-11T13:11:00Z"): ChatMessage => ({ audio: null, quickReplies: null, assistant: null, origin: "Assistant",
  id, direction: "Outbound", kind: "Text", body, occurredAtUtc: at, inboundSequence: 0, operatorUserId: null, status: "Read", errorCode: null, assistantReply });
async function show(messages: ChatMessage[], outgoing: Outgoing[] = [], events: AssistantEvent[] = []) {
  await act(async () => { renderWithProviders(<ChatTimeline contactId="chat-1" readOwner="test" onAudioForbidden={vi.fn()} items={withAssistantEvents(buildTimeline(messages, outgoing), events)} actor="me"
    timeZone="America/Argentina/Buenos_Aires" canSend canReuse onReview={vi.fn()} onReuse={vi.fn()} atBottom onAtBottomChange={vi.fn()} hasOlder={false} loadingOlder={false}
    historyError={false} loadOlder={vi.fn()} />); });
}
const why = (body: string) => within(screen.getByText(body).closest("article")!).getByText("Por qué respondió esto").closest("section")!;
const valueOf = (scope: HTMLElement, label: string) => within(scope).queryByText(label, { selector: "dt" })?.nextElementSibling ?? null;

it("says under a drafted answer the case, the action, why and what it used, in two columns", async () => {
  await show([sent("drafted", "Sí: al interior enviamos por transporte.", reply)]);
  const card = why("Sí: al interior enviamos por transporte.");
  expect(within(card).getByText("Responder con la información del negocio")).toBeInTheDocument();
  expect(valueOf(card, "Caso")).toHaveTextContent(/^Cualquier otra cosa$/);
  expect(valueOf(card, "Por qué")).toHaveTextContent(/^Pregunta por envíos: no encaja en ningún caso propio\.$/);
  expect(within(valueOf(card, "Usó") as HTMLElement).getAllByRole("listitem").map(item => item.textContent)).toEqual(["La pregunta frecuente «¿Hacen envíos o entregas?»", "La zona de entrega"]);
  // One action alone has no place, and nothing reads «Caso:» glued to its value.
  expect(valueOf(card, "En la respuesta")).toBeNull();
  expect(card).not.toHaveTextContent("Caso:");
  expect(within(card).queryByText("Necesita una persona")).not.toBeInTheDocument();
});
it("leaves out what is empty and says its place in a reply of several actions and the button the person tapped", async () => {
  await show([sent("first", "¡Hola! ¿En qué te ayudamos?", { ...reply, kind: "ExactText", caseSource: "Own", caseTitle: "Saluda.", reason: "", used: [], ordinal: 1, count: 2 }),
    sent("tap", "Gracias, lo anotamos como visita.", { ...reply, kind: "ExactText", caseSource: "Own", caseTitle: "Dice que pasó por un cliente.", reason: "", used: [], button: "Visita" }, "2026-11-11T13:12:00Z")]);
  const first = why("¡Hola! ¿En qué te ayudamos?");
  expect(valueOf(first, "En la respuesta")).toHaveTextContent(/^1 de 2$/);
  expect(valueOf(first, "Caso")).toHaveTextContent(/^Saluda\.$/);
  expect(valueOf(first, "Por qué")).toBeNull();
  expect(valueOf(first, "Usó")).toBeNull();
  const tap = why("Gracias, lo anotamos como visita.");
  expect(within(tap).getByText("Responder con un texto exacto")).toBeInTheDocument();
  expect(valueOf(tap, "Tocó")).toHaveTextContent(/^«Visita»$/);
});
it("ends the why of a handoff with the mark and its reason, without «Motivo:»", async () => {
  const handoff: AssistantReply = { ...reply, kind: "Handoff", caseSource: "Own", caseTitle: "Pide hablar con una persona o con alguien del equipo.", reason: "Pide hablar con alguien.",
    used: [], handoffReasonCode: "case", handoffReason: "Pide hablar con una persona." };
  const outgoing: Outgoing = { quickReplies: null, assistant: null, origin: "Assistant", id: "handoff", requestId: "request", operatorUserId: null, body: "Te paso con una persona del equipo.",
    requestedAtUtc: "2026-11-11T13:19:00Z", state: "Pending", waMessageId: null, assistantReply: handoff };
  await show([], [outgoing]);
  const card = why("Te paso con una persona del equipo.");
  expect(within(card).getByText("Derivar a una persona")).toBeInTheDocument();
  expect(valueOf(card, "Caso")).toHaveTextContent(/^Pide hablar con una persona o con alguien del equipo\.$/);
  const mark = within(card).getByText("Necesita una persona");
  expect(mark.closest("p")).toHaveTextContent(/^Necesita una personaPide hablar con una persona\.$/);
  expect(card).not.toHaveTextContent("Motivo");
});
it("says a tapped button once when it is the reason of the handoff", async () => {
  await show([sent("button", "Te paso con una persona del equipo.", { ...reply, kind: "Handoff", caseSource: "Own", caseTitle: "Pregunta con botones.", reason: "", used: [], handoffReasonCode: "button", handoffReason: "Hablar con alguien", button: "Hablar con alguien" })]);
  const card = why("Te paso con una persona del equipo.");
  expect(valueOf(card, "Tocó")).toBeNull();
  expect(within(card).getAllByText(/Hablar con alguien/)).toHaveLength(1);
  expect(within(card).getByText("Tocó «Hablar con alguien»")).toBeInTheDocument();
});
it("draws what the assistant decided without a message as lines of the history, at their instant, with the case and the reason", async () => {
  const inbound = (id: string, body: string, at: string): ChatMessage => ({ audio: null, quickReplies: null, assistant: null, origin: "Conversation", id, direction: "Inbound", kind: "Text", body, occurredAtUtc: at,
    inboundSequence: 1, operatorUserId: null, status: null, errorCode: null });
  await show([inbound("chain", "Reenviá esta cadena a 10 contactos.", "2026-11-11T13:00:00Z"), inbound("saturday", "¿Y los sábados?", "2026-11-11T13:20:00Z")], [], [
    { id: "019abcde-1000-7000-8000-000000000001", atUtc: "2026-11-11T13:01:00Z", reply: { ...reply, kind: "NoReply", caseSource: "Own", caseTitle: "Manda cadenas, publicidad o mensajes que no son para el negocio.", reason: "Es una cadena.", used: [] } },
    { id: "019abcde-1000-7000-8000-000000000002", atUtc: "2026-11-11T13:21:00Z", reply: { ...reply, kind: "Handoff", reason: "", used: [], handoffReasonCode: "dailyReplyLimit" } },
  ]);
  const history = screen.getByLabelText("Historial de mensajes");
  const noReply = within(history).getByText("Sin respuesta del asistente").parentElement!;
  expect(noReply.closest("article")).toBeNull();
  expect(valueOf(noReply, "Caso")).toHaveTextContent(/^Manda cadenas, publicidad o mensajes que no son para el negocio\.$/);
  expect(valueOf(noReply, "Por qué")).toHaveTextContent(/^Es una cadena\.$/);
  expect(within(noReply).queryByText("No responder")).not.toBeInTheDocument();
  const handoff = within(history).getByText("El asistente derivó la conversación").parentElement!;
  expect(valueOf(handoff, "Caso")).toHaveTextContent(/^Cualquier otra cosa$/);
  expect(within(handoff).getByText("Llegó al tope de respuestas del día")).toBeInTheDocument();
  expect(within(handoff).getByText("Necesita una persona")).toBeInTheDocument();
  // In order: the chain, its line, the question of Saturday and its line.
  const order = [screen.getByText("Reenviá esta cadena a 10 contactos."), screen.getByText("Sin respuesta del asistente"), screen.getByText("¿Y los sábados?"), screen.getByText("El asistente derivó la conversación")];
  for (let index = 1; index < order.length; index++) expect(order[index - 1].compareDocumentPosition(order[index])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
});
// H5: a handoff because the assistant could not reply followed no case: the line says only the mark and why.
it("draws a handoff because the assistant could not reply without a case", async () => {
  await show([], [], [{ id: "019abcde-1000-7000-8000-000000000003", atUtc: "2026-11-11T13:30:00Z",
    reply: { ...reply, kind: "Handoff", reason: "", used: [], handoffReasonCode: "assistantFailed" } }]);
  const handoff = within(screen.getByLabelText("Historial de mensajes")).getByText("El asistente derivó la conversación").parentElement!;
  expect(valueOf(handoff, "Caso")).toBeNull();
  expect(within(handoff).getByText("El asistente no pudo responder")).toBeInTheDocument();
  expect(within(handoff).getByText("Necesita una persona")).toBeInTheDocument();
});
it("shows no why under a message the agent did not answer", async () => {
  await show([{ ...sent("plain", "Hola, ¿cómo va?", reply), assistantReply: undefined, origin: "Conversation", operatorUserId: "me" }]);
  expect(screen.queryByText("Por qué respondió esto")).not.toBeInTheDocument();
});
