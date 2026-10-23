import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { openDraftSession } from "../draftSession";
import { readFormCommit, readFormPublicationCheck } from "./response";
import { fetchRecipientSamples, previewRecipient, readRecipientPreview, readRecipientSamples, type RecipientPreviewBody } from "./recipientPreview";

// These twelve bodies remain unmodified in the existing forms cohort from the joint export.
const cohort = httpCohort("forms");
const names = ["source-draft", "recipient-samples", "recipient-ready", "recipient-missing", "recipient-unavailable", "source-check-warnings"];
it("qualifies the recipient filter captures and their real HTTP producer", () => {
  const provenance = cohort.verify();
  for (const culture of ["es", "en"]) for (const name of names) expect(provenance.captures.some(capture => capture.name === "recipient-filters/" + name + "-" + culture + ".json")).toBe(true);
  expect(provenance.sources.some(source => source.path.endsWith("/FormRecipientFilterIntegrationTests.cs"))).toBe(true);
});
for (const culture of ["es", "en"] as const) {
  it("reads the intact " + culture + " source, samples, three recipient states and the separate nonblocking warnings", async () => {
    const file = (name: string) => "recipient-filters/" + name + "-" + culture + ".json";
    const saved = readFormCommit(cohort.json(file("source-draft")));
    const question = saved.definition.draft.fields[0]!;
    if ((question.type !== "choice" && question.type !== "multiChoice") || !question.source) throw new Error("The exported source question is missing.");
    const ready = readRecipientPreview(cohort.json(file("recipient-ready")));
    const body: RecipientPreviewBody = { type: question.type, source: question.source, sampleUserId: ready.recipient.id, culture };
    expect(ready).toEqual(cohort.json(file("recipient-ready")));
    expect(readRecipientPreview(ready, body).state).toBe("Ready");
    expect(ready.options[0]?.title).toBe("FIRST");
    expect(ready.options[0]?.description).toBeNull();
    expect(ready.recipient.values).toHaveLength(1);
    for (const [name, state] of [["recipient-missing", "RecipientDataMissing"], ["recipient-unavailable", "FilterUnavailable"]] as const) {
      const result = readRecipientPreview(cohort.json(file(name)));
      expect(result.state).toBe(state); expect(result.options).toEqual([]);
    }
    expect(readRecipientSamples(cohort.json(file("recipient-samples"))).items[0]?.id).toBe(ready.recipient.id);
    const fields = openDraftSession({ actorId: "http-contract", editorId: "recipient" }, saved.definition).value.draft.fields;
    const check = readFormPublicationCheck(cohort.json(file("source-check-warnings")), saved.definition.id, saved.definition.revision, fields);
    expect(check.issues).toEqual([]);
    expect(check.warnings.map(warning => warning.code)).toEqual(expect.arrayContaining(["Forms.Publication.OptionsPerRecipientHigh", "Forms.Publication.RecipientsWithoutData"]));
    server.use(http.get("*/api/forms/recipient-samples", () => cohort.response(file("recipient-samples"))), http.post("*/api/forms/definitions/:id/recipient-previews", () => cohort.response(file("recipient-ready"))));
    expect(await fetchRecipientSamples({ page: 1, pageSize: 20, search: "Juan" })).toEqual(cohort.json(file("recipient-samples")));
    expect(await previewRecipient(saved.definition.id, body)).toEqual(ready);
  });
}
