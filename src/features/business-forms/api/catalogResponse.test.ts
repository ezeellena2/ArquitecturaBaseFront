import { describe, expect, it } from "vitest";
import { readCatalog, readCatalogFilterOptions, readCatalogFilterPreview, readCatalogPage } from "./catalogResponse";

// Synthetic responses from the current .NET DTOs; real K4 exports qualify the contract at closure.
const id = "01990000-0000-7000-8000-000000000020";
const filters = { textColumn: "name", detailColumn: null, conditions: [{ column: "role", operator: "has", value: "Operario" }], excludeRecipient: true, sortColumn: "name", sortDescending: false };
const catalog = { id, key: id.replaceAll("-", ""), name: { es: "Responsables", en: "Assignees" }, description: { es: "Personas disponibles", en: "Available people" }, kind: "Manual", revision: 1, isActive: true, itemsCount: 0, usageCount: null, unavailableReasonCode: null };
const columns = [{ key: "role", dataType: "text", canDisplay: true, canFilter: true, canSort: true, operators: ["has"], choices: [{ key: "Operario", label: "Operario" }] }];

 describe("Current catalog response DTO", () => {
  it("requires filters:null for Manual and preserves the stored Filters definition", () => {
    expect(readCatalog({ ...catalog, filters: null })).toEqual({ ...catalog, filters: null });
    expect(() => readCatalog(catalog)).toThrow("Unsupported catalog response.");
    expect(readCatalog({ ...catalog, kind: "Filters", filters }).filters).toEqual(filters);
  });
  it("keeps a definition that became unavailable after a migration for editing", () => {
    const unavailable = { ...catalog, kind: "Filters", filters: { ...filters, textColumn: "retiredColumn" }, unavailableReasonCode: "Forms.Catalog.FilterInvalid" };
    expect(readCatalog(unavailable)).toEqual(unavailable);
  });
  it("reads permitted columns and paged sample people without inventing role identities", () => {
    const response = { source: "users", columns, isAvailable: true, unavailableReasonCode: null, sampleUsers: { items: [{ id, name: "Ana Pérez" }], page: 2, pageSize: 1, totalCount: 3, totalPages: 3, hasPrevious: true, hasNext: true } };
    expect(readCatalogFilterOptions(response)).toEqual(response);
    expect(readCatalogFilterOptions({ ...response, sampleUsers: null }).sampleUsers).toBeNull();
  });
  it("reads preview items and the explicit limit result", () => {
    const response = { items: [{ id, text: "Ana Pérez", detail: null }], totalCount: 1, exceedsLimit: false };
    expect(readCatalogFilterPreview(response)).toEqual(response);
    expect(readCatalogFilterPreview({ items: [], totalCount: 201, exceedsLimit: true })).toEqual({ items: [], totalCount: 201, exceedsLimit: true });
  });
});

it("requires the source availability projection and preserves its safe reason code", () => {
  const response = { source: "users", columns, sampleUsers: null, isAvailable: false, unavailableReasonCode: "Forms.Catalog.SourceUnavailable" };
  expect(readCatalogFilterOptions(response)).toEqual(response);
  expect(() => readCatalogFilterOptions({ source: "users", columns, sampleUsers: null })).toThrow("Unsupported catalog response.");
});
it("uses the server's origin facets, independent of the current page length", () => {
  const response = { items: [{ id, name: "Responsables", description: null, origin: "Filters", optionsCount: null, usageCount: null, state: "Unavailable", stateReason: "Forms.Catalog.SourceUnavailable", canEdit: true }], page: 5, pageSize: 1, totalCount: 20, totalPages: 20, hasPrevious: true, hasNext: true, filterCounts: { byKind: { all: 100, manual: 80, filters: 20 } } };
  expect(readCatalogPage(response)).toEqual(response);
  const previous = { items: response.items, page: response.page, pageSize: response.pageSize, totalCount: response.totalCount, totalPages: response.totalPages, hasPrevious: response.hasPrevious, hasNext: response.hasNext };
  expect(() => readCatalogPage(previous)).toThrow("Unsupported catalog response.");
});
