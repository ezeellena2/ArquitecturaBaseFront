import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { fetchFormDocumentReading, readFormDocumentReading } from "./documentReading";

// DOC1, «Cómo viene leyendo»: the documents confirmed in the last 30 days, the share read without corrections per question, the
// most corrected one, the questions that mark a repeated document and, only with «Ver respuestas», the latest corrections.
// Synthetic bodies: no HTTP capture of this route exists yet; its *HttpContract test arrives with the coordinator's export.
const id = "01990000-0000-7000-8000-000000000001";
const question = (n: number) => "01990000-0000-7000-8000-" + String(500 + n).padStart(12, "0");
const example = (n: number) => ({ recordId: "01990000-0000-7000-8000-" + String(700 + n).padStart(12, "0"), recordNumber: `REC-${String(n + 1).padStart(6, "0")}`,
  confirmedAtUtc: "2026-11-10T14:30:00Z", questionId: question(1), read: "12345678", confirmed: "12345679" });
const stats = { sinceUtc: "2026-10-12T03:00:00Z", documents: 118, questions: [{ questionId: question(1), read: 118, unchanged: 104 }, { questionId: question(2), read: 117, unchanged: 117 }],
  mostCorrected: { questionId: question(1), corrections: 14 }, duplicateQuestionIds: [question(1), question(2)] };

it("reads the numbers, and the latest corrections only when they come", () => {
  expect(readFormDocumentReading(stats)).toEqual(stats);
  expect(readFormDocumentReading(stats)).not.toHaveProperty("examples");
  const withExamples = { ...stats, examples: Array.from({ length: 10 }, (_, n) => example(n)) };
  expect(readFormDocumentReading(withExamples).examples).toHaveLength(10);
  // Without documents there is nothing to count: no questions, nobody corrected most, and an own form marks no data as repeated.
  const empty = { sinceUtc: stats.sinceUtc, documents: 0, questions: [], mostCorrected: null, duplicateQuestionIds: [], examples: [] };
  expect(readFormDocumentReading(empty)).toEqual(empty);
  // A value left empty when it was read or confirmed comes as an empty text.
  expect(readFormDocumentReading({ ...stats, examples: [{ ...example(0), read: "" }] }).examples?.[0]?.read).toBe("");
});

it.each([
  ["an unknown member", { ...stats, private: true }],
  ["a negative count of documents", { ...stats, documents: -1 }],
  ["more unchanged data than read", { ...stats, questions: [{ questionId: question(1), read: 3, unchanged: 4 }] }],
  ["a question counted twice", { ...stats, questions: [stats.questions[0], stats.questions[0]] }],
  ["a most corrected question without corrections", { ...stats, mostCorrected: { questionId: question(1), corrections: 0 } }],
  ["a question that is not a guid", { ...stats, duplicateQuestionIds: ["operation"] }],
  ["a question that marks a repeated document twice", { ...stats, duplicateQuestionIds: [question(1), question(1).toUpperCase()] }],
  ["the empty identity", { ...stats, questions: [{ questionId: "00000000-0000-0000-0000-000000000000", read: 1, unchanged: 1 }] }],
  ["eleven examples", { ...stats, examples: Array.from({ length: 11 }, (_, n) => example(n)) }],
  ["an example without its number", { ...stats, examples: [{ ...example(0), recordNumber: "" }] }],
  ["an example with a local time", { ...stats, examples: [{ ...example(0), confirmedAtUtc: "2026-11-10T11:30:00-03:00" }] }],
  ["a missing list of repeated data", (({ duplicateQuestionIds: _omitted, ...rest }) => rest)(stats)],
  // A UTC moment ends in Utc, as the rest of the contract: the start of the window is not read by another name.
  ["the start of the window under another name", (({ sinceUtc, ...rest }) => ({ ...rest, since: sinceUtc }))(stats)],
  ["a start of the window in local time", { ...stats, sinceUtc: "2026-10-12T00:00:00-03:00" }],
])("rejects %s rather than hiding it", (_case, body) => {
  expect(() => readFormDocumentReading(body)).toThrow("Unsupported form response.");
});

it("reads it without caching, under the form's own route", async () => {
  let cache: RequestCache | undefined; let path = "";
  server.use(http.get("/api/forms/definitions/:id/document-reading", ({ request }) => { cache = request.cache; path = new URL(request.url).pathname; return HttpResponse.json(stats); }));
  expect((await fetchFormDocumentReading(id)).documents).toBe(118);
  expect(cache).toBe("no-store");
  expect(path).toBe(`/api/forms/definitions/${id}/document-reading`);
  // The route is composed only with a valid identity.
  await expect(fetchFormDocumentReading("../library")).rejects.toThrow("Unsupported form response.");
});
