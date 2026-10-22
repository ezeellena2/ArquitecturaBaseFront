import { expect, it } from "vitest";
import { readCatalog, readCatalogItems, readCatalogPage } from "./catalogResponse";
const id = "01990000-0000-7000-8000-000000000020";
const detail = { proposal: null, id, key: id.replaceAll("-", ""), name: { es: "Zonas", en: "Zones" }, description: { es: "Valor por zona", en: "Value per zone" }, kind: "Manual", valueType: "Decimal", revision: 1, isActive: true, itemsCount: 1, usageCount: null, unavailableReasonCode: null, filters: null };
const row = { id, name: "Zonas", description: null, origin: "Manual", valueType: "Decimal", optionsCount: 1, usageCount: null, state: "Active", stateReason: null, canEdit: true };
const item = { id, code: "GBA", text: { es: "GBA", en: null }, detail: { es: null, en: null }, value: "1500.5", position: 1, isActive: true };
const page = <T,>(items: T[]) => ({ items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, hasPrevious: false, hasNext: false });

it.each(["Text", "Integer", "Decimal", "Date"])("reads the required closed catalog type %s in detail and list", valueType => {
  expect(readCatalog({ ...detail, valueType }).valueType).toBe(valueType);
  expect(readCatalogPage({ ...page([{ ...row, valueType }]), filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } } }).items[0].valueType).toBe(valueType);
});
it("rejects missing, null or unknown value types without completing older bodies", () => {
  const { valueType: _type, ...missing } = detail;
  for (const body of [missing, { ...detail, valueType: null }, { ...detail, valueType: "Boolean" }]) expect(() => readCatalog(body)).toThrow("Unsupported catalog response.");
});
it("keeps Filters limited to Text", () => {
  const filters = { textColumn: "name", detailColumn: null, conditions: [], excludeRecipient: false, sortColumn: "name", sortDescending: false };
  expect(readCatalog({ ...detail, kind: "Filters", valueType: "Text", filters }).valueType).toBe("Text");
  expect(() => readCatalog({ ...detail, kind: "Filters", filters })).toThrow("Unsupported catalog response.");
  expect(() => readCatalogPage({ ...page([{ ...row, origin: "Filters" }]), filterCounts: { byKind: { all: 1, manual: 0, filters: 1 } } })).toThrow("Unsupported catalog response.");
});
it("requires each item value as a nullable string without changing its bytes", () => {
  expect(readCatalogItems(page([item])).items[0]).toEqual(item);
  expect(readCatalogItems(page([{ ...item, value: null }])).items[0].value).toBeNull();
  const { value: _value, ...missing } = item;
  for (const invalid of [missing, { ...item, value: 1500.5 }, { ...item, value: "x".repeat(65) }]) expect(() => readCatalogItems(page([invalid]))).toThrow("Unsupported catalog response.");
});
