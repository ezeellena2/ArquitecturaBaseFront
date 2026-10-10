import type { Chat, Outgoing } from "../api/chat";
import { isUnresolved } from "./history";
export function replyDisabledReason(contact: Chat, canSend: boolean, outgoing: readonly Outgoing[], now: number) {
  return !canSend ? "send.readOnly" : contact.mode !== "Manual" ? "send.botMode" : now - Date.parse(contact.lastInboundAtUtc) >= 24 * 60 * 60 * 1000 ? "send.windowClosed" : !contact.phoneNumber ? "send.noPhone" : outgoing.some(item => isUnresolved(item.state)) ? "send.pending" : undefined;
}
