import { describe, expect, it } from "vitest";
import { readCatalog, readCatalogFilterOptions, readCatalogFilterPreview, readCatalogItems, readCatalogPage, readCatalogPresentationCheck } from "./catalogResponse";

// Synthetic responses from the current .NET DTOs; real K4 exports qualify the contract at closure.
const id = "01990000-0000-7000-8000-000000000020";
const filters = { textColumn: "name", detailColumn: null, conditions: [{ column: "role", operator: "has", value: "01990000-0000-7000-8000-000000000601" }], excludeRecipient: true, sortColumn: "name", sortDescending: false };
const catalog = { valueType: "Text" as const, proposal: null, id, key: id.replaceAll("-", ""), name: { es: "Responsables", en: "Assignees" }, description: { es: "Personas disponibles", en: "Available people" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 0, usageCount: null, unavailableReasonCode: null, fields: [], presentation: null, presentationCheck: { cultures: [{ culture: "es", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }, { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] }] } };
const columns = [{ key: "role", dataType: "text", canDisplay: true, canFilter: true, canSort: true, operators: ["has"], choices: [{ key: "01990000-0000-7000-8000-000000000601", label: "Operario" }] }];

 describe("Current catalog response DTO", () => {
  it("requires filters:null for Manual and preserves the stored Filters definition", () => {
    expect(readCatalog({ ...catalog, filters: null })).toEqual({ ...catalog, filters: null });
    expect(() => readCatalog(catalog)).toThrow("Unsupported catalog response.");
    expect(readCatalog({ ...catalog, kind: "Filters", filters, fields: null, presentation: null, presentationCheck: null }).filters).toEqual(filters);
  });
  it("keeps a definition that became unavailable after a migration for editing", () => {
    const unavailable = { ...catalog, kind: "Filters", filters: { ...filters, textColumn: "retiredColumn" }, unavailableReasonCode: "Forms.Catalog.FilterInvalid", fields: null, presentation: null, presentationCheck: null };
    expect(readCatalog(unavailable)).toEqual(unavailable);
  });
  it("reads permitted columns and paged sample people without inventing role identities", () => {
    const response = { source: "users", columns, sampleUsers: { items: [{ id, name: "Ana Pérez" }], page: 2, pageSize: 1, totalCount: 3, totalPages: 3, hasPrevious: true, hasNext: true } };
    expect(readCatalogFilterOptions(response)).toEqual(response);
    expect(readCatalogFilterOptions({ ...response, sampleUsers: null }).sampleUsers).toBeNull();
  });
  it("reads preview items and the explicit limit result", () => {
    const response = { items: [{ id, text: "Ana Pérez", detail: null, canSend:true }], totalCount: 1, exceedsLimit: false };
    expect(readCatalogFilterPreview(response)).toEqual(response);
    expect(readCatalogFilterPreview({ items: [], totalCount: 201, exceedsLimit: true })).toEqual({ items: [], totalCount: 201, exceedsLimit: true });
  });
});

it("rejects a catalog item page with null field maps", () => {
  const fieldId = "01990000-0000-7000-8000-000000000030";
  const option = { id, code: "N", text: { es: "Norte" }, detail: {}, value: null, position: 1, isActive: true, fields: { [fieldId]: "x" }, fieldTexts: { [fieldId]: { es: "Equis" } } };
  const page = (items: unknown[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasPrevious: false, hasNext: false });
  expect(readCatalogItems(page([option]))).toEqual(page([option]));
  expect(readCatalogItems(page([{ ...option, fields: {}, fieldTexts: {} }])).items[0]).toMatchObject({ fields: {}, fieldTexts: {} });
  for (const invalid of [{ ...option, fields: null }, { ...option, fieldTexts: null }, { ...option, fields: { [fieldId]: null } }])
    expect(() => readCatalogItems(page([invalid]))).toThrow("Unsupported catalog response.");
});

it("uses the server's origin facets, independent of the current page length", () => {
  const response = { items: [{ valueType: "Text" as const, id, name: "Responsables", description: null, origin: "Filters", optionsCount: null, usageCount: null, state: "Unavailable", stateReason: "Forms.Catalog.ContentInvalid", canEdit: true }], page: 5, pageSize: 1, totalCount: 20, totalPages: 20, hasPrevious: true, hasNext: true, filterCounts: { byKind: { all: 100, manual: 80, filters: 20 } } };
  expect(readCatalogPage(response)).toEqual(response);
  const previous = { items: response.items, page: response.page, pageSize: response.pageSize, totalCount: response.totalCount, totalPages: response.totalPages, hasPrevious: response.hasPrevious, hasNext: response.hasNext };
  expect(() => readCatalogPage(previous)).toThrow("Unsupported catalog response.");
});

it("rejects a presentation check with repeated languages or more examples than problems", () => {
  const example = (n: number) => ({ itemId: "01990000-0000-7000-8000-00000000004" + n, title: "Opción " + n });
  const es = { culture: "es", titleTooLongCount: 5, titleExamples: [example(1), example(2), example(3)], descriptionTooLongCount: 1, descriptionExamples: [example(4)] };
  const en = { culture: "en", titleTooLongCount: 0, titleExamples: [], descriptionTooLongCount: 0, descriptionExamples: [] };
  const detail = (presentationCheck: unknown) => ({ ...catalog, filters: null, presentationCheck });
  expect(readCatalog(detail({ cultures: [es, en] })).presentationCheck).toEqual({ cultures: [es, en] });
  expect(readCatalogPresentationCheck({ cultures: [en] })).toEqual({ cultures: [en] });
  for (const invalid of [
    { cultures: [es, { ...es }] },
    { cultures: [{ ...en, titleExamples: [example(1)] }] },
    { cultures: [{ ...es, descriptionTooLongCount: 2 }] },
    { cultures: [{ ...es, titleExamples: [example(1), example(2), example(3), example(5)] }] },
    { cultures: [] },
    { cultures: [{ ...en, culture: "fr" }] },
    { titleTooLongCount: 0, examples: [] },
  ]) {
    expect(() => readCatalog(detail(invalid))).toThrow("Unsupported catalog response.");
    expect(() => readCatalogPresentationCheck(invalid)).toThrow("Unsupported catalog response.");
  }
});

it("accepts field uses without form names only as a complete stage-only entry", () => {
  const field = { id: "01990000-0000-7000-8000-000000000031", key: "zone", name: { es: "Zona" }, type: "text", sourceCatalogId: null, required: false, unique: false, min: null, max: null, maxLength: null, role: "filter", position: 1, isActive: true, valuesCount: 2, usedBy: [] };
  const detail = (usedBy: unknown[]) => ({ ...catalog, filters: null, fields: [{ ...field, usedBy }] });
  const hidden = { definitionId: null, formName: null, question: null, questionId: null, stage: "Draft" };
  const named = { definitionId: "01990000-0000-7000-8000-000000000032", formName: "Pedir repuesto", question: "Zona", questionId: "01990000-0000-7000-8000-000000000033", stage: "Active" };
  const usedBy = [{ ...hidden, stage: "Active" }, hidden];
  expect(readCatalog(detail(usedBy)).fields?.[0]?.usedBy).toEqual(usedBy);
  for (const partial of [{ ...named, definitionId: null, formName: null }, { ...named, formName: null }, { ...hidden, questionId: named.questionId }, { ...hidden, stage: "Catalog" }])
    expect(() => readCatalog(detail([partial]))).toThrow("Unsupported catalog response.");
});
