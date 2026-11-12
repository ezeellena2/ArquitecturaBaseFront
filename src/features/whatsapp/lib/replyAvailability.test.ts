import { describe, expect, it } from "vitest";
import type { Chat, MessageOrigin, Outgoing, OutgoingState } from "../api/chat";
import { replyDisabledReason } from "./replyAvailability";

const now = Date.parse("2026-11-12T15:00:00Z");
const contact: Chat = { id: "contact", profileName: "Ana", phoneNumber: "5491100000000", mode: "Manual", modeRevision: 1,
  lastInboundAtUtc: "2026-11-12T14:00:00Z", lastInboundSequence: 3, unreadCount: 0, preview: null };
const outgoing = (origin: MessageOrigin, state: OutgoingState): Outgoing => ({ assistant: null, quickReplies: null, origin,
  id: `${origin}-${state}`, requestId: `request-${origin}`, operatorUserId: origin === "Conversation" ? "operator" : null, body: "Hola",
  requestedAtUtc: "2026-11-12T14:30:00Z", state, waMessageId: null });

describe("reply availability", () => {
  it("waits for an unresolved send of a person in the conversation", () => {
    expect(replyDisabledReason(contact, true, [outgoing("Conversation", "Uncertain")], now)).toBe("send.pending");
    expect(replyDisabledReason(contact, true, [outgoing("Conversation", "Pending")], now)).toBe("send.pending");
  });

  it("lets the operator answer while a notice or an assistant reply is unresolved, as the server does", () => {
    expect(replyDisabledReason(contact, true, [outgoing("Assistant", "Uncertain"), outgoing("FormAction", "Sending")], now)).toBeUndefined();
  });
});
