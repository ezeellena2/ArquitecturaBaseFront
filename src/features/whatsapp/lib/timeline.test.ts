import { describe, expect, it } from "vitest";
import type { ChatMessage, Outgoing } from "../api/chat";
import { buildTimeline, groupTimelineByDay, deliveryStatus } from "./timeline";

const message = (id: string, occurredAtUtc: string, status: string | null = null): ChatMessage => ({
  id, occurredAtUtc, status, direction: "Outbound", kind: "Text", body: id,
  inboundSequence: 0, operatorUserId: null, errorCode: null,
});
const outgoing = (id: string, requestedAtUtc: string): Outgoing => ({
  id, requestedAtUtc, requestId: id, body: id, state: "Pending", operatorUserId: "operator", waMessageId: null,
});

describe("chat timeline", () => {
  it("interleaves pending operations and history by instant with independent stable identities", () => {
    const items = buildTimeline([message("same", "2026-10-02T12:02:00Z"), message("earlier", "2026-10-02T12:00:00Z")],
      [outgoing("same", "2026-10-02T12:01:00Z")]);
    expect(items.map(item => item.key)).toEqual(["message:earlier", "outgoing:same", "message:same"]);
    expect(items[1].source).toBe("outgoing");
  });
  it("groups by the profile's calendar day, including midnight and year boundaries", () => {
    const items = buildTimeline([message("1", "2027-01-01T02:59:00Z"), message("2", "2027-01-01T03:00:00Z")], []);
    const groups = groupTimelineByDay(items, "America/Argentina/Buenos_Aires");
    expect(groups.map(group => [group.date, group.items.map(item => item.key)])).toEqual([
      ["2026-12-31", ["message:1"]], ["2027-01-01", ["message:2"]],
    ]);
    expect(groupTimelineByDay(items, "UTC")).toHaveLength(1);
  });
  it("keeps bot, operator, missing content and recovery information from the real contracts", () => {
    const human = { ...message("human", "2026-10-02T12:00:00Z", "Delivered"), operatorUserId: "operator", body: null };
    const failed = { ...outgoing("failed", "2026-10-02T12:01:00Z"), state: "Failed" as const };
    const items = buildTimeline([human, message("bot", "2026-10-02T12:02:00Z")], [failed]);
    expect(items[0]).toMatchObject({ author: "operator", body: null, delivery: { code: "Delivered", state: "delivered" } });
    expect(items[1]).toMatchObject({ source: "outgoing", operation: failed, delivery: { code: "Failed", state: "failed" } });
    expect(items[2].author).toBe("bot");
  });
  it.each([
    ["Pending", "pending"], ["Sending", "pending"], ["Accepted", "sent"], ["Sent", "sent"],
    ["Delivered", "delivered"], ["Read", "read"], ["Failed", "failed"], ["Uncertain", "uncertain"],
    ["Reviewed", "reviewed"], [null, "unknown"], ["FutureStatus", "unknown"],
  ])("represents %s without claiming a later delivery stage", (code, state) => {
    expect(deliveryStatus(code)).toEqual({ code: code === null || code === "FutureStatus" ? "Unknown" : code, state });
  });
  it("does not add outbound delivery or bot authorship to a received message", () => {
    const received = { ...message("in", "2026-10-02T12:00:00Z", "Read"), direction: "Inbound" as const };
    expect(buildTimeline([received], [])[0]).toMatchObject({ direction: "incoming", author: undefined, delivery: undefined });
  });
});
