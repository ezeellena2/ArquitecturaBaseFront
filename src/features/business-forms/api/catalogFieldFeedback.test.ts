import { expect, it } from "vitest";
import { readCatalogFieldFeedback } from "./catalogFieldFeedback";

it("keeps only safe failure counts and bounded option references", () => {
  const invalidRows = [{ itemId: "01990000-0000-7000-8000-000000000001", code: "PRV-001" }];
  expect(readCatalogFieldFeedback({ missingCount: 12, invalidCount: 60, convertedCount: 1200, invalidRows, private: "discarded" }))
    .toEqual({ missingCount: 12, invalidCount: 60, convertedCount: 1200, invalidRows });
});
it("keeps the uses of a field in use with the strict usage shape", () => {
  const uses = [
    { definitionId: "01990000-0000-7000-8000-000000000002", formName: "Pedir repuesto", question: "Proveedor", stage: "Active" },
    { definitionId: null, formName: "Proveedores", question: null, stage: "Catalog" },
  ];
  expect(readCatalogFieldFeedback({ code: "Forms.Catalog.FieldInUse", detail: "El campo está en uso.", uses })).toEqual({ uses });
  expect(readCatalogFieldFeedback({ uses: [{ ...uses[0], definitionId: null }] })).toBeNull();
  expect(readCatalogFieldFeedback({ uses: [{ ...uses[0], value: "private" }] })).toBeNull();
  expect(readCatalogFieldFeedback({ uses: Array.from({ length: 101 }, () => uses[0]) })).toBeNull();
});
it("does not expose malformed metadata or raw row values", () => {
  expect(readCatalogFieldFeedback({ invalidCount: -1 })).toBeNull();
  expect(readCatalogFieldFeedback({ invalidRows: [{ itemId: "bad", code: "PRV", value: "private" }] })).toBeNull();
  expect(readCatalogFieldFeedback({ code: "Other.Error" })).toBeNull();
});
