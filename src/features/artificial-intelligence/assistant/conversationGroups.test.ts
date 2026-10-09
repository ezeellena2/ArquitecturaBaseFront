import { describe, expect, it } from "vitest";
import { conversationGroups } from "./conversationGroups";
import type { AssistantConversationSummary } from "../api/assistant";
const item = (id: string, lastActivityAtUtc: string): AssistantConversationSummary => ({ conversationId: id, revision: 1, title: id, lastActivityAtUtc, contentAccess: "allowed" });
describe("conversation day groups", () => {
  it("uses profile calendar dates across local midnight instead of a 24 hour subtraction", () => {
    const groups = conversationGroups([item("today", "2026-10-05T02:00:00Z"), item("yesterday", "2026-10-04T02:00:00Z"), item("earlier", "2026-10-01T12:00:00Z")], "2026-10-05T02:30:00Z", "America/Argentina/Buenos_Aires");
    expect(groups.map(group => group.ids)).toEqual([["today"], ["yesterday"], ["earlier"]]);
  });
  it("handles daylight saving and year boundaries and keeps server order", () => {
    expect(conversationGroups([item("a", "2026-01-01T05:00:00Z"), item("b", "2026-01-01T04:00:00Z")], "2026-01-01T05:30:00Z", "America/New_York").map(group => group.ids)).toEqual([["a"], ["b"], []]);
    expect(conversationGroups([item("a", "2026-11-01T04:10:00Z"), item("b", "2026-11-01T06:10:00Z")], "2026-11-01T12:00:00Z", "America/New_York")[0].ids).toEqual(["a", "b"]);
  });
});
