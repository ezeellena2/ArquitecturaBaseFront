import { describe, expect, it } from "vitest";
import { mergeMessages, isUnresolved } from "./history";
import type { ChatMessage } from "../api/chat";

describe("conversation history", () => {
  it("refreshes delivery status without duplicating or losing older pages", () => {
    const message = (id: string, status: string): ChatMessage => ({ id, status, body: "Hola", direction: "Outbound", kind: "Text", occurredAtUtc: "2026-10-02T12:00:00Z", inboundSequence: 0, operatorUserId: null, errorCode: null });
    const result = mergeMessages([[message("1", "Sent"), message("2", "Sent")], [message("2", "Delivered")]]);
    expect(result.map(item => [item.id, item.status])).toEqual([["1", "Sent"], ["2", "Delivered"]]);
  });
  it("blocks new sends until pending or uncertain operations are resolved", () => {
    expect(isUnresolved("Uncertain")).toBe(true);
    expect(isUnresolved("Sending")).toBe(true);
    expect(isUnresolved("Accepted")).toBe(false);
    expect(isUnresolved("Reviewed")).toBe(false);
  });
});
