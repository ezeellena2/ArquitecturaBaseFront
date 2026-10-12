import { describe, expect, it } from "vitest";
import type { CatalogFiltersEditorValue } from "./components/CatalogFiltersEditor";
import { catalogFiltersBody, openCatalogFilters } from "./catalogFilterDraft";

// The current .NET FormCatalogFilterDefinition uses string values; identities remain UI-only.
const edited: CatalogFiltersEditorValue = { textColumn: "name", detailColumn: "role", conditions: [
  { localId: "active-row", column: "active", operator: "equals", value: "true" },
  { localId: "role-row", column: "role", operator: "has", value: "Operario" },
], excludeRecipient: true, sortColumn: "name", sortDescending: false };
describe("Filters catalog draft and current definition DTO", () => {
  it("maps only the definition fields, keeping role membership and excluding local identities or sample context", () => {
    const body = catalogFiltersBody(edited);
    expect(body).toEqual({ textColumn: "name", detailColumn: "role", conditions: [{ column: "active", operator: "equals", value: "true" }, { column: "role", operator: "has", value: "Operario" }], excludeRecipient: true, sortColumn: "name", sortDescending: false });
    expect(JSON.stringify(body)).not.toContain("localId");
    expect(body).not.toHaveProperty("sampleUserId");
    expect(body).not.toHaveProperty("position");
  });
  it("opens saved conditions with fresh local identities without changing the stored definition", () => {
    const stored = catalogFiltersBody(edited);
    const first = openCatalogFilters(stored), second = openCatalogFilters(stored);
    expect(new Set(first.conditions.map(condition => condition.localId)).size).toBe(2);
    expect(first.conditions[0]!.localId).not.toBe(second.conditions[0]!.localId);
    expect(catalogFiltersBody(first)).toEqual(stored);
    expect(stored.conditions[0]).not.toHaveProperty("localId");
  });
});
