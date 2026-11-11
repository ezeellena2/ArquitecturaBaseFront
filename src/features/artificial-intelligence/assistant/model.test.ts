import { describe, expect, it } from "vitest";
import {
  createSubmission,
  projectMessages,
  sourceDestination,
  isActiveTurn,
  proposalNeighbors,
  attachmentProblem,
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
  it("names the recording only in a dictated turn, so a typed one keeps its body", () => {
    expect(createSubmission("r1", "", 8, undefined, "a1")).toEqual({
      requestId: "r1", question: "", expectedConnectionRevision: 8, conversationId: null, expectedRevision: null, audioRequestId: "a1",
    });
    expect(createSubmission("r1", "hola", 8)).not.toHaveProperty("audioRequestId");
  });
  it("shows a dictated turn without typed text as the person's message", () => {
    const dictated = { ...base, question: "", audio: { requestId: "a1", transcript: "Armame un formulario" } };
    expect(projectMessages([dictated]).map(message => [message.id, message.role])).toEqual([["t1:user", "user"], ["t1:assistant", "assistant"]]);
    expect(projectMessages([{ ...base, question: "" }]).map(message => message.role)).toEqual(["assistant"]);
  });
  it("shows a turn that brought only a spreadsheet as the person's message", () => {
    const withFile = { ...base, question: "", attachment: { name: "clientes.xlsx", kind: "xlsx", rows: 86, size: 24576 } } satisfies AssistantTurn;
    expect(projectMessages([withFile]).map(message => [message.id, message.role])).toEqual([["t1:user", "user"], ["t1:assistant", "assistant"]]);
  });
  it("stops in the browser what it can see does not serve: an old Excel, one with macros, another type or more than 10 MB", () => {
    const file = (name: string, size = 1024) => ({ name, size });
    expect(attachmentProblem(file("clientes.xlsx"))).toBeUndefined();
    expect(attachmentProblem(file("CLIENTES.CSV"))).toBeUndefined();
    expect(attachmentProblem(file("clientes.xls"))).toBe("legacy");
    expect(attachmentProblem(file("clientes.xlsm"))).toBe("macros");
    expect(attachmentProblem(file("clientes.xlsb"))).toBe("macros");
    expect(attachmentProblem(file("clientes.pdf"))).toBe("type");
    expect(attachmentProblem(file("clientes"))).toBe("type");
    expect(attachmentProblem(file("clientes.xlsx", 10 * 1024 * 1024))).toBeUndefined();
    expect(attachmentProblem(file("clientes.xlsx", 10 * 1024 * 1024 + 1))).toBe("tooLarge");
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
  it("replaces a proposal with a later one of its module's group, or of its capability when the module gives none", () => {
    const proposal = (id: string, capability: string) => ({ id, capability, version: 1, content: {} });
    const turnWith = (ordinal: number, capability: string) => ({
      ...base, turnId: "t" + ordinal, requestId: "r" + ordinal, ordinal, proposal: proposal("p" + ordinal, capability),
    } satisfies AssistantTurn);
    const catalog = turnWith(1, "fixture.propose-catalog"), form = turnWith(2, "fixture.propose-form"), importing = turnWith(3, "fixture.propose-import");
    const turns = [catalog, form, importing];
    const group = (item: { capability: string }) => item.capability === "fixture.propose-form" ? item.capability : "fixture.catalog-group";
    expect(proposalNeighbors(turns, catalog, group)).toEqual({ previous: null, replaced: true });
    expect(proposalNeighbors(turns, importing, group)).toEqual({ previous: catalog.proposal, replaced: false });
    expect(proposalNeighbors(turns, form, group)).toEqual({ previous: null, replaced: false });
    expect(proposalNeighbors(turns, catalog)).toEqual({ previous: null, replaced: false });
  });
});
