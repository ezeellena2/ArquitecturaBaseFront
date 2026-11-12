import type { AssistantEvent, ChatMessage, OutgoingState } from "../api/chat";

// Newer query results replace old delivery states while earlier pages remain visible.
export function mergeMessages(pages: readonly (readonly ChatMessage[])[]): ChatMessage[] {
  const messages = new Map<string, ChatMessage>();
  for (const page of pages) for (const message of page) messages.set(message.id, message);
  return [...messages.values()].sort((a, b) => a.occurredAtUtc.localeCompare(b.occurredAtUtc) || a.id.localeCompare(b.id));
}
const noEvents: AssistantEvent[] = [];
/** AS4: each page brings the lines of its span; a line read again keeps one place and a page without lines adds none. */
export function mergeAssistantEvents(pages: readonly (readonly AssistantEvent[] | undefined)[]): AssistantEvent[] {
  const events = new Map<string, AssistantEvent>();
  for (const page of pages) for (const event of page ?? []) events.set(event.id, event);
  return events.size ? [...events.values()].sort((a, b) => a.atUtc.localeCompare(b.atUtc) || a.id.localeCompare(b.id)) : noEvents;
}
export const isUnresolved = (state: OutgoingState) => state === "Pending" || state === "Sending" || state === "Uncertain";
