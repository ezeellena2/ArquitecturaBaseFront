import { describe, expect, it } from "vitest";
import { fixtureDefinition, wireDefinition } from "@/test/visual/formFixtures";
import { readFormDetail, readFormFacets } from "./response";
const id = fixtureDefinition().id;
const lifecycle = { revision: 1, deactivatedAtUtc: null, deactivatedBy: null, responseCount: null, pendingApprovalCount: null, nextRecordNumber: null, nextVersionNumber: 2, canDeactivate: true, canReactivate: false, unavailableReason: null };
const detail = () => ({ definition: wireDefinition(fixtureDefinition()), capabilities: { canSave: true, canPublish: true, canPreview: true }, audit: { createdAtUtc: "2026-10-20T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-10-20T12:00:00Z", lastChangedBy: null }, publication: { activeVersion: { versionId: "01990000-0000-7000-8000-000000000099", versionNumber: 1, draftRevision: 1, cultures: ["es"] }, currentOperation: null, displayState: "Published" }, lifecycle });
describe("form lifecycle response contract", () => {
 it("keeps unknown response counts and deactivation separate from the draft and publication", () => {
  expect(readFormDetail(detail())).toMatchObject({ definition: { id }, lifecycle });
  const deactivated = { ...lifecycle, deactivatedAtUtc: "2026-10-20T13:00:00Z", canDeactivate: false, canReactivate: true };
  expect(readFormDetail({ ...detail(), lifecycle: deactivated })).toMatchObject({ lifecycle: deactivated, publication: { displayState: "Published" } });
 });
 it.each([undefined, { ...lifecycle, responseCount: -1 }, { ...lifecycle, unavailableReason: "UnknownState" }])("rejects missing or invalid lifecycle metadata", value => {
  expect(() => readFormDetail({ ...detail(), lifecycle: value })).toThrow("Unsupported form response.");
 });
 it("requires four authoritative facet counts", () => {
  expect(readFormFacets({ active: 7, published: 6, drafts: 1, deactivated: 2 })).toEqual({ active: 7, published: 6, drafts: 1, deactivated: 2 });
  expect(() => readFormFacets({ all: 9, published: 6, drafts: 1 })).toThrow("Unsupported form response.");
 });
});

it("keeps an independently newer lifecycle read without advancing the draft snapshot",()=> {
 const observed={...detail(),lifecycle:{...lifecycle,revision:2}};
 expect(readFormDetail(observed)).toMatchObject({definition:{revision:1},lifecycle:{revision:2}});
});
