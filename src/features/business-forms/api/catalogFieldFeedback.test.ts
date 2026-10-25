import { expect, it } from "vitest";
import { readCatalogFieldFeedback } from "./catalogFieldFeedback";

const itemId = "01990000-0000-7000-8000-000000000001";
it("keeps the failure counts and up to 50 rows with number, attempted value and reason", () => {
  const invalidRows = [
    { itemId, code: "PRV-001", row: 37, value: "30 días", reason: "invalid" },
    { itemId: "01990000-0000-7000-8000-000000000003", code: "PRV-002", row: 52, value: null, reason: "required" },
  ];
  expect(readCatalogFieldFeedback({ missingCount: 12, invalidCount: 60, convertedCount: 1200, invalidRows, private: "discarded" }))
    .toEqual({ missingCount: 12, invalidCount: 60, convertedCount: 1200, invalidRows });
});
it("keeps the uses of a field in use with the strict usage shape", () => {
  const uses = [
    { definitionId: "01990000-0000-7000-8000-000000000002", formName: "Pedir repuesto", question: "Proveedor", questionId: "01990000-0000-7000-8000-000000000004", stage: "Active" },
    { definitionId: null, formName: "Proveedores", question: null, questionId: null, stage: "Catalog" },
  ];
  expect(readCatalogFieldFeedback({ code: "Forms.Catalog.FieldInUse", detail: "El campo está en uso.", uses })).toEqual({ uses });
  const redacted = [{ definitionId: null, formName: null, question: null, questionId: null, stage: "Active" }, { definitionId: null, formName: null, question: null, questionId: null, stage: "Draft" }];
  expect(readCatalogFieldFeedback({ code: "Forms.Catalog.FieldInUse", uses: redacted })).toEqual({ uses: redacted });
  expect(readCatalogFieldFeedback({ uses: [{ ...uses[0], definitionId: null }] })).toBeNull();
  expect(readCatalogFieldFeedback({ uses: [{ ...uses[0], value: "private" }] })).toBeNull();
  // The contract has no cap: a field used by 51 forms, in their drafts and active versions, keeps its 102 uses.
  const many = Array.from({ length: 102 }, (_, index) => ({ ...uses[0], stage: index % 2 ? "Draft" : "Active" }));
  expect(readCatalogFieldFeedback({ code: "Forms.Catalog.FieldInUse", uses: many })).toEqual({ uses: many });
});
it("rejects malformed or unbounded row metadata", () => {
  const row = { itemId, code: "PRV", row: 1, value: "1", reason: "range" };
  expect(readCatalogFieldFeedback({ invalidCount: -1 })).toBeNull();
  expect(readCatalogFieldFeedback({ invalidRows: [{ ...row, itemId: "bad" }] })).toBeNull();
  expect(readCatalogFieldFeedback({ invalidRows: [{ itemId, code: "PRV" }] })).toBeNull();
  expect(readCatalogFieldFeedback({ invalidRows: [{ ...row, row: 0 }] })).toBeNull();
  expect(readCatalogFieldFeedback({ invalidRows: [{ ...row, value: "x".repeat(301) }] })).toBeNull();
  expect(readCatalogFieldFeedback({ invalidRows: [{ ...row, reason: "unknown" }] })).toBeNull();
  expect(readCatalogFieldFeedback({ invalidRows: [{ ...row, extra: "private" }] })).toBeNull();
  expect(readCatalogFieldFeedback({ invalidRows: Array.from({ length: 51 }, () => row) })).toBeNull();
  expect(readCatalogFieldFeedback({ invalidRows: [{ ...row, value: "x".repeat(300) }] })?.invalidRows).toHaveLength(1);
  expect(readCatalogFieldFeedback({ code: "Other.Error" })).toBeNull();
});
