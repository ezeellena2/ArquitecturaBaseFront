import { expect, it } from "vitest";
import { httpCohort } from "@/test/httpCohort";
import { readFormEntry } from "./entries";
import { entryZones } from "../entryForm";

const cohort = httpCohort("entries");

// CW15-B: the body of FormEntrySectionHttpTests, exported with the rest of the entries cohort.
it("reads where each section starts and opens a zone per title", () => {
  expect(cohort.verify().sources.some(source => source.path.endsWith("/FormEntrySectionHttpTests.cs"))).toBe(true);
  const entry = readFormEntry(cohort.json("entry-sections-es.json"));
  expect(entry).toEqual(cohort.json("entry-sections-es.json"));
  expect(entry.questions.map(question => question.section ?? null)).toEqual([null, "Lote", "Productos"]);
  expect(entryZones(entry).map(zone => zone.title ?? zone.key)).toEqual(["data", "Lote", "Productos"]);
});
