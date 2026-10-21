import { expect, it } from "vitest";
import { http } from "msw";
import { server } from "@/test/mocks/server";
import { httpCohort } from "@/test/httpCohort";
import { fetchResponseRecordNavigation, responseRecordNavigationSchema } from "./responses";

const cohort = httpCohort("responses");

it("qualifies unchanged anchored navigation HTTP bodies and their producer provenance", () => {
  const provenance = cohort.verify();
  expect(provenance.sources.some(source => source.path.endsWith("/FormRecordNavigationHttpTests.cs"))).toBe(true);
  for (const culture of ["es", "en"]) {
    for (const [variant, position, total] of [
      ["middle", 3, 15], ["first", 1, 15], ["last", 15, 15], ["singleton", 1, 1],
    ] as const) {
      const raw = cohort.json(`record-navigation-${variant}-${culture}.json`);
      const projection = responseRecordNavigationSchema.parse(raw);
      expect(projection).toEqual(raw);
      expect(projection.position).toBe(position);
      expect(projection.totalCount).toBe(total);
      expect(projection.previousId === null).toBe(position === 1);
      expect(projection.nextId === null).toBe(position === total);
    }
  }
});

it("reads an actual anchored response through the POST client without fetching sheet values", async () => {
  const raw = cohort.json("record-navigation-middle-es.json");
  const projection = responseRecordNavigationSchema.parse(raw);
  const formId = "0199a0c0-0000-7000-8000-000000000001";
  server.use(http.post(`/api/forms/definitions/${formId}/records/${projection.recordId}/navigation`, () => cohort.response("record-navigation-middle-es.json")));
  expect(await fetchResponseRecordNavigation(formId, projection.recordId, { page: 1, pageSize: 20 }, new AbortController().signal)).toEqual(raw);
});
