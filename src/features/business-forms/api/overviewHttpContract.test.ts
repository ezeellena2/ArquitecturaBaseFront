import { expect, it } from "vitest";
import { http } from "msw";
import { server } from "@/test/mocks/server";
import { httpCohort } from "@/test/httpCohort";
import { fetchFormOverview, readFormOverview } from "./overview";

const cohort = httpCohort("responses");
const variants = ["read", "decide", "combined", "pending", "deactivated"] as const;

it("qualifies the unchanged overview HTTP bodies for both cultures and all permission projections", () => {
  const provenance = cohort.verify();
  expect(provenance.sources.some(source => source.path.endsWith("/FormOverviewHttpTests.cs"))).toBe(true);
  for (const culture of ["es", "en"]) {
    for (const variant of variants) {
      const raw = cohort.json(`overview-${variant}-${culture}.json`);
      const result = readFormOverview(raw);
      expect(result).toEqual(raw);
      expect(result.forms.items).toHaveLength(1);
      const row = result.forms.items[0];
      if (variant === "decide") {
        expect(row.responseCount).toBeNull();
        expect(row.lastResponse).toBeNull();
        expect(row.pendingApprovalCount).toBe(1);
      } else {
        expect(row.responseCount).toBe(1);
        expect(row.lastResponse?.id).toEqual(expect.any(String));
      }
      if (variant === "read") {
        expect(row.pendingApprovalCount).toBeNull();
        expect(result.filterCounts.deactivatedPending).toBeNull();
      }
      if (variant === "pending") {
        expect(result.forms.totalCount).toBe(2);
        expect(result.forms.hasNext).toBe(true);
        expect(row.deactivatedAtUtc).not.toBeNull();
      }
      if (variant === "deactivated") expect(row.deactivatedAtUtc).not.toBeNull();
    }
  }
});

it("reads the actual overview body through the client without filling private nulls", async () => {
  server.use(http.get("/api/forms/overview", () => cohort.response("overview-decide-en.json")));
  expect(await fetchFormOverview({ page: 1, pageSize: 20, state: "Active" }, new AbortController().signal))
    .toEqual(cohort.json("overview-decide-en.json"));
});
