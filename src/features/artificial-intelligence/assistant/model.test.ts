import { describe, expect, it } from "vitest";
import {
  createSubmission,
  projectMessages,
  sourceDestination,
  isActiveTurn,
  proposalNeighbors,
  acceptedFileKinds,
  attachmentAccept,
  attachmentKinds,
  attachmentProblem,
  canAttach,
  fileKind,
  readsFirst,
  roundUpToTenthOfMegabyte,
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
    const sheets = attachmentKinds({ attachments: true });
    expect(attachmentProblem(file("clientes.xlsx"), sheets)).toBeUndefined();
    expect(attachmentProblem(file("CLIENTES.CSV"), sheets)).toBeUndefined();
    expect(attachmentProblem(file("clientes.xls"), sheets)).toBe("legacy");
    expect(attachmentProblem(file("clientes.xlsm"), sheets)).toBe("macros");
    expect(attachmentProblem(file("clientes.xlsb"), sheets)).toBe("macros");
    expect(attachmentProblem(file("clientes.pdf"), sheets)).toBe("type");
    expect(attachmentProblem(file("acta.doc"), sheets)).toBe("type");
    expect(attachmentProblem(file("acta.docm"), sheets)).toBe("type");
    expect(attachmentProblem(file("clientes"), sheets)).toBe("type");
    expect(attachmentProblem(file("clientes.xlsx", 10 * 1024 * 1024), sheets)).toBeUndefined();
    expect(attachmentProblem(file("clientes.xlsx", 10 * 1024 * 1024 + 1), sheets)).toBe("tooLarge");
  });
  // Stage 3: the bootstrap says, for this person, whether the clip takes a spreadsheet, a Word, and also a photo or a PDF.
  it("offers in the clip only what the bootstrap says this person may attach, and nothing without it", () => {
    expect(attachmentKinds({})).toEqual({ spreadsheets: false, word: false, reading: false });
    expect(canAttach(attachmentKinds({ attachments: false, documents: false, documentReading: false }))).toBe(false);
    expect(attachmentAccept(attachmentKinds({ attachments: true }))).toBe(".xlsx,.csv");
    expect(attachmentAccept(attachmentKinds({ documents: true }))).toBe(".docx");
    expect(attachmentAccept(attachmentKinds({ attachments: true, documents: true, documentReading: true })))
      .toBe(".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.csv");
    expect(acceptedFileKinds(attachmentKinds({ attachments: true, documents: true, documentReading: true })))
      .toEqual(["pdf", "photo", "docx", "xlsx", "csv"]);
    expect(acceptedFileKinds(attachmentKinds({ documents: true }))).toEqual(["docx"]);
  });
  it("stops an old Word, one with macros, a document it does not take or more than 10 MB, and reads a photo or a PDF first", () => {
    const file = (name: string, size = 1024) => ({ name, size });
    const word = attachmentKinds({ documents: true });
    const all = attachmentKinds({ attachments: true, documents: true, documentReading: true });
    for (const name of ["comprobante.pdf", "foto.JPG", "foto.jpeg", "captura.png", "acta.docx", "clientes.xlsx"])
      expect(attachmentProblem(file(name), all)).toBeUndefined();
    expect(attachmentProblem(file("acta.doc"), word)).toBe("legacyWord");
    expect(attachmentProblem(file("acta.docm"), all)).toBe("macrosWord");
    expect(attachmentProblem(file("comprobante.pdf"), word)).toBe("type");
    expect(attachmentProblem(file("foto.png"), word)).toBe("type");
    expect(attachmentProblem(file("clientes.xls"), word)).toBe("type");
    expect(attachmentProblem(file("foto.heic"), all)).toBe("type");
    expect(attachmentProblem(file("comprobante.pdf", 10 * 1024 * 1024), all)).toBeUndefined();
    expect(attachmentProblem(file("comprobante.pdf", 10 * 1024 * 1024 + 1), all)).toBe("tooLargeDocument");
    expect(attachmentProblem(file("acta.docx", 10 * 1024 * 1024 + 1), all)).toBe("tooLargeDocument");
    expect(attachmentProblem(file("clientes.csv", 10 * 1024 * 1024 + 1), all)).toBe("tooLarge");
    expect(["comprobante.PDF", "foto.jpg", "foto.jpeg", "captura.png"].every(readsFirst)).toBe(true);
    expect(["acta.docx", "clientes.xlsx", "clientes.csv", "acta.doc"].some(readsFirst)).toBe(false);
  });
  it("rounds a weight over the limit up to the next tenth of a megabyte, so it never reads as the limit", () => {
    const megabyte = 1024 * 1024;
    expect(roundUpToTenthOfMegabyte(10 * megabyte + 1) / megabyte).toBeCloseTo(10.1);
    expect(roundUpToTenthOfMegabyte(11 * megabyte)).toBe(11 * megabyte);
    expect(roundUpToTenthOfMegabyte(12.34 * megabyte) / megabyte).toBeCloseTo(12.4);
  });
  it("names a file by its kind, from its extension or from the turn: a photo is a JPEG or a PNG", () => {
    expect(["xlsx", "csv", "pdf", "jpg", "jpeg", "png", "docx", "doc", ""].map(fileKind))
      .toEqual(["xlsx", "csv", "pdf", "photo", "photo", "photo", "docx", undefined, undefined]);
  });
  it("names the reading of a photo or a PDF only in the turn that brought it, so the others keep their body", () => {
    expect(createSubmission("r1", "", 8, undefined, undefined, "d1")).toEqual({
      requestId: "r1", question: "", expectedConnectionRevision: 8, conversationId: null, expectedRevision: null, documentRequestId: "d1",
    });
    expect(createSubmission("r1", "hola", 8, undefined, "a1")).not.toHaveProperty("documentRequestId");
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
