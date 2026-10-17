import { describe, expect, it } from "vitest";
import type { ChatMessage, Outgoing } from "../api/chat";
import { buildTimeline, groupTimelineByDay, deliveryStatus } from "./timeline";

const message = (id: string, occurredAtUtc: string, status: string | null = null): ChatMessage => ({ audio: null, quickReplies: null, assistant: null, origin: "Conversation" as const,
  id, occurredAtUtc, status, direction: "Outbound", kind: "Text", body: id,
  inboundSequence: 0, operatorUserId: null, errorCode: null,
});
const outgoing = (id: string, requestedAtUtc: string): Outgoing => ({ quickReplies: null, assistant: null, origin: "Conversation" as const,
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
  it("keeps system, operator, missing content and recovery information from the real contracts", () => {
    const human = { ...message("human", "2026-10-02T12:00:00Z", "Delivered"), operatorUserId: "operator", body: null };
    const failed = { ...outgoing("failed", "2026-10-02T12:01:00Z"), state: "Failed" as const };
    const items = buildTimeline([human, message("bot", "2026-10-02T12:02:00Z")], [failed]);
    expect(items[0]).toMatchObject({ author: "operator", body: null, delivery: { code: "Delivered", state: "delivered" } });
    expect(items[1]).toMatchObject({ source: "outgoing", operation: failed, delivery: { code: "Failed", state: "failed" } });
    expect(items[2].author).toBe("automatic");
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

const form = { definitionId: "019abcde-1000-7000-8000-000000000001", versionId: "019abcde-1000-7000-8000-000000000002", versionNumber: 1, name: { es: "Formulario de visita", en: "Visit form" }, culture: "en" as const };
describe("Flow timeline metadata", () => {
  it("keeps a Flow card on its outgoing operation and confirmed message without changing other kinds", () => {
    const flow = {...outgoing("flow","2026-10-10T12:00:00Z"),kind:"Flow" as const,form};
    const confirmed = {...message("flow-message","2026-10-10T12:01:00Z","Read"),kind:"Flow",form};
    const other = {...message("media","2026-10-10T12:02:00Z"),kind:"Other"};
    const items = buildTimeline([confirmed,other],[flow]);
    expect(items[0]).toMatchObject({kind:"Flow",form});
    expect(items[1]).toMatchObject({kind:"Flow",form,delivery:{state:"read"}});
    expect(items[2]).toMatchObject({kind:"Other",form:null});
  });
  it("never manufactures a form card from text or access metadata", () => {
    const access = {...message("access","2026-10-10T12:00:00Z"),purpose:"Access" as const,form,body:"private"};
    const other = {...message("other","2026-10-10T12:01:00Z"),kind:"Other",form};
    expect(buildTimeline([access,other],[]).map(item=>item.form)).toEqual([null,null]);
    expect(buildTimeline([access],[])[0].body).toBeNull();
  });
});

it("preserves automatic form action origin and document kind across pending and confirmed history",()=>{const confirmed={...message("automatic","2026-10-16T12:00:00Z","Delivered"),origin:"FormAction" as const,kind:"Document",body:"Visit approved"};const pending={...outgoing("automatic-pending","2026-10-16T12:01:00Z"),origin:"FormAction" as const,kind:"Document" as const,operatorUserId:null};expect(buildTimeline([confirmed],[pending]).map(item=>({origin:item.origin,kind:item.kind,author:item.author,operator:item.operatorUserId}))).toEqual([{origin:"FormAction",kind:"Document",author:"automatic",operator:null},{origin:"FormAction",kind:"Document",author:"automatic",operator:null}]);});

it("attributes Assistant explicitly across pending and confirmed messages without an operator", () => {
  const confirmed = { ...message("assistant-sent", "2026-10-17T12:01:00Z", "Accepted"), origin: "Assistant" as const };
  const pending = { ...outgoing("assistant-pending", "2026-10-17T12:00:00Z"), origin: "Assistant" as const, operatorUserId: null };
  expect(buildTimeline([confirmed], [pending]).map(item => ({ origin: item.origin, author: item.author, operatorUserId: item.operatorUserId }))).toEqual([
    { origin: "Assistant", author: "assistant", operatorUserId: null },
    { origin: "Assistant", author: "assistant", operatorUserId: null },
  ]);
});
it("does not infer Assistant from a system message without a human operator", () => {
  expect(buildTimeline([{ ...message("system", "2026-10-17T12:00:00Z"), origin: "Conversation" }], [])[0].author).toBe("automatic");
});
