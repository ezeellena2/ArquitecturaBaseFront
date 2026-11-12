import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import type { AssistantEvent, AssistantReply, ChatMessage, Outgoing } from "../api/chat";
import { handoffReasonText } from "./assistantAgentDraft";
import { mergeAssistantEvents } from "./history";
import { buildTimeline, groupTimelineByDay, withAssistantEvents } from "./timeline";

// Casos del asistente (AS4): the why of each answer goes with its message, and what the assistant decided without a message is a
// line of the history at its instant.
const reply: AssistantReply = { kind: "ExactText", caseSource: "Own", caseTitle: "Pregunta el horario.", reason: "", used: [], ordinal: 1, count: 1, handoffReasonCode: null, handoffReason: null, button: null };
const message = (id: string, at: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({ audio: null, quickReplies: null, assistant: null, origin: "Conversation", id, direction: "Inbound", kind: "Text", body: id, occurredAtUtc: at, inboundSequence: 1, operatorUserId: null, status: null, errorCode: null, ...extra });
const event = (id: string, at: string, kind: AssistantReply["kind"] = "NoReply"): AssistantEvent => ({ id: "019abcde-1000-7000-8000-00000000000" + id, atUtc: at, reply: { ...reply, kind } });

describe("the history with the assistant's answers", () => {
  it("keeps the why of a message and of an outgoing, and none for an access event", () => {
    const outgoing: Outgoing = { quickReplies: null, assistant: null, origin: "Assistant", id: "out", requestId: "request", operatorUserId: null, body: "Abrimos a las 9.", requestedAtUtc: "2026-11-11T13:05:00Z", state: "Pending", waMessageId: null, assistantReply: reply };
    const items = buildTimeline([message("sent", "2026-11-11T13:00:00Z", { direction: "Outbound", origin: "Assistant", assistantReply: { ...reply, kind: "DraftedReply" } }),
      message("access", "2026-11-11T13:01:00Z", { purpose: "Access", accessEventKind: "SignInCode", assistantReply: reply }), message("plain", "2026-11-11T13:02:00Z")], [outgoing]);
    expect(items.map(item => [item.key, item.assistantReply?.kind ?? null])).toEqual([["message:sent", "DraftedReply"], ["message:access", null], ["message:plain", null], ["outgoing:out", "ExactText"]]);
  });
  it("puts each line of the assistant at its instant among the messages, and returns the same list without lines", () => {
    const items = buildTimeline([message("first", "2026-11-11T13:00:00Z"), message("third", "2026-11-11T13:10:00Z")], []);
    expect(withAssistantEvents(items, [])).toBe(items);
    const entries = withAssistantEvents(items, [event("1", "2026-11-11T13:05:00Z"), event("2", "2026-11-12T02:30:00Z", "Handoff")]);
    expect(entries.map(entry => entry.key)).toEqual(["message:first", "event:019abcde-1000-7000-8000-000000000001", "message:third", "event:019abcde-1000-7000-8000-000000000002"]);
    expect(entries[1]).toMatchObject({ source: "event", reply: { kind: "NoReply" } });
    // A line after midnight of the profile's zone opens its own day.
    expect(groupTimelineByDay(entries, "America/Argentina/Buenos_Aires").map(group => group.items.length)).toEqual([4]);
    expect(groupTimelineByDay(entries, "UTC").map(group => group.items.length)).toEqual([3, 1]);
  });
  it("joins the lines of every page once, oldest first", () => {
    const older = [event("1", "2026-11-10T12:00:00Z"), event("2", "2026-11-11T09:00:00Z")];
    const latest = [event("2", "2026-11-11T09:00:00Z"), event("3", "2026-11-11T13:00:00Z")];
    expect(mergeAssistantEvents([older, undefined, latest]).map(item => item.id.at(-1))).toEqual(["1", "2", "3"]);
    expect(mergeAssistantEvents([undefined, undefined])).toBe(mergeAssistantEvents([]));
  });
});

describe("why the assistant handed off", () => {
  const t = i18n.getFixedT("es", "whatsappAssistant") as TFunction<"whatsappAssistant">;
  it.each([
    ["case", "Pide hablar con una persona.", "Pide hablar con una persona."],
    ["case", null, "Lo derivó el asistente"],
    ["dailyReplyLimit", null, "Llegó al tope de respuestas del día"],
    ["replyTooLong", null, "La respuesta no pasó los límites"],
    ["replyNotAllowed", null, "La respuesta no pasó los límites"],
    ["blockedTopic", null, "Le preguntaron por un tema que no responde"],
    ["unknown", null, "No encontró la respuesta en lo cargado"],
    ["button", "Hablar con alguien", "Tocó «Hablar con alguien»"],
    ["button", null, "Lo derivó el asistente"],
    // Task 8 of the documents: a linked account that can neither load nor build forms sent a document.
    ["documentNotAllowed", null, "La cuenta no puede cargar documentos"],
    ["somethingNew", "PRIVATE", "Lo derivó el asistente"],
  ])("says the reason of %s without «Motivo:»", (code, reason, expected) => {
    expect(handoffReasonText(t, code, reason)).toBe(expected);
  });
  it("says what was tapped in English too", async () => {
    await i18n.loadLanguages("en");
    expect(handoffReasonText(i18n.getFixedT("en", "whatsappAssistant") as TFunction<"whatsappAssistant">, "button", "Talk to someone")).toBe("They tapped «Talk to someone»");
    expect(handoffReasonText(i18n.getFixedT("en", "whatsappAssistant") as TFunction<"whatsappAssistant">, "documentNotAllowed", null)).toBe("The account can't load documents");
  });
});
