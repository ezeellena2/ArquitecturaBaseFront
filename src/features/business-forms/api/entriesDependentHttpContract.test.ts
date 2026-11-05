import { expect, it } from "vitest";
import { httpCohort } from "@/test/httpCohort";
import { readFormEntry, readFormEntryOptions } from "./entries";

const cohort = httpCohort("entries");

// CW7: the bodies of FormEntryDependentListHttpTests, exported with the rest of the entries cohort.
it("reads a list that depends on another answer and the options of the chosen one", () => {
  expect(cohort.verify().sources.some(source => source.path.endsWith("/FormEntryDependentListHttpTests.cs"))).toBe(true);
  const entry = readFormEntry(cohort.json("entry-depends-es.json"));
  expect(entry).toEqual(cohort.json("entry-depends-es.json"));
  const [zone, supplier] = entry.questions;
  expect(zone!.catalog).toEqual({ onlyOption: null, issue: null, missingData: null });
  expect(supplier!.catalog).toEqual({ onlyOption: null, issue: null, missingData: null, dependsOn: [zone!.fieldId] });
  expect(readFormEntryOptions(cohort.json("options-depends-es.json")).totalCount).toBe(2);
});
