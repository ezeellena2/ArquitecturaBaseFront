import { z } from "zod";
import { chatAudioSchema, type ChatAudio } from "./audio";
import { api } from "@/shared/api/httpClient";
import { readThreadFormReplies, type FormReply } from "./formReplies";
import type { ChatFormMetadata, FormEligibility, LinkedAccount } from "./forms";
import { assistantExplanationSchema, assistantSuggestionPointerSchema, assistantQuickRepliesSchema, type AssistantExplanation, type AssistantSuggestionPointer } from "./assistant";

const assistantAvailabilitySchema = z.strictObject({ state: z.enum(["available", "notInstalled", "notConfigured", "paused", "modelNotQualified"]) });
export type AssistantAvailability = z.infer<typeof assistantAvailabilitySchema>;
export type ChatMode = "Assistant" | "Manual";
const messageOriginSchema = z.enum(["Conversation", "FormAction", "Assistant"]);
export type MessageOrigin = z.infer<typeof messageOriginSchema>;
const locationPointSchema = z.strictObject({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });
// Casos del asistente (AS4): «Necesita una persona» with its reason, and «Por qué respondió esto» of each action. Every field is
// absent when it does not apply, so the answers of a chat without the agent keep their shape.
const instant = z.string().datetime({ offset: true });
const needsPersonSchema = z.strictObject({ reasonCode: z.string().min(1), reason: z.string().nullable(), atUtc: instant });
export type NeedsPerson = z.infer<typeof needsPersonSchema>;
const assistantReplySchema = z.strictObject({
  kind: z.enum(["ExactText", "DraftedReply", "AskButtons", "Handoff", "NoReply", "SendForm"]), caseSource: z.enum(["Own", "Form", "Fallback"]),
  caseTitle: z.string().nullable(), reason: z.string(), used: z.array(z.string()), ordinal: z.number().int().min(1), count: z.number().int().min(1),
  handoffReasonCode: z.string().nullable(), handoffReason: z.string().nullable(), button: z.string().nullable(),
}).refine(reply => reply.ordinal <= reply.count);
export type AssistantReply = z.infer<typeof assistantReplySchema>;
const assistantEventsSchema = z.array(z.strictObject({ id: z.string().uuid(), atUtc: instant, reply: assistantReplySchema })).min(1);
export type AssistantEvent = z.infer<typeof assistantEventsSchema>[number];
// W3: what the person shares while a form is open. A contact brings the name and the phones of its first card, as they came (one
// without a phone or without a name is a real case); a resend of the form brings «Prellenado con», what went into each question
// with its label (one per datum: the location, the contact's name and its phone). Both absent when they do not apply.
const sharedContactSchema = z.strictObject({ name: z.string().min(1).nullable(), phones: z.array(z.string().min(1)).max(10) });
export type SharedContact = z.infer<typeof sharedContactSchema>;
const prefillSchema = z.array(z.strictObject({ label: z.string().min(1), value: z.string().min(1) })).min(1).max(3);
export type PrefilledValue = z.infer<typeof prefillSchema>[number];
export type MessagePurpose = "Unclassified" | "Business" | "Access";
export type AccessEventKind = "SignInCode" | "VerifyPhoneCode" | "Invitation" | "AccessRequested" | "AccessInstructions";
export type OutgoingState = "Pending" | "Sending" | "Accepted" | "Failed" | "Uncertain" | "Reviewed";
export interface Chat {
  linkedAccount?: LinkedAccount | null; formEligibility?: FormEligibility | null;
  id: string; profileName: string | null; phoneNumber: string | null; mode: ChatMode; modeRevision: number;
  lastInboundAtUtc: string; lastInboundSequence: number; unreadCount: number; preview: string | null;
  previewPurpose?: MessagePurpose; previewAccessEventKind?: AccessEventKind | null;
  /** AS4: only a conversation the assistant handed off, until a person answers. */
  needsPerson?: NeedsPerson;
}
export interface ChatMessage {
  audio: ChatAudio | null;
  id: string; direction: "Inbound" | "Outbound"; kind: string; body: string | null; occurredAtUtc: string;
  inboundSequence: number; operatorUserId: string | null; status: string | null; errorCode: number | null;
  origin: MessageOrigin; quickReplies: string[] | null; assistant: AssistantExplanation | null;
  purpose?: MessagePurpose; accessEventKind?: AccessEventKind | null;
  form?: ChatFormMetadata | null;
  formReply?: FormReply | null;
  /** The normalized name of a received spreadsheet; the other messages do not bring it. */
  spreadsheetName?: string;
  /** W1-A: the point of a received location; it goes with the body when the history is cleared. */
  location?: { latitude: number; longitude: number };
  /** AS4: «Por qué respondió esto» of a reply of the agent. */
  assistantReply?: AssistantReply;
  /** W3: the first card of a received `Contact`; it goes with the body when the history is cleared. */
  contact?: SharedContact;
  /** W3: «Prellenado con» of a resend of the form, only with `formrecords.read`, like «Por qué lo mandó». */
  prefill?: PrefilledValue[];
}
export interface Outgoing {
  assistant: AssistantExplanation | null; quickReplies: string[] | null; origin: MessageOrigin; kind?: "Text" | "Flow" | "Document" | "QuickReplies" | "LocationRequest"; form?: ChatFormMetadata | null; recoveryPath?: string | null;
  id: string; requestId: string; operatorUserId: string | null; body: string | null; requestedAtUtc: string;
  state: OutgoingState; waMessageId: string | null;
  /** AS4: «Por qué respondió esto» of a queued reply of the agent. */
  assistantReply?: AssistantReply;
  /** W3: «Prellenado con» of a queued resend of the form, only with `formrecords.read`, like «Por qué lo mandó». */
  prefill?: PrefilledValue[];
}
/** `assistantEvents` (AS4): what the assistant decided without a message in the page's span, oldest first. */
export interface Thread { assistantSuggestion: AssistantSuggestionPointer | null; assistantAvailability: AssistantAvailability; contact: Chat; messages: ChatMessage[]; outgoing: Outgoing[]; beforeAtUtc: string | null; beforeId: string | null; canReadFormRecords?: boolean; assistantEvents?: AssistantEvent[] }
/** `needsPersonCount` is 0 when the server does not count them. */
export interface Chats { page: { items: Chat[]; totalCount: number; page: number; pageSize: number; totalPages: number }; allCount: number; unreadCount: number; needsPersonCount: number }
/** The quick filter of the inbox: all, the unread ones or the ones that need a person (AS4). */
export type ChatFilter = "all" | "unread" | "needsPerson";
export const chatKey = ["whatsapp-chat"] as const;
const base = "/api/whatsapp/chats";
const unsupported = (): never => { throw new Error("Unsupported chat response."); };
export async function listChats(page: number, search: string, filter: ChatFilter, signal?: AbortSignal): Promise<Chats> {
  const query = new URLSearchParams({ page: String(page), pageSize: "20", search, unreadOnly: String(filter === "unread") });
  if (filter === "needsPerson") query.set("needsPerson", "true");
  const chats = await api.get<Omit<Chats, "needsPersonCount"> & { needsPersonCount?: unknown }>(`${base}?${query}`, { signal });
  const count = z.number().int().min(0).optional().safeParse(chats?.needsPersonCount);
  if (!count.success || chats.page?.items?.some(chat => !needsPersonSchema.optional().safeParse(chat.needsPerson).success)) return unsupported();
  return { ...chats, needsPersonCount: count.data ?? 0 };
}
export const getThread = async (id: string, cursor?: { at: string; id: string }, signal?: AbortSignal) => {
  const thread = await api.get<Thread>(`${base}/${id}/messages${cursor ? `?${new URLSearchParams({ beforeAtUtc: cursor.at, beforeId: cursor.id })}` : ""}`, { signal });
  const availability = assistantAvailabilitySchema.safeParse(thread?.assistantAvailability);
  if (thread?.messages?.some(row => !chatAudioSchema.nullable().safeParse(row.audio).success || row.location !== undefined && !locationPointSchema.safeParse(row.location).success) || !availability.success || !assistantSuggestionPointerSchema.nullable().safeParse(thread.assistantSuggestion).success || [...thread.messages, ...thread.outgoing].some(row => !messageOriginSchema.safeParse(row.origin).success || !assistantExplanationSchema.nullable().safeParse(row.assistant).success || !assistantQuickRepliesSchema.nullable().safeParse(row.quickReplies).success)) throw new Error("Unsupported chat response.");
  if (!needsPersonSchema.optional().safeParse(thread.contact?.needsPerson).success || !assistantEventsSchema.optional().safeParse(thread.assistantEvents).success
    || [...thread.messages, ...thread.outgoing].some(row => !assistantReplySchema.optional().safeParse(row.assistantReply).success)) return unsupported();
  // «Prellenado con» is validated only for whoever may see it; for the others it is dropped unread (`withoutFormReplyValues`).
  if (thread.messages.some(row => !sharedContactSchema.optional().safeParse(row.contact).success) || thread.canReadFormRecords === true
    && [...thread.messages, ...thread.outgoing].some(row => !prefillSchema.optional().safeParse(row.prefill).success)) return unsupported();
  return readThreadFormReplies({ ...thread, assistantAvailability: availability.data });
};
export const markRead = (id: string, throughSequence: number) => api.put<void>(`${base}/${id}/read`, { throughSequence });
const modeResponse = z.strictObject({ mode: z.enum(["Assistant", "Manual"]), modeRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), assistantSendInProgress: z.boolean() });
export async function changeMode(id: string, mode: ChatMode, expectedRevision: number) {
  const result = modeResponse.safeParse(await api.put<unknown>(`${base}/${id}/mode`, { mode, expectedRevision }));
  if (!result.success || result.data.mode !== mode || ![0, 1].includes(result.data.modeRevision - expectedRevision)) throw new Error("Unsupported chat response.");
  return result.data;
}
export const sendText = (id: string, requestId: string, body: string) => api.post<Outgoing>(`${base}/${id}/messages`, { requestId, body });
export const findOutgoing = (id: string, requestId: string) => api.get<Outgoing>(`${base}/${id}/outgoing/${requestId}`);
export const reviewOutgoing = (id: string, requestId: string) => api.post<void>(`${base}/${id}/outgoing/${requestId}/review`);
