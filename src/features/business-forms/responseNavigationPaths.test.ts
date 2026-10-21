import { expect, it } from "vitest";
import { responseFullPath, responseSheetPath } from "./responseNavigationPaths";

const formId = "0199a0c0-0000-7000-8000-000000000001";
const recordId = "0199a0c0-0000-7000-8000-000000000002";
const fieldId = "0199a0c0-0000-7000-8000-000000000003";
const base = "/formularios/" + formId + "/respuestas";
const privateSearch = "search=PrivatePerson&actorIds=PrivatePerson&state=Rejected&receivedFromUtc=2026-10-01&receivedToUtc=2026-10-02&conditions=PrivatePerson&q=PrivatePerson&unknown=PrivatePerson";

it("shares only the sheet order and versions when opening a response in full", () => {
  const source = "page=7&pageSize=20&sort=-field&sortFieldId=" + fieldId + "&versionIds=" + recordId + "&columns=none&approvalPage=2&approvalPageSize=10&approval=" + fieldId + "&tab=PDF&" + privateSearch;
  const href = responseFullPath(formId, recordId, source);
  const url = new URL(href, "https://app.test");
  expect(url.pathname).toBe(base + "/" + recordId + "/completa");
  expect([...url.searchParams.entries()]).toEqual([["sort", "-field"], ["sortFieldId", fieldId], ["versionIds", recordId]]);
  expect(href).not.toContain("PrivatePerson");
});
it("returns to public sheet pagination and columns while leaving filters and selection in their owner", () => {
  const source = "?page=7&pageSize=20&sort=-number&versionIds=" + recordId + "&columns=none&approvalPage=2&approvalPageSize=10&approval=" + fieldId + "&tab=Activity&" + privateSearch;
  const href = responseSheetPath(formId, source);
  const url = new URL(href, "https://app.test");
  expect(url.pathname).toBe(base);
  expect([...url.searchParams.entries()]).toEqual([["page", "7"], ["pageSize", "20"], ["sort", "-number"], ["versionIds", recordId], ["columns", "none"], ["approvalPage", "2"], ["approvalPageSize", "10"]]);
  expect(href).not.toContain("PrivatePerson");
});
it.each(["", "?", privateSearch, "?" + privateSearch, "approval=" + fieldId + "&tab=PDF", "sort=&versionIds="])("omits an empty query separator after removing private and transient parameters: %s", search => {
  expect(responseFullPath(formId, recordId, search)).toBe(base + "/" + recordId + "/completa");
  expect(responseSheetPath(formId, search)).toBe(base);
});
it("treats the optional question mark consistently without changing the public values", () => {
  const source = "sort=-field&sortFieldId=" + fieldId + "&versionIds=" + recordId + "," + fieldId;
  expect(responseFullPath(formId, recordId, source)).toBe(responseFullPath(formId, recordId, "?" + source));
  expect(new URL(responseSheetPath(formId, source), "https://app.test").searchParams.get("versionIds")).toBe(recordId + "," + fieldId);
});

