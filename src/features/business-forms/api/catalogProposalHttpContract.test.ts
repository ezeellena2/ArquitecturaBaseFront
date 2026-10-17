import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { readCatalog, readCatalogFiltersSave, readCatalogPage } from "./catalogResponse";
import { approveCatalogProposal, discardCatalogProposal, fetchCatalog } from "./catalogs";

it("qualifies both original languages and immutable proposal evidence from unchanged H4 producer bytes", () => {
 const cohort = httpCohort("catalogProposals"); const provenance = cohort.verify();
 expect(provenance.sources.some(source => source.path.endsWith("FormCatalogProposalHttpTests.cs"))).toBe(true);
 for (const culture of ["es", "en"] as const) {
  const pending = readCatalog(cohort.json("detail-pending-" + culture + ".json"));
  expect(pending.proposal?.state).toBe("Pending"); expect(pending.proposal?.originalCulture).toBe(culture);
  expect(pending.isActive).toBe(false);
  expect(Object.keys(pending.name)).toEqual([culture]);
 }
 const pending = readCatalog(cohort.json("detail-pending-en.json"));
 const approved = readCatalogFiltersSave(cohort.json("approved-en.json"), pending.id, pending.revision).catalog;
 expect(approved.proposal?.state).toBe("Approved"); expect(approved.isActive).toBe(true);
 expect(approved.proposal?.originalProposal).toEqual(pending.proposal?.originalProposal);
 expect(approved.name.en).not.toBe(pending.name.en);
 expect(approved.proposal?.decidedBy?.userId).not.toBe(approved.proposal?.requestedBy.userId);
 const list = readCatalogPage(cohort.json("list-original-en-in-es.json"));
 expect(list.items.find(row => row.id === pending.id)?.name).toBe(pending.name.en);
 const discarded = readCatalog(cohort.json("discarded-es.json"));
 expect(discarded.proposal?.state).toBe("Discarded"); expect(discarded.isActive).toBe(false);
});

it("passes the exact real proposal responses through lookup, approval, conflict and discard adapters", async () => {
 const cohort = httpCohort("catalogProposals");
 const pending = readCatalog(cohort.json("detail-pending-en.json"));
 const approved = readCatalogFiltersSave(cohort.json("approved-en.json"), pending.id, 1);
 const pendingEs = readCatalog(cohort.json("detail-pending-es.json"));
 const path = "/api/forms/catalogs/" + pending.id;
 server.use(http.get(path, () => cohort.response("detail-pending-en.json")), http.post(path + "/proposal/approve", () => cohort.response("approved-en.json")),
 http.post("/api/forms/catalogs/" + pendingEs.id + "/proposal/discard", () => cohort.response("discarded-es.json")));
 expect(await fetchCatalog(pending.id)).toEqual(pending);
 const input = { expectedRevision: 1, name: { en: approved.catalog.name.en! }, description: { en: approved.catalog.description.en! }, filters: pending.filters!, sampleUserId: pending.proposal!.requestedBy.userId };
 expect(await approveCatalogProposal(pending.id, input)).toEqual(approved);
 server.use(http.post(path + "/proposal/approve", () => cohort.response("conflict.json", 409)));
 await expect(approveCatalogProposal(pending.id, input)).rejects.toMatchObject({ status: 409, code: "Forms.Catalog.RevisionConflict" });
 expect(await discardCatalogProposal(pendingEs.id, 1)).toEqual(readCatalog(cohort.json("discarded-es.json")));
});
