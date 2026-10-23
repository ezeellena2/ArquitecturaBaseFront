import { expect, it } from "vitest";
import { readCatalogFieldFeedback } from "./catalogFieldFeedback";

it("keeps only safe failure counts and bounded option references", () => {
  const invalidRows = [{ itemId: "01990000-0000-7000-8000-000000000001", code: "PRV-001" }];
  expect(readCatalogFieldFeedback({ missingCount: 12, invalidCount: 60, convertedCount: 1200, invalidRows, private: "discarded" }))
    .toEqual({ missingCount: 12, invalidCount: 60, convertedCount: 1200, invalidRows });
});
it("does not expose malformed metadata or raw row values", () => {
  expect(readCatalogFieldFeedback({ invalidCount: -1 })).toBeNull();
  expect(readCatalogFieldFeedback({ invalidRows: [{ itemId: "bad", code: "PRV", value: "private" }] })).toBeNull();
  expect(readCatalogFieldFeedback({ code: "Other.Error" })).toBeNull();
});
