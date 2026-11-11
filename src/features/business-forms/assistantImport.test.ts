import { expect, it } from "vitest";
import { assistantImportState, readAssistantImportState } from "./assistantImport";

const request = { requestId: "01990000-0000-7000-8000-000000000051", proposalId: "01990000-0000-7000-8000-000000000052" };

it("carries the import of a proposal's spreadsheet in the navigation state and reads back only that shape", () => {
  expect(readAssistantImportState(assistantImportState(request))).toEqual(request);
  for (const state of [null, undefined, "x", {}, { assistantImport: null }, { assistantImport: { requestId: request.requestId } },
    { assistantImport: { ...request, proposalId: "not-a-guid" } }, { assistantImport: { ...request, extra: true } }])
    expect(readAssistantImportState(state)).toBeNull();
  // Another owner's entry in the same state does not hide it.
  expect(readAssistantImportState({ ...assistantImportState(request), returnTo: "/catalogos" })).toEqual(request);
});
