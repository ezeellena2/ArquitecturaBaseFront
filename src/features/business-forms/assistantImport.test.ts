import { expect, it } from "vitest";
import { assistantImportState, readAssistantImportQuery, readAssistantImportState, withoutAssistantImport } from "./assistantImport";

const request = { requestId: "01990000-0000-7000-8000-000000000051", proposalId: "01990000-0000-7000-8000-000000000052" };

it("carries the import of a proposal's spreadsheet in the navigation state and reads back only that shape", () => {
  expect(readAssistantImportState(assistantImportState(request))).toEqual(request);
  // The card knows the spreadsheet's name and rows, for the dialog's origin.
  const named = { ...request, fileName: "contratistas.xlsx", rowCount: 86 };
  expect(readAssistantImportState(assistantImportState(named))).toEqual(named);
  for (const state of [null, undefined, "x", {}, { assistantImport: null }, { assistantImport: { requestId: request.requestId } },
    { assistantImport: { ...request, proposalId: "not-a-guid" } }, { assistantImport: { ...request, extra: true } }, { assistantImport: { ...request, rowCount: -1 } }])
    expect(readAssistantImportState(state)).toBeNull();
  // Another owner's entry in the same state does not hide it.
  expect(readAssistantImportState({ ...assistantImportState(request), returnTo: "/catalogos" })).toEqual(request);
});

it("leaves the rest of the navigation state when the page takes the import out of it", () => {
  expect(withoutAssistantImport({ ...assistantImportState(request), returnTo: "/catalogos" })).toEqual({ returnTo: "/catalogos" });
  expect(withoutAssistantImport(assistantImportState(request))).toBeNull();
  expect(withoutAssistantImport(null)).toBeNull();
});

it("reads WhatsApp's link, with the request and the proposal as 32 digits, and nothing else", () => {
  const query = (search: string) => readAssistantImportQuery(new URLSearchParams(search));
  expect(query("pedido=019900000000700080000000000000AB&propuesta=01990000000070008000000000000052"))
    .toEqual({ requestId: "01990000-0000-7000-8000-0000000000ab", proposalId: request.proposalId });
  for (const search of ["", "pedido=01990000000070008000000000000051", "propuesta=01990000000070008000000000000052",
    "pedido=" + request.requestId + "&propuesta=" + request.proposalId, "pedido=xyz&propuesta=01990000000070008000000000000052"])
    expect(query(search)).toBeNull();
});
