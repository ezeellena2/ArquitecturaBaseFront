import { z } from "zod";
import { chatAudioSchema, type ChatAudio } from "./audio";
import { api } from "@/shared/api/httpClient";
import { formRecordNumberSchema, readThreadFormReplies, type FormReply } from "./formReplies";
import type { ChatFormMetadata, FormEligibility, LinkedAccount } from "./forms";
import { assistantExplanationSchema, assistantFieldsSchema, assistantListButtonSchema, assistantListRowsSchema, assistantSuggestionPointerSchema, assistantQuickRepliesSchema,
  type AssistantExplanation, type AssistantSuggestionPointer } from "./assistant";

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
// Task 8 of the documents: a photo, a PDF or a Word the person sends is a `ReceivedDocument` with its normalized name (absent only in a
// photo WhatsApp sent without a file name), its kind (absent when it is none of them), its pages (a PDF's once counted; a photo is
// one) and `notLinked` when the number has no linked account (DOC4). Absent once its content was cleared; its caption is the body.
// Task 9: `why` is «Por qué lo propuso» (`proposed`: the form it sent prefilled, how many data it read with doubts and what it read, the
// two while the sealed content lives and what it read only with formrecords.read) or «Por qué preguntó» (`asked`: the one to nine forms
// it offered, without «Otro», and the option the person tapped, «Otro» too); absent when the assistant did nothing with the document. A
// form goes by its name in the reader's language as the chat names it now (else as it was sent or offered), never cut to a button's length.
const documentWhySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("proposed"), forms: z.tuple([z.string().min(1)]), doubtful: z.number().int().min(0).optional(), fields: assistantFieldsSchema.optional() })
    .refine(why => why.fields === undefined || why.doubtful !== undefined),
  z.strictObject({ kind: z.literal("asked"), forms: z.array(z.string().min(1)).min(1).max(9), chosen: z.string().min(1).optional() }),
]);
export type ReceivedDocumentWhy = z.infer<typeof documentWhySchema>;
const receivedDocumentSchema = z.strictObject({ name: z.string().min(1).optional(), kind: z.enum(["pdf", "jpeg", "png", "docx"]).optional(),
  pages: z.number().int().min(1).optional(), reasonCode: z.literal("notLinked").optional(), why: documentWhySchema.optional() })
  .refine(document => document.name !== undefined || document.kind === "jpeg" || document.kind === "png");
export type ReceivedDocument = z.infer<typeof receivedDocumentSchema>;
// What the assistant read of a document is a value of a response, like «Prellenado con»: it is validated only for whoever may see it, and
// for the others it is dropped unread (`withoutFormReplyValues` drops it from what is kept).
function withoutReadFields(document: unknown): unknown {
  if (typeof document !== "object" || document === null || !("why" in document)) return document;
  const why: unknown = document.why;
  if (typeof why !== "object" || why === null || !("fields" in why)) return document;
  const { fields: _fields, ...rest } = why;
  return { ...document, why: rest };
}
// VC1-A: «Por qué lo propuso» of a spreadsheet, on the notice of its loads: the rows it recognized of each form (named in the reader's
// language), the ones it sent (up to three), the ones it passed to the team and the repeated ones, each with the response it is already in
// or the row of the same spreadsheet it repeats, which is listed too. A row is its sheet (only when the book has more than one, so all of a
// notice are named or none is) and its number; none is in two places. It names forms, rows and response numbers, never a value of a
// response: like the reasons of AS4, everyone with whatsapp.read sees it.
const sheetRowSchema = z.strictObject({ sheet: z.string().min(1).nullable(), number: z.number().int().min(1) });
const rowKey = (row: z.infer<typeof sheetRowSchema>) => JSON.stringify([row.sheet, row.number]);
const repeatedRowSchema = z.strictObject({ row: sheetRowSchema, recordNumber: formRecordNumberSchema.nullable(), sameAs: sheetRowSchema.nullable() })
  .refine(entry => (entry.recordNumber === null) !== (entry.sameAs === null) && (entry.sameAs === null || rowKey(entry.sameAs) !== rowKey(entry.row)));
const spreadsheetRowsSchema = z.strictObject({
  recognized: z.array(z.strictObject({ form: z.string().min(1), count: z.number().int().min(1) })).min(1),
  sent: z.array(sheetRowSchema).max(3), forTeam: z.array(sheetRowSchema), repeated: z.array(repeatedRowSchema),
}).refine(rows => {
  const listed = [...rows.sent, ...rows.forTeam, ...rows.repeated.map(entry => entry.row)];
  const keys = new Set(listed.map(rowKey));
  const repeats = rows.repeated.flatMap(entry => entry.sameAs === null ? [] : [entry.sameAs]);
  const named = [...listed, ...repeats].map(row => row.sheet !== null);
  return keys.size === listed.length && repeats.every(row => keys.has(rowKey(row))) && (named.every(Boolean) || !named.some(Boolean));
});
export type SpreadsheetRows = z.infer<typeof spreadsheetRowsSchema>;
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
  /** H9: why a message Meta accepted and later reported as failed did not arrive, by the stable code of its error code. */
  failureCode?: string;
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
  /** Task 8 of the documents: what a `ReceivedDocument` is; it goes with the body when the history is cleared. */
  document?: ReceivedDocument;
  /** VC1-A: «Por qué lo propuso» of the notice of the loads of a spreadsheet, seen with whatsapp.read. */
  spreadsheetRows?: SpreadsheetRows;
  /** Task 9 of the documents: the label of the button of a question of the assistant that went as a WhatsApp list; its options are the rows. */
  listButton?: string;
  /** Task 9: the Flow the assistant sent for a file the person sent; its body, which may say what it read, needs formrecords.read. */
  loadsFile?: true;
}
export interface Outgoing {
  assistant: AssistantExplanation | null; quickReplies: string[] | null; origin: MessageOrigin; kind?: "Text" | "Flow" | "Document" | "QuickReplies" | "LocationRequest"; form?: ChatFormMetadata | null; recoveryPath?: string | null;
  id: string; requestId: string; operatorUserId: string | null; body: string | null; requestedAtUtc: string;
  state: OutgoingState; waMessageId: string | null;
  /** AS4: «Por qué respondió esto» of a queued reply of the agent. */
  assistantReply?: AssistantReply;
  /** W3: «Prellenado con» of a queued resend of the form, only with `formrecords.read`, like «Por qué lo mandó». */
  prefill?: PrefilledValue[];
  /** VC1-A: «Por qué lo propuso» of the queued notice of the loads of a spreadsheet, seen with whatsapp.read. */
  spreadsheetRows?: SpreadsheetRows;
  /** H2: who marked an uncertain send as reviewed, and when; only a reviewed one has it. */
  reviewedByUserId?: string; reviewedAtUtc?: string;
  /** H9: why a failed send did not go out, one stable code per kind of refusal; only a failed one that says has it. */
  failureCode?: string;
  /** Task 9 of the documents: as in the messages, the label of the button of a list and the mark of a Flow sent for a file. */
  listButton?: string;
  loadsFile?: true;
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
// Task 9 of the documents: with the label of the button of a WhatsApp list, which only the assistant sends, the options are the rows of the
// list; without it, buttons. `loadsFile` only marks a Flow, and only as `true`.
const optionsAccepted = (row: { origin: unknown; quickReplies: unknown; listButton?: unknown }) => row.listButton === undefined
  ? assistantQuickRepliesSchema.nullable().safeParse(row.quickReplies).success
  : row.origin === "Assistant" && assistantListButtonSchema.safeParse(row.listButton).success && assistantListRowsSchema.safeParse(row.quickReplies).success;
const loadsFileAccepted = (row: { kind?: unknown; loadsFile?: unknown }) => row.loadsFile === undefined || row.loadsFile === true && row.kind === "Flow";
export const getThread = async (id: string, cursor?: { at: string; id: string }, signal?: AbortSignal) => {
  const thread = await api.get<Thread>(`${base}/${id}/messages${cursor ? `?${new URLSearchParams({ beforeAtUtc: cursor.at, beforeId: cursor.id })}` : ""}`, { signal });
  const availability = assistantAvailabilitySchema.safeParse(thread?.assistantAvailability);
  if (thread?.messages?.some(row => !chatAudioSchema.nullable().safeParse(row.audio).success || row.location !== undefined && !locationPointSchema.safeParse(row.location).success) || !availability.success || !assistantSuggestionPointerSchema.nullable().safeParse(thread.assistantSuggestion).success || [...thread.messages, ...thread.outgoing].some(row => !messageOriginSchema.safeParse(row.origin).success || !assistantExplanationSchema.nullable().safeParse(row.assistant).success || !optionsAccepted(row) || !loadsFileAccepted(row))) throw new Error("Unsupported chat response.");
  if (!needsPersonSchema.optional().safeParse(thread.contact?.needsPerson).success || !assistantEventsSchema.optional().safeParse(thread.assistantEvents).success
    || [...thread.messages, ...thread.outgoing].some(row => !assistantReplySchema.optional().safeParse(row.assistantReply).success)) return unsupported();
  // «Prellenado con» is validated only for whoever may see it; for the others it is dropped unread (`withoutFormReplyValues`).
  if (thread.messages.some(row => !sharedContactSchema.optional().safeParse(row.contact).success) || thread.canReadFormRecords === true
    && [...thread.messages, ...thread.outgoing].some(row => !prefillSchema.optional().safeParse(row.prefill).success)) return unsupported();
  if (thread.messages.some(row => !receivedDocumentSchema.optional().safeParse(thread.canReadFormRecords === true ? row.document : withoutReadFields(row.document)).success)) return unsupported();
  // «Por qué lo propuso» is no value of a response: it is checked for every reader, and `withoutFormReplyValues` keeps it.
  if ([...thread.messages, ...thread.outgoing].some(row => !spreadsheetRowsSchema.optional().safeParse(row.spreadsheetRows).success)) return unsupported();
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
/** H2: the review of an uncertain send by its id, for any operator who can send. */
export const reviewOutgoingById = (id: string, outgoingId: string) => api.post<void>(`${base}/${id}/outgoing-messages/${outgoingId}/review`);
