import { expect, it } from "vitest";
import { httpCohort } from "@/test/httpCohort";
import { readFormEntry, readFormEntryCorrection } from "./entries";

const cohort = httpCohort("entries");

// RG2-A: the bodies of FormEntryRowsHttpTests, exported with the rest of the entries cohort: the block of an entry, the error of
// an item under its path and a correction with its items.
it("reads the block of rows of an entry, the error of an item and a correction with its items", () => {
  expect(cohort.verify().sources.some(source => source.path.endsWith("/FormEntryRowsHttpTests.cs"))).toBe(true);
  const entry = readFormEntry(cohort.json("entry-rows-es.json"));
  expect(entry).toEqual(cohort.json("entry-rows-es.json"));
  const [, group, article, quantity] = entry.questions;
  expect(group).toMatchObject({ type: "group", required: true, rows: { minRows: 1, maxRows: 3 } });
  expect([article!.repeated, quantity!.repeated]).toEqual([true, true]);

  // The error of an item comes under answers.<block>.<n>.<question>, with n from 0: here, the article of the second item.
  const rejected = cohort.json("entry-rows-error-es.json") as { code: string; errors: Record<string, string[]> };
  expect(rejected.code).toBe("Forms.Record.CatalogItemInactive");
  expect(Object.keys(rejected.errors)).toEqual([`answers.${group!.fieldId}.1.${article!.fieldId}`]);

  const correction = readFormEntryCorrection(cohort.json("correction-rows-es.json"));
  expect(correction).toEqual(cohort.json("correction-rows-es.json"));
  const block = correction.answers.find(answer => answer.fieldId === group!.fieldId);
  expect(block?.rows?.map(item => item.map(answer => answer.fieldId))).toEqual(Array.from({ length: 3 }, () => [article!.fieldId, quantity!.fieldId]));
});
