import { readFormMetadata, type ChatFormMetadata } from "../api/forms";
import { calendarDateInZone } from "@/shared/lib/dateTime";
import type { MessageDeliveryState } from "@/shared/ui/MessageBubble";
import type { AccessEventKind, ChatMessage, MessagePurpose, Outgoing } from "../api/chat";

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
  key: string;
  occurredAtUtc: string;
  direction: "incoming" | "outgoing";
  body: string | null;
  kind: string;
  form: ChatFormMetadata | null;
  purpose: MessagePurpose;
  accessEventKind: AccessEventKind | null;
  author: "bot" | "operator" | undefined;
  operatorUserId: string | null;
  delivery: ReturnType<typeof deliveryStatus> | undefined;
}
export type TimelineItem = TimelineContent & ({ source: "message" } | { source: "outgoing"; operation: Outgoing });

// Queries own deduplication and persistence. This adapter preserves the API data and mixes both sources by time.
export function buildTimeline(messages: readonly ChatMessage[], outgoing: readonly Outgoing[]): TimelineItem[] {
  const items: TimelineItem[] = messages.map(message => ({
    source: "message", key: `message:${message.id}`, occurredAtUtc: message.occurredAtUtc,
    direction: message.direction === "Outbound" ? "outgoing" : "incoming", body: message.purpose === "Access" ? null : message.body, kind: message.kind,
    form: message.kind === "Flow" && message.purpose !== "Access" ? readFormMetadata(message.form) : null,
    purpose: message.purpose ?? "Unclassified", accessEventKind: message.accessEventKind ?? null,
    operatorUserId: message.operatorUserId,
    author: message.direction === "Outbound" ? message.operatorUserId ? "operator" : "bot" : undefined,
    delivery: message.direction === "Outbound" ? deliveryStatus(message.status) : undefined,
  }));
  for (const operation of outgoing) items.push({
    source: "outgoing", operation, key: `outgoing:${operation.id}`, occurredAtUtc: operation.requestedAtUtc,
    direction: "outgoing", body: operation.body, kind: operation.kind ?? "Text", form: operation.kind === "Flow" ? readFormMetadata(operation.form) : null, author: "operator", operatorUserId: operation.operatorUserId,
    purpose: "Business", accessEventKind: null,
    delivery: deliveryStatus(operation.state),
  });
  return items.sort((first, second) => Date.parse(first.occurredAtUtc) - Date.parse(second.occurredAtUtc) || first.key.localeCompare(second.key));
}

export function groupTimelineByDay(items: readonly TimelineItem[], timeZone: string | undefined) {
  const groups: { date: string; items: TimelineItem[] }[] = [];
  for (const item of items) {
    const date = calendarDateInZone(item.occurredAtUtc, timeZone);
    const current = groups.at(-1);
    if (current?.date === date) current.items.push(item);
    else groups.push({ date, items: [item] });
  }
  return groups;
}
