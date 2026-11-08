import { expect, it } from "vitest";
import { httpCohort } from "@/test/httpCohort";
import { responseRowsSummary } from "../responses";
import { responseDetailSchema, responseFacetSchema, responseSheetSchema } from "./responses";

// Real bytes of the joint export (FormRowsReadHttpTests). This test never manufactures captures.
it("qualifies the captures of the block of rows and their producers from the joint run", () => {
  const responses = httpCohort("responses").verify();
  const pdf = httpCohort("pdf").verify();
  for (const culture of ["es", "en"]) {
    expect(responses.captures.map(item => item.name)).toEqual(expect.arrayContaining(["rows-sheet-" + culture + ".json",
      "rows-detail-" + culture + ".json", "rows-counts-" + culture + ".json", "rows-export-" + culture + ".xlsx"]));
    expect(pdf.captures.map(item => item.name)).toEqual(expect.arrayContaining(["rows-preview-" + culture + ".pdf", "rows-preview-" + culture + ".http.json"]));
  }
  for (const manifest of [responses, pdf]) expect(manifest.sources.some(item => item.path.endsWith("/FormRowsReadHttpTests.cs"))).toBe(true);
});

it.each(["es", "en"])("reads the block in the real sheet, detail and counts (%s)", culture => {
  const cohort = httpCohort("responses");
  const sheet = responseSheetSchema.parse(cohort.json("rows-sheet-" + culture + ".json"));
  const block = sheet.columns.find(column => column.type === "group")!;
  expect(block.questions?.map(question => question.type)).toEqual(["choice", "decimal", "longText"]);
  expect(responseRowsSummary(sheet.records.items[0].cells.find(cell => cell.fieldId === block.fieldId)!)?.count).toBe(3);
  const detail = responseDetailSchema.parse(cohort.json("rows-detail-" + culture + ".json"));
  expect(detail.values.find(value => value.type === "group")?.value).toHaveLength(3);
  expect(responseFacetSchema.parse(cohort.json("rows-counts-" + culture + ".json")).items.map(item => item.count)).toEqual([1, 1]);
});

