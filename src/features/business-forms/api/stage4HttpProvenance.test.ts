import { expect, it } from "vitest";
import { httpCohort, type HttpCohort } from "@/test/httpCohort";
it("qualifies the 23 HTTP cohorts of the joint export from one complete backend run with intact bytes", () => {
  const names = ["personData", "responses", "rules", "workflow", "approvals", "pdf", "whatsappActions", "whatsappForms", "suggestions", "catalogProposals", "suggestionDetails", "whatsappAudio", "missingRequests", "whatsappAssistant", "forms", "lifecycle", "catalogImports", "manualCatalogs", "catalogFilters", "catalogSource", "formFiles", "whatsappCatalogs", "aiAssistant"] as const satisfies readonly HttpCohort[];
  expect(new Set(names).size).toBe(23);
  const manifests = names.map(name => httpCohort(name).verify());
  const original = manifests[0];
  for (const manifest of manifests) {
    expect(manifest.runId).toBe(original.runId); expect(manifest.repositoryHead).toBe(original.repositoryHead);
    expect(manifest.generatedAtUtc).toBe(original.generatedAtUtc); expect(manifest.sourceState).toEqual(original.sourceState);
    expect(manifest.command).toBe(original.command);
    expect(manifest.command.match(/dotnet test/g)).toHaveLength(1);
  }
});
