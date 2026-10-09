import { calendarDateInZone } from "@/shared/lib/dateTime";
import type { AssistantConversationSummary } from "../api/assistant";

export function conversationGroups(items: readonly AssistantConversationSummary[], nowUtc: string, timeZone: string) {
  const today = calendarDateInZone(nowUtc, timeZone);
  const [year, month, day] = today.split("-").map(Number);
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  return ["today", "yesterday", "previous"].map(key => ({
    key,
    ids: items.filter(item => {
      const date = calendarDateInZone(item.lastActivityAtUtc, timeZone);
      return key === "today" ? date >= today : key === "yesterday" ? date === yesterday : date < yesterday;
    }).map(item => item.conversationId),
  }));
}
