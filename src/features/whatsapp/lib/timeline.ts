import { readFormMetadata, type ChatFormMetadata } from "../api/formMetadata";
import type { ChatAudio } from "../api/audio";
import type { AssistantExplanation } from "../api/assistant";
import { toFormReplyPresentation, type FormReplyPresentation } from "./formReplyPresentation";
import { calendarDateInZone } from "@/shared/lib/dateTime";
import type { MessageDeliveryState } from "@/shared/ui/MessageBubble";
import type { MapPoint } from "@/shared/lib/mapPoint";
import type { AccessEventKind, AssistantEvent, AssistantReply, ChatMessage, MessageOrigin, MessagePurpose, Outgoing, PrefilledValue, ReceivedDocument, SharedContact } from "../api/chat";

const deliveryStates = {
  Pending: "pending", Sending: "pending", Accepted: "sent", Sent: "sent", Delivered: "delivered",
  Read: "read", Failed: "failed", Uncertain: "uncertain", Reviewed: "reviewed", Unknown: "unknown",
} as const satisfies Record<string, MessageDeliveryState>;
type DeliveryCode = keyof typeof deliveryStates;

export function deliveryStatus(value: string | null) {
  const code: DeliveryCode = value !== null && Object.hasOwn(deliveryStates, value) ? value as DeliveryCode : "Unknown";
  return { code, state: deliveryStates[code] };
}

interface TimelineContent {
  audio: ChatAudio | null;
  /** A received spreadsheet: its name, or null once its content expired. */
  spreadsheetName: string | null;
  /** Task 8 of the documents: what a received document is, or null once its content expired and in every other message. */
  document: ReceivedDocument | null;
  /** DOC4: whether «No se leyó…» goes under it: the last of the documents a number without a linked account sent in a row. */
  notReadLine: boolean;
  /** W3: the first card of a received contact, or null once its content expired and in every other message. */
  contact: SharedContact | null;
  /** W3: «Prellenado con» of a resend of the form (only with `formrecords.read`), or null in every other message. */
  prefill: PrefilledValue[] | null;
  assistant: AssistantExplanation | null;
  /** AS4: «Por qué respondió esto» of a reply of the agent, as the server keeps it. */
  assistantReply: AssistantReply | null;
  quickReplies: string[] | null;
  key: string;
  occurredAtUtc: string;
  direction: "incoming" | "outgoing";
  body: string | null;
  kind: string;
  form: ChatFormMetadata | null;
  /** W1-A: the point of a received location, or null once the history was cleared. */
  location: MapPoint | null;
  formReply: FormReplyPresentation | null;
  origin: MessageOrigin;
  purpose: MessagePurpose;
  accessEventKind: AccessEventKind | null;
  author: "assistant" | "operator" | "automatic" | undefined;
  operatorUserId: string | null;
  delivery: ReturnType<typeof deliveryStatus> | undefined;
}
export type TimelineItem = TimelineContent & ({ source: "message"; messageId: string } | { source: "outgoing"; operation: Outgoing });
/** AS4: a line of the history for what the assistant decided without a message, with its why. */
export interface TimelineEvent { source: "event"; key: string; occurredAtUtc: string; reply: AssistantReply }
export type TimelineEntry = TimelineItem | TimelineEvent;
const byInstant = (first: { occurredAtUtc: string; key: string }, second: { occurredAtUtc: string; key: string }) =>
  Date.parse(first.occurredAtUtc) - Date.parse(second.occurredAtUtc) || first.key.localeCompare(second.key);

// Queries own deduplication and persistence. This adapter preserves the API data and mixes both sources by time.
export function buildTimeline(messages: readonly ChatMessage[], outgoing: readonly Outgoing[]): TimelineItem[] {
  const items: TimelineItem[] = messages.map(message => ({
    audio: message.kind === "Audio" ? message.audio : null,
    spreadsheetName: message.kind === "Spreadsheet" ? message.spreadsheetName ?? null : null,
    document: message.kind === "ReceivedDocument" ? message.document ?? null : null,
    notReadLine: false,
    contact: message.kind === "Contact" ? message.contact ?? null : null,
    prefill: message.kind === "Flow" && message.purpose !== "Access" ? message.prefill ?? null : null,
    messageId: message.id,
    quickReplies: message.kind === "Interactive" && message.purpose !== "Access" ? message.quickReplies : null,
    assistant: message.purpose === "Access" ? null : message.assistant,
    assistantReply: message.purpose === "Access" ? null : message.assistantReply ?? null,
    source: "message", key: `message:${message.id}`, occurredAtUtc: message.occurredAtUtc,
    direction: message.direction === "Outbound" ? "outgoing" : "incoming", body: message.purpose === "Access" || message.kind === "FlowReply" ? null : message.body, kind: message.kind,
    form: (message.kind === "Flow" || message.kind === "LocationRequest") && message.purpose !== "Access" ? readFormMetadata(message.form) : null,
    location: message.kind === "Location" ? message.location ?? null : null,
    formReply: message.kind === "FlowReply" && message.purpose !== "Access" ? toFormReplyPresentation(message.formReply ?? null) : null,
    origin: message.origin,
    purpose: message.purpose ?? "Unclassified", accessEventKind: message.accessEventKind ?? null,
    operatorUserId: message.operatorUserId,
    author: message.direction === "Outbound" ? message.origin === "Assistant" ? "assistant" : message.origin === "FormAction" || !message.operatorUserId ? "automatic" : "operator" : undefined,
    delivery: message.direction === "Outbound" ? deliveryStatus(message.status) : undefined,
  }));
  for (const operation of outgoing) items.push({
    audio: null,
    spreadsheetName: null,
    document: null,
    notReadLine: false,
    contact: null,
    prefill: operation.kind === "Flow" ? operation.prefill ?? null : null,
    quickReplies: operation.kind === "QuickReplies" ? operation.quickReplies : null,
    assistant: operation.assistant,
    assistantReply: operation.assistantReply ?? null,
    source: "outgoing", operation, key: `outgoing:${operation.id}`, occurredAtUtc: operation.requestedAtUtc,
    direction: "outgoing", body: operation.body, kind: operation.kind ?? "Text", form: operation.kind === "Flow" || operation.kind === "LocationRequest" ? readFormMetadata(operation.form) : null, location: null, author: operation.origin === "Assistant" ? "assistant" : operation.origin === "FormAction" || !operation.operatorUserId ? "automatic" : "operator", operatorUserId: operation.operatorUserId,
    origin: operation.origin, purpose: "Business", accessEventKind: null, formReply: null,
    delivery: deliveryStatus(operation.state),
  });
  items.sort(byInstant);
  // DOC4: what a number without a linked account sends in a row is said once, under the last of its documents.
  const notRead = (item: TimelineItem | undefined) => item?.document?.reasonCode === "notLinked" && item.purpose !== "Access";
  for (const [index, item] of items.entries()) item.notReadLine = notRead(item) && !notRead(items[index + 1]);
  return items;
}

/** AS4: the lines of what the assistant decided without a message go in the history by their instant. Without them, the same list. */
export function withAssistantEvents(items: readonly TimelineItem[], events: readonly AssistantEvent[]): readonly TimelineEntry[] {
  if (!events.length) return items;
  return [...items, ...events.map((event): TimelineEvent => ({ source: "event", key: `event:${event.id}`, occurredAtUtc: event.atUtc, reply: event.reply }))].sort(byInstant);
}

export function groupTimelineByDay<T extends { occurredAtUtc: string }>(items: readonly T[], timeZone: string | undefined) {
  const groups: { date: string; items: T[] }[] = [];
  for (const item of items) {
    const date = calendarDateInZone(item.occurredAtUtc, timeZone);
    const current = groups.at(-1);
    if (current?.date === date) current.items.push(item);
    else groups.push({ date, items: [item] });
  }
  return groups;
}
