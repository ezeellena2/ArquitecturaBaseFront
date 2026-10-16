import { expect, it } from "vitest";
import { readResponseWorkflow } from "./workflow";
const recordId = "0199a0c0-0000-7000-8000-000000000011";
it("validates the record owner of a workflow response", () => {
  const body = { recordId, recordState: "Received", ruleRevision: null, task: null, actions: [], documents: [] };
  expect(readResponseWorkflow(body, recordId)).toEqual(body);
  expect(() => readResponseWorkflow(body, crypto.randomUUID())).toThrow("Invalid response workflow contract.");
});
it("rejects unsupported states without exposing private reasons", () => {
  const privateText = "private delivery reason";
  expect(() => readResponseWorkflow({ recordId, reason: privateText, recordState: "Unknown" }, recordId)).toThrow("Invalid response workflow contract.");
});
