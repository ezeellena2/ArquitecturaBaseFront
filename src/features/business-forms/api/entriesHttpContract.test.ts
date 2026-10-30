import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { httpCohort } from "@/test/httpCohort";
import { ApiError } from "@/shared/api/ApiError";
import { readFormOverview } from "./overview";
import { responseDetailSchema, responseSheetSchema } from "./responses";
import { fetchFormEntry, fetchFormEntryOptions, readFormEntry, readFormEntryOptions, readFormEntrySubmitted, submitFormEntry } from "./entries";

const cohort = httpCohort("entries");

it("qualifies the unchanged entry bodies exported by the backend for both cultures", () => {
  const provenance = cohort.verify();
  expect(provenance.sources.some(source => source.path.endsWith("/FormEntryHttpTests.cs"))).toBe(true);
});

it("reads the active version with the only option the filters leave and the missing person datum", () => {
  for (const culture of ["es", "en"]) {
    const entry = readFormEntry(cohort.json(`entry-${culture}.json`));
    expect(entry).toEqual(cohort.json(`entry-${culture}.json`));
    expect(entry.culture).toBe(culture);
    expect(entry.questions[0].catalog?.onlyOption?.title).toBe("FIRST");
    const blocked = readFormEntry(cohort.json(`entry-missing-data-${culture}.json`)).questions[0].catalog;
    expect(blocked).toEqual({ onlyOption: null, issue: "Forms.Record.RecipientDataMissing", missingData: culture === "en" ? "Zone" : "Zona" });
    expect(readFormEntryOptions(cohort.json(`options-${culture}.json`)).totalCount).toBe(1);
    expect(readFormEntrySubmitted(cohort.json(`submitted-${culture}.json`)).state).toBe("Received");
  }
});

it("reads the app origin in the sheet, the detail and the overview of who only completes forms", () => {
  for (const culture of ["es", "en"]) {
    expect(responseSheetSchema.parse(cohort.json(`sheet-app-${culture}.json`)).records.items[0].channel).toBe("app");
    expect(responseDetailSchema.parse(cohort.json(`detail-app-${culture}.json`)).origin?.channelId).toBe("app");
    const overview = readFormOverview(cohort.json(`overview-create-${culture}.json`));
    expect(overview.forms.items[0]).toMatchObject({ responseCount: null, lastResponse: null, pendingApprovalCount: null });
  }
});

it("goes through the clients with the actual bodies and keeps the conflict codes", async () => {
  const entry = readFormEntry(cohort.json("entry-es.json"));
  server.use(
    http.get(`/api/forms/entries/${entry.definitionId}`, () => cohort.response("entry-es.json")),
    http.get(`/api/forms/entries/${entry.definitionId}/versions/${entry.versionId}/questions/${entry.questions[0].fieldId}/options`, ({ request }) => {
      expect(new URL(request.url).searchParams.get("pageSize")).toBe("50");
      expect(new URL(request.url).searchParams.get("search")).toBe("lote");
      return cohort.response("options-es.json");
    }),
    http.post(`/api/forms/entries/${entry.definitionId}`, async ({ request }) => {
      const body = await request.formData();
      expect(JSON.parse(String(body.get("answers")))).toEqual([{ fieldId: entry.questions[0].fieldId, value: entry.questions[0].catalog!.onlyOption!.id }]);
      return body.get("requestId") === "00000000-0000-4000-8000-000000000001" ? cohort.response("submitted-es.json") : cohort.response("version-changed-es.json", 409);
    }),
  );
  expect(await fetchFormEntry(entry.definitionId, new AbortController().signal)).toEqual(entry);
  expect((await fetchFormEntryOptions(entry.definitionId, entry.versionId, entry.questions[0].fieldId, 1, "lote", new AbortController().signal)).items).toHaveLength(1);
  const send = { versionId: entry.versionId, answers: [{ fieldId: entry.questions[0].fieldId, value: entry.questions[0].catalog!.onlyOption!.id }], files: [] };
  expect(await submitFormEntry(entry.definitionId, { ...send, requestId: "00000000-0000-4000-8000-000000000001" }, () => {})).toEqual(cohort.json("submitted-es.json"));
  await expect(submitFormEntry(entry.definitionId, { ...send, requestId: "00000000-0000-4000-8000-000000000002" }, () => {}))
    .rejects.toSatisfy(error => error instanceof ApiError && error.status === 409 && error.code === "Forms.Entry.VersionChanged");
});

it("rejects a body outside the contract without keeping its content", () => {
  const entry = cohort.json("entry-es.json") as { questions: Record<string, unknown>[] };
  expect(() => readFormEntry({ ...entry, questions: [{ ...entry.questions[0], extra: "private" }] })).toThrow("Invalid form entry contract.");
  expect(() => readFormEntry({ ...entry, questions: [{ ...entry.questions[0], catalog: null, options: null }] })).toThrow("Invalid form entry contract.");
  void HttpResponse;
});
