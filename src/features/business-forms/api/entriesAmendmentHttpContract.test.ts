import { expect, it } from "vitest";
import { httpCohort } from "@/test/httpCohort";
import { readFormEntryCorrection, readFormEntrySubmitted } from "./entries";
import { responseDetailSchema, responseSheetSchema } from "./responses";

const cohort = httpCohort("entries");

// CW10-A and CW11-A: the bodies of FormRecordAmendmentHttpTests, exported with the rest of the entries cohort.
it("reads what a correction opens in both languages: the active version with the response as it was", () => {
  expect(cohort.verify().sources.some(source => source.path.endsWith("/FormRecordAmendmentHttpTests.cs"))).toBe(true);
  for (const culture of ["es", "en"] as const) {
    const correction = readFormEntryCorrection(cohort.json(`correction-${culture}.json`));
    expect(correction).toEqual(cohort.json(`correction-${culture}.json`));
    expect(correction.entry.culture).toBe(culture);
    const answer = correction.answers[0]!;
    expect(answer.options?.[0]?.id).toBe(answer.value);
  }
});

it("reads the saved correction, its row «Corregida» and its detail with the replaced version", () => {
  const saved = readFormEntrySubmitted(cohort.json("corrected-es.json"));
  const row = responseSheetSchema.parse(cohort.json("sheet-corrected-es.json")).records.items[0]!;
  expect(row).toMatchObject({ id: saved.recordId, number: saved.number, corrected: true, channel: "app" });
  for (const culture of ["es", "en"] as const) {
    const detail = responseDetailSchema.parse(cohort.json(`detail-corrected-${culture}.json`));
    expect(detail.correction).toMatchObject({ reason: "Era otro proveedor.", by: { displayName: "Juan Gómez" } });
    expect(detail.canAmend).toBeUndefined();
    expect(detail.replacedBy).toBeUndefined();
  }
  const replaced = responseDetailSchema.parse(cohort.json("detail-replaced-es.json"));
  expect(replaced.replacedBy?.recordId).toBe(saved.recordId);
  expect(replaced.correction).toBeUndefined();
});

it("reads a voided response in the sheet filtered by «Anulada» and in its detail", () => {
  const row = responseSheetSchema.parse(cohort.json("sheet-voided-es.json")).records.items[0]!;
  expect(row.state).toBe("Voided");
  const detail = responseDetailSchema.parse(cohort.json("detail-voided-es.json"));
  expect(detail.void).toMatchObject({ reason: "Cargada dos veces.", by: { displayName: "Juan Gómez" } });
  expect(detail.id).toBe(row.id);
});
