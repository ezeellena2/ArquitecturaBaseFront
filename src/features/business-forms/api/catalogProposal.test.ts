import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { proposalCatalog, proposalCatalogId, proposalEvidence, proposalActorId } from "@/test/mocks/catalogProposal";
import { readCatalog } from "./catalogResponse";
import * as catalogs from "./catalogs";

it.each(["Pending", "Approved", "Discarded"])("reads the immutable %s proposal and original-only catalog without inventing a translation", state => {
 const response = proposalCatalog();
 response.proposal = { ...response.proposal, state, ...(state === "Pending" ? {} : { decidedBy: { userId: proposalActorId, displayName: "Laura" }, decidedAtUtc: "2026-10-17T13:00:00Z" }) };
 expect(readCatalog(response)).toEqual(response);
 expect(readCatalog(response).name).not.toHaveProperty("en");
});
it("requires the nullable proposal property and a name in at least one language of ordinary catalogs", () => {
 const response = { ...proposalCatalog(), proposal: null, name: { es: "Personas", en: "People" }, description: { es: "Personas activas", en: "Active people" } };
 expect(readCatalog(response)).toEqual(response);
 const { proposal: _removed, ...missing } = response;
 expect(() => readCatalog(missing)).toThrow("Unsupported catalog response.");
 expect(readCatalog({ ...response, name: { es: "Personas" } }).name).toEqual({ es: "Personas" });
 expect(() => readCatalog({ ...response, name: {} })).toThrow("Unsupported catalog response.");
});
it.each([
 { proposal: { ...proposalEvidence, state: "Unknown" } },
 { proposal: { ...proposalEvidence, provenance: { ...proposalEvidence.provenance, rawPrompt: "PRIVATE prompt" } } },
 { proposal: { ...proposalEvidence, originalProposal: { ...proposalEvidence.originalProposal, sql: "PRIVATE query" } } },
 { proposal: { ...proposalEvidence, originalCulture: "en" } }
])("rejects unsupported proposal content without retaining private issues: %j", changes => {
 try { readCatalog({ ...proposalCatalog(), ...changes }); expect.fail("Expected rejection"); }
 catch (error) { expect(error).toBeInstanceOf(Error); expect(JSON.stringify(error)).not.toContain("PRIVATE"); expect((error as Error).message).toBe("Unsupported catalog response."); }
});
it("approves the edited proposal in one closed command and validates its confirmed revision and state", async () => {
 const input = { expectedRevision: 1, name: { es: "Supervisores" }, description: { es: "Editado" }, filters: proposalCatalog().filters, sampleUserId: proposalActorId };
 let body: unknown;
 const approved = { ...proposalCatalog(), name: input.name, description: input.description, revision: 2, isActive: true, proposal: { ...proposalEvidence, state: "Approved", decidedBy: { userId: proposalActorId, displayName: "Ana" }, decidedAtUtc: "2026-10-17T13:00:00Z" } };
 server.use(http.post("/api/forms/catalogs/" + proposalCatalogId + "/proposal/approve", async ({ request }) => { body = await request.json(); return HttpResponse.json({ catalog: approved, itemIdentityMap: {}, fieldIdentityMap: {} }); }));
 await expect(catalogs.approveCatalogProposal(proposalCatalogId, input)).resolves.toEqual({ catalog: approved, itemIdentityMap: {}, fieldIdentityMap: {} });
 expect(body).toEqual(input);
});
it("discards by revision and retains the captured initial proposal", async () => {
 let body: unknown;
 const discarded = { ...proposalCatalog(), revision: 2, proposal: { ...proposalEvidence, state: "Discarded", decidedBy: { userId: proposalActorId, displayName: "Ana" }, decidedAtUtc: "2026-10-17T13:00:00Z" } };
 server.use(http.post("/api/forms/catalogs/" + proposalCatalogId + "/proposal/discard", async ({ request }) => { body = await request.json(); return HttpResponse.json(discarded); }));
 await expect(catalogs.discardCatalogProposal(proposalCatalogId, 1)).resolves.toEqual(discarded);
 expect(body).toEqual({ expectedRevision: 1 });
});
