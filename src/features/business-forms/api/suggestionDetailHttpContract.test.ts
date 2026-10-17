import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { fetchResponseDetail, responseDetailSchema } from "./responses";
it("consumes unchanged historical assistance and confirmed chains in both UI languages", async () => {
 const cohort = httpCohort("suggestionDetails"); const provenance = cohort.verify();
 expect(provenance.sources.some(source => source.path.endsWith("FormSuggestionCaptureIntegrationTests.cs"))).toBe(true);
 for (const culture of ["es", "en"] as const) {
  const name = "detail-" + culture + ".json"; const detail = responseDetailSchema.parse(cohort.json(name));
  expect(detail.assistance?.suggestion?.mode).toBe("Always");
  expect(detail.assistance?.operator?.displayName).toBe("Ana Operadora");
  expect(detail.assistance?.values).toEqual([expect.objectContaining({ included: true, changed: true, mapped: true })]);
  expect(detail.chain).toHaveLength(3);
  expect(detail.chain.some(row => row.id === detail.assistance?.suggestion?.originRecordId)).toBe(true);
  expect(detail.chain.some(row => row.id === detail.id)).toBe(true);
  server.use(http.get("/api/forms/records/" + detail.id, () => cohort.response(name)));
  expect(await fetchResponseDetail(detail.id, new AbortController().signal)).toEqual(detail);
 }
});
