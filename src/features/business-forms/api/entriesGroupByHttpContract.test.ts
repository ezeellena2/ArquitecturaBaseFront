import { expect, it } from "vitest";
import { httpCohort } from "@/test/httpCohort";
import { readFormEntry, readFormEntryCorrection, readFormEntryGroups, readFormEntryOptions } from "./entries";

const cohort = httpCohort("entries");

// LD1-A: the bodies of FormEntryGroupByHttpTests, exported with the rest of the entries cohort: the questions that first ask for
// the value of a field, the values, the options of one and a correction that starts with the value of the saved option.
it("reads the questions that choose first by a field, their values, the options of one and a correction with its value", () => {
  expect(cohort.verify().sources.some(source => source.path.endsWith("/FormEntryGroupByHttpTests.cs"))).toBe(true);
  const entry = readFormEntry(cohort.json("entry-groupby-es.json"));
  expect(entry).toEqual(cohort.json("entry-groupby-es.json"));
  expect(entry.questions).toHaveLength(2);
  for (const question of entry.questions) expect(question.catalog?.groupBy).toEqual({ fieldId: expect.any(String), name: expect.any(String) });

  expect(readFormEntryGroups(cohort.json("groups-es.json"))).toEqual(cohort.json("groups-es.json"));
  expect(readFormEntryOptions(cohort.json("options-group-es.json")).totalCount).toBe(2);

  const correction = readFormEntryCorrection(cohort.json("correction-groupby-es.json"));
  expect(correction).toEqual(cohort.json("correction-groupby-es.json"));
  expect(correction.answers.flatMap(answer => answer.group ? [answer.group] : [])).toEqual([{ id: expect.any(String), text: "Sur" }]);
});
