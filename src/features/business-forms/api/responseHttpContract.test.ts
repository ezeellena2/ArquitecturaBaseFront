import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { responseSheetSchema, responseDetailSchema, responseFacetSchema, fetchResponseSheet, fetchResponseDetail } from "./responses";

it("qualifies unchanged HTTP bodies and workbook from the backend producer", () => {
  const cohort = httpCohort("responses");
  expect(cohort.verify().producer).toContain("FormResponseHttpTests");
  for (const name of ["sheet-es.json", "sheet-en.json", "filtered-es.json", "files-sheet-es.json"])
    expect(responseSheetSchema.safeParse(cohort.json(name)).success, name).toBe(true);
  for (const name of ["detail-es.json", "files-detail-es.json"])
    expect(responseDetailSchema.safeParse(cohort.json(name)).success, name).toBe(true);
  expect(responseFacetSchema.safeParse(cohort.json("counts-es.json")).success).toBe(true);
  expect(cohort.bytes("export.xlsx").subarray(0, 2).toString()).toBe("PK");
});

it("reads the actual backend sheet and private file detail without replacing their shape", async () => {
  const cohort = httpCohort("responses");
  const sheet = responseSheetSchema.parse(cohort.json("sheet-es.json"));
  const detail = responseDetailSchema.parse(cohort.json("files-detail-es.json"));
  server.use(
    http.post("/api/forms/definitions/" + sheet.definitionId + "/records/search", () => cohort.response("sheet-es.json")),
    http.get("/api/forms/records/" + detail.id, () => cohort.response("files-detail-es.json")),
  );
  expect(await fetchResponseSheet(sheet.definitionId, { page: 1, pageSize: 20 }, new AbortController().signal)).toEqual(sheet);
  expect(await fetchResponseDetail(detail.id, new AbortController().signal)).toEqual(detail);
});
