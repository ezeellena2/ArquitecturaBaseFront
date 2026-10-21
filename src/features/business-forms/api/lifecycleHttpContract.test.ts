// Bodies are exact backend captures. Run only after the joint lifecycle export.
import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { deactivateForm, deleteForm, fetchFormDeactivation, fetchFormDefinition, fetchFormDefinitions, fetchFormFacets } from "./forms";
import { readFormDeactivation, readFormDeactivationPreview, readFormDetail, readFormFacets, readFormPage } from "./response";
import { readSuggestionOptions } from "./suggestions";

const names = ["preview", "deactivated", "detail-deactivated", "list-deactivated", "facets", "options-unavailable", "detail-reactivation-pending", "detail-reactivated", "preview-affected", "options-deleted", "delete-responses-conflict", "status-pending", "status-uncertain", "status-deprecated"];
it("qualifies all twenty-eight exact lifecycle captures and their real producers", () => {
 const provenance = httpCohort("lifecycle").verify();
 expect(provenance.captures.map(capture => capture.name).sort()).toEqual(["es", "en"].flatMap(culture => names.map(name => culture + "/" + name + ".json")).sort());
 for (const source of ["FormDeactivationHttpTests.cs", "FormDeletionHttpTests.cs", "FormRetirementStatusHttpTests.cs", "FormLifecycleContractCapture.cs"]) expect(provenance.sources.some(item => item.path.endsWith(source))).toBe(true);
});
for (const culture of ["es", "en"] as const) {
 it("reads deactivation, independent metadata, four facets and reactivation from actual " + culture + " HTTP", () => {
  const cohort = httpCohort("lifecycle");
  const body = (name: string) => cohort.json(culture + "/" + name + ".json");
  const detail = readFormDetail(body("detail-deactivated")); const id = detail.definition.id;
  const preview = readFormDeactivationPreview(body("preview"), id);
  const deactivated = readFormDeactivation(body("deactivated"), id);
  expect(preview).toMatchObject({ revision: 2, lifecycle: { canDeactivate: true, responseCount: null, pendingApprovalCount: null, nextRecordNumber: null } });
  expect(deactivated).toMatchObject({ revision: 3, lifecycle: { revision: 3, canDeactivate: false, canReactivate: true, responseCount: null } });
  expect(detail).toMatchObject({ definition: { revision: 3 }, lifecycle: { responseCount: 1, pendingApprovalCount: 0, nextVersionNumber: 2, nextRecordNumber: detail.definition.prefix + "-000002" } });
  expect(detail.lifecycle.deactivatedAtUtc).toBe(deactivated.lifecycle.deactivatedAtUtc);
  const page = readFormPage(body("list-deactivated"));
  expect(page.items).toHaveLength(1);
  expect(page.items[0]).toMatchObject({ id, activeVersionNumber: 1, canEdit: false, lifecycle: { responseCount: null, canReactivate: true } });
  expect(readFormFacets(body("facets"))).toEqual({ active: 2, published: 1, drafts: 1, deactivated: 1 });
  const pending = readFormDetail(body("detail-reactivation-pending"));
  expect(pending).toMatchObject({ definition: { id, revision: 4 }, lifecycle: { deactivatedAtUtc: detail.lifecycle.deactivatedAtUtc, canReactivate: false, unavailableReason: "PublicationInProgress" }, publication: { currentOperation: { state: "Accepted" } } });
  expect(pending.publication.activeVersion?.versionId).toBe(detail.publication.activeVersion?.versionId);
  const reactivated = readFormDetail(body("detail-reactivated"));
  expect(reactivated).toMatchObject({ definition: { id, revision: 4 }, lifecycle: { deactivatedAtUtc: null, deactivatedBy: null, responseCount: 3, nextRecordNumber: detail.definition.prefix + "-000004" }, publication: { activeVersion: { versionNumber: 2 } } });
  expect(reactivated.publication.activeVersion?.versionId).not.toBe(detail.publication.activeVersion?.versionId);
  const affectedRaw = body("preview-affected") as { definitionId: string };
  const affected = readFormDeactivationPreview(affectedRaw, affectedRaw.definitionId);
  expect(affected.affectedSuggestions).toHaveLength(1);
  expect(affected.affectedSuggestions[0].name[culture]).toBeTruthy();
 });
 it("keeps deactivated and deleted suggestion destinations outside eligible choices in actual " + culture + " HTTP", () => {
  const cohort = httpCohort("lifecycle");
  for (const [name, state] of [["options-unavailable", "Deactivated"], ["options-deleted", "Deleted"]]) {
   const options = readSuggestionOptions(cohort.json(culture + "/" + name + ".json"));
   expect(options.unavailableDestinations).toHaveLength(1);
   const unavailable = options.unavailableDestinations[0];
   expect(unavailable.state).toBe(state); expect(unavailable.name[culture]).toBeTruthy();
   expect(options.destinations.some(destination => destination.definitionId === unavailable.definitionId)).toBe(false);
  }
 });
 it("preserves nullable private counts and authoritative channel dates in actual " + culture + " HTTP", () => {
  const cohort = httpCohort("lifecycle");
  for (const state of ["Pending", "Uncertain", "Deprecated"] as const) {
   const detail = readFormDetail(cohort.json(culture + "/status-" + state.toLowerCase() + ".json"));
   expect(detail.lifecycle).toMatchObject({ deprecationState: state, responseCount: null, pendingApprovalCount: null, nextRecordNumber: null });
   expect(detail.lifecycle.deactivatedAtUtc).not.toBeNull();
   expect(detail.lifecycle.lastOpenSessionExpiresAtUtc === null).toBe(state !== "Pending");
   expect(detail.lifecycle.deprecatedAtUtc === null).toBe(state !== "Deprecated");
  }
 });
 it("passes unchanged lifecycle bodies through real HTTP adapters in " + culture, async () => {
  const cohort = httpCohort("lifecycle"); const folder = culture + "/";
  const detail = readFormDetail(cohort.json(folder + "detail-deactivated.json")); const id = detail.definition.id;
  const route = "/api/forms/definitions/" + id;
  let posted: unknown;
  server.use(http.get(route, () => cohort.response(folder + "detail-deactivated.json")),
   http.get(route + "/deactivation", () => cohort.response(folder + "preview.json")),
   http.post(route + "/deactivation", async ({ request }) => { posted = await request.json(); return cohort.response(folder + "deactivated.json"); }),
   http.get("/api/forms/definitions/facets", () => cohort.response(folder + "facets.json")),
   http.get("/api/forms/definitions", () => cohort.response(folder + "list-deactivated.json")),
   http.delete(route, () => cohort.response(folder + "delete-responses-conflict.json", 409, { "content-type": "application/problem+json" })));
  expect(await fetchFormDefinition(id)).toEqual(detail);
  expect(await fetchFormDeactivation(id)).toEqual(readFormDeactivationPreview(cohort.json(folder + "preview.json"), id));
  expect(await deactivateForm(id, 2)).toEqual(readFormDeactivation(cohort.json(folder + "deactivated.json"), id));
  expect(posted).toEqual({ expectedRevision: 2 });
  expect(await fetchFormFacets({})).toEqual(readFormFacets(cohort.json(folder + "facets.json")));
  expect(await fetchFormDefinitions({ page: 1, pageSize: 20, publicationFilter: "Deactivated" })).toEqual(readFormPage(cohort.json(folder + "list-deactivated.json")));
  await expect(deleteForm(id, 1)).rejects.toMatchObject({ status: 409, problem: { code: "Forms.Definition.HasResponses" } });
 });
}
