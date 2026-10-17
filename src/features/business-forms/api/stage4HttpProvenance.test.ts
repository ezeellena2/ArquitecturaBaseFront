import { expect, it } from "vitest";
import { httpCohort, type HttpCohort } from "@/test/httpCohort";
it("qualifies all form HTTP cohorts from one complete backend run with intact bytes", () => {
  const names = ["responses", "rules", "workflow", "approvals", "pdf", "whatsappActions", "whatsappForms", "suggestions", "catalogProposals", "suggestionDetails", "whatsappAudio", "missingRequests", "whatsappAssistant"] as const satisfies readonly HttpCohort[];
  const manifests = names.map(name => httpCohort(name).verify());
  const original = manifests[0];
  for (const manifest of manifests) {
    expect(manifest.runId).toBe(original.runId); expect(manifest.repositoryHead).toBe(original.repositoryHead);
    expect(manifest.generatedAtUtc).toBe(original.generatedAtUtc); expect(manifest.sourceState).toEqual(original.sourceState);
    expect(manifest.command).toBe(original.command);
    expect(manifest.command.match(/dotnet test/g)).toHaveLength(1);
  }
});
