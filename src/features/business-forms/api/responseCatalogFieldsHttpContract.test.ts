import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { fetchResponseDetail, fetchResponseSheet, responseDetailSchema, responseSheetSchema } from "./responses";

// All bodies remain intact; snapshots are produced by actual controller responses.
const cohort = httpCohort("responses");
const names = ["sheet", "detail", "legacy"].flatMap(kind => ["es", "en"].map(culture => `extra-fields-${kind}-${culture}.json`));
const workbooks = ["export", "visible-export"].flatMap(kind => ["es", "en"].map(culture => `extra-fields-${kind}-${culture}.xlsx`));
it("qualifies the ten historical field captures from the joint backend run", () => {
  const provenance = cohort.verify();
  expect(provenance.sources.some(source => source.path.endsWith("/FormCatalogFieldsReadHttpTests.cs"))).toBe(true);
  for (const name of [...names, ...workbooks]) expect(provenance.captures.some(capture => capture.name === name), name).toBe(true);
  for (const name of workbooks) expect(cohort.bytes(name).subarray(0, 2).toString(), name).toBe("PK");
});
for (const culture of ["es", "en"] as const) it("reads the actual " + culture + " metadata, sealed fields and older omitted snapshot", async () => {
  const sheetName = `extra-fields-sheet-${culture}.json`, detailName = `extra-fields-detail-${culture}.json`, legacyName = `extra-fields-legacy-${culture}.json`;
  const sheet = responseSheetSchema.parse(cohort.json(sheetName));
  const detail = responseDetailSchema.parse(cohort.json(detailName));
  const legacy = responseDetailSchema.parse(cohort.json(legacyName));
  expect(sheet).toEqual(cohort.json(sheetName)); expect(detail).toEqual(cohort.json(detailName)); expect(legacy).toEqual(cohort.json(legacyName));
  const column = sheet.columns.find(column => column.fields?.length);
  expect(column?.fields).toHaveLength(3);
  const historical = detail.values.find(value => value.fieldId === column?.fieldId);
  expect(historical?.value).toEqual(expect.arrayContaining([expect.objectContaining({ label: "Segundo histórico", fields: expect.arrayContaining([expect.objectContaining({ label: culture === "es" ? "Días históricos" : "Historical days", type: "integer", value: "30" })]) })]));
  const old = legacy.values.find(value => value.fieldId === column?.fieldId);
  expect(old?.value).toEqual(expect.arrayContaining([expect.not.objectContaining({ fields: expect.anything() })]));
  server.use(http.post(`/api/forms/definitions/${sheet.definitionId}/records/search`, () => cohort.response(sheetName)), http.get(`/api/forms/records/${detail.id}`, () => cohort.response(detailName)));
  const signal = new AbortController().signal;
  expect(await fetchResponseSheet(sheet.definitionId, { page: 1, pageSize: 20 }, signal)).toEqual(sheet);
  expect(await fetchResponseDetail(detail.id, signal)).toEqual(detail);
});
