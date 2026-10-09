import type { ChatMessage, OutgoingState } from "../api/chat";

// Newer query results replace old delivery states while earlier pages remain visible.
export function mergeMessages(pages: readonly (readonly ChatMessage[])[]): ChatMessage[] {
  const messages = new Map<string, ChatMessage>();
  for (const page of pages) for (const message of page) messages.set(message.id, message);
  return [...messages.values()].sort((a, b) => a.occurredAtUtc.localeCompare(b.occurredAtUtc) || a.id.localeCompare(b.id));
}
export const isUnresolved = (state: OutgoingState) => state === "Pending" || state === "Sending" || state === "Uncertain";
