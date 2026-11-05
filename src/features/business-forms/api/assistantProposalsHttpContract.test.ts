import { http } from "msw";
import { expect, it } from "vitest";
import { z } from "zod";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { createProposalCatalog, createProposalDraft, fetchProposalCatalog, fetchProposalDraft } from "./assistantProposals";
import { readCatalog } from "./catalogResponse";
import { approveManualCatalogProposal, fetchCatalog } from "./catalogs";

// Creating what a Home proposal describes (IA2): the bodies come unchanged from the joint backend export.
const cohort = httpCohort("assistantProposals");
const names = ["draft-created.json", "draft-status-created.json", "draft-status-not-created.json", "draft-name-taken.json",
  "draft-prefix-taken.json", "draft-replaced.json", "draft-unavailable.json", "draft-invalid.json", "catalog-created.json",
  "catalog-status-created.json", "catalog-detail-pending.json", "catalog-approved.json", "catalog-name-taken.json", "catalog-replaced.json"];
const proposalOf = (file: string) => z.object({ proposalId: z.uuid() }).parse(cohort.json(file)).proposalId;
const requestId = "0199a0c0-0000-7000-8000-000000000777";

it("qualifies the fourteen captures and their actual producer", () => {
  const provenance = cohort.verify();
  expect(provenance.captures.map(capture => capture.name).sort()).toEqual([...names].sort());
  for (const source of ["FormAssistantProposalHttpTests.cs", "FormAssistantProposalContractCapture.cs", "ScriptedAssistantProposalLookup.cs"])
    expect(provenance.sources.some(item => item.path.endsWith("/" + source))).toBe(true);
});

it("creates the draft once and reads whether this person created it, through the strict client", async () => {
  const proposalId = proposalOf("draft-created.json");
  server.use(
    http.post("/api/forms/definitions/assistant-proposals", () => cohort.response("draft-created.json", 201)),
    http.get("/api/forms/definitions/assistant-proposals/:id", () => cohort.response("draft-status-created.json")),
  );
  const created = await createProposalDraft({ requestId, proposalId });
  expect(created.definitionId).not.toBeNull();
  expect(await fetchProposalDraft(proposalOf("draft-status-created.json"))).toEqual({ proposalId: proposalOf("draft-status-created.json"),
    definitionId: created.definitionId });
  server.use(http.get("/api/forms/definitions/assistant-proposals/:id", () => cohort.response("draft-status-not-created.json")));
  expect((await fetchProposalDraft(proposalOf("draft-status-not-created.json"))).definitionId).toBeNull();
});

it("passes each refusal with its status and stable code, the ones the card says included", async () => {
  const refusals: [string, number, string][] = [
    ["draft-name-taken.json", 400, "Forms.Definition.NameTaken"], ["draft-prefix-taken.json", 400, "Forms.Definition.PrefixTaken"],
    ["draft-replaced.json", 409, "Forms.Definition.ProposalReplaced"], ["draft-unavailable.json", 404, "Forms.Definition.ProposalUnavailable"],
    ["draft-invalid.json", 400, "Forms.Draft.ContentInvalid"]];
  for (const [file, status, code] of refusals) {
    server.use(http.post("/api/forms/definitions/assistant-proposals", () => cohort.response(file, status)));
    await expect(createProposalDraft({ requestId, proposalId: proposalOf("draft-created.json") })).rejects.toMatchObject({ status, code });
  }
  for (const [file, status, code] of [["catalog-name-taken.json", 400, "Forms.Catalog.NameTaken"], ["catalog-replaced.json", 409, "Forms.Catalog.ProposalReplaced"]] as const) {
    server.use(http.post("/api/forms/catalogs/assistant-proposals", () => cohort.response(file, status)));
    await expect(createProposalCatalog({ requestId, proposalId: proposalOf("catalog-created.json") })).rejects.toMatchObject({ status, code });
  }
});

it("creates the Manual catalog inactive and pending, says it was asked in Home and activates it on approval", async () => {
  const proposalId = proposalOf("catalog-created.json");
  server.use(
    http.post("/api/forms/catalogs/assistant-proposals", () => cohort.response("catalog-created.json", 201)),
    http.get("/api/forms/catalogs/assistant-proposals/:id", () => cohort.response("catalog-status-created.json")),
  );
  const created = await createProposalCatalog({ requestId, proposalId });
  expect(created.catalogId).not.toBeNull();
  expect((await fetchProposalCatalog(proposalOf("catalog-status-created.json"))).catalogId).toBe(created.catalogId);
  const pending = readCatalog(cohort.json("catalog-detail-pending.json"));
  expect([pending.id, pending.kind, pending.isActive, pending.proposal?.state, pending.proposal?.requestedIn])
    .toEqual([created.catalogId, "Manual", false, "Pending", "app"]);
  server.use(
    http.get("/api/forms/catalogs/:id", () => cohort.response("catalog-detail-pending.json")),
    http.post("/api/forms/catalogs/:id/proposal/approve", () => cohort.response("catalog-approved.json")),
  );
  expect(await fetchCatalog(pending.id)).toEqual(pending);
  const approved = await approveManualCatalogProposal(pending.id, pending.revision);
  expect([approved.catalog.isActive, approved.catalog.proposal?.state]).toEqual([true, "Approved"]);
});
