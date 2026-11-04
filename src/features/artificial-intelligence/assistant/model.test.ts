import { describe, expect, it } from "vitest";
import {
  createSubmission,
  projectMessages,
  sourceDestination,
  isActiveTurn,
  proposalNeighbors,
} from "./model";
import type { AssistantTurn } from "../api/assistant";
const base = {
  turnId: "t1",
  ordinal: 1,
  requestId: "r1",
  conversationId: "c1",
  conversationRevision: 2,
  turnRevision: 3,
  state: "completed",
  stage: "finished",
  submittedAtUtc: "2026-10-04T12:00:00Z",
  serverNowUtc: "2026-10-04T12:00:00Z",
  pollingAfterSeconds: 2,
  contentAccess: "allowed",
  question: "How many?",
  answer: { kind: "answer", text: "Three.", evidenceIds: [] },
  evidences: [],
  failure: null,
  usage: null,
  culture: "en",
  timeZoneId: "UTC",
  cancelRequestedAtUtc: null,
} satisfies AssistantTurn;
describe("assistant confirmed state", () => {
  it("projects stable message identifiers and never exposes blocked content", () => {
    expect(projectMessages([base]).map((x) => x.id)).toEqual([
      "t1:user",
      "t1:assistant",
    ]);
    expect(projectMessages([{ ...base, contentAccess: "blocked" }])).toEqual(
      [],
    );
  });
  it("does not fabricate an assistant response for operational failure", () => {
    expect(
      projectMessages([{ ...base, state: "uncertain", answer: null }]).map(
        (x) => x.role,
      ),
    ).toEqual(["user"]);
  });
  it("freezes a normalized body with one logical request identity", () => {
    const body = createSubmission("r1", "  hola\r\nmundo  ", 8, {
      id: "c1",
      revision: 2,
    });
    expect(body).toEqual({
      requestId: "r1",
      question: "hola\nmundo",
      expectedConnectionRevision: 8,
      conversationId: "c1",
      expectedRevision: 2,
    });
    expect(Object.isFrozen(body)).toBe(true);
  });
  it("allows only known destinations and current source permissions", () => {
    expect(sourceDestination("users", ["users.read"])).toBe("/usuarios");
    expect(sourceDestination("users", [])).toBeUndefined();
    expect(
      sourceDestination("https://evil.example", ["users.read"]),
    ).toBeUndefined();
  });
  it("polls only pending and running operations", () => {
    expect(isActiveTurn({ state: "pending" })).toBe(true);
    expect(isActiveTurn({ state: "running" })).toBe(true);
    expect(isActiveTurn({ state: "completed" })).toBe(false);
    expect(isActiveTurn({ state: "uncertain" })).toBe(false);
  });
  it("replaces a proposal only with a later completed one of the same capability", () => {
    const proposal = (id: string, capability: string) => ({ id, capability, version: 1, content: {} });
    const turnWith = (ordinal: number, capability: string | null, state: AssistantTurn["state"] = "completed") => ({
      ...base, turnId: "t" + ordinal, requestId: "r" + ordinal, ordinal, state,
      ...(capability ? { proposal: proposal("p" + ordinal, capability) } : {}),
    } satisfies AssistantTurn);
    const first = turnWith(1, "fixture.form"), catalog = turnWith(2, "fixture.catalog"), answer = turnWith(3, null);
    const second = turnWith(4, "fixture.form"), unfinished = turnWith(5, "fixture.form", "failed");
    const turns = [second, unfinished, first, catalog, answer];
    expect(proposalNeighbors(turns, first)).toEqual({ previous: null, replaced: true });
    expect(proposalNeighbors(turns, second)).toEqual({ previous: first.proposal, replaced: false });
    expect(proposalNeighbors(turns, catalog)).toEqual({ previous: null, replaced: false });
  });
});
