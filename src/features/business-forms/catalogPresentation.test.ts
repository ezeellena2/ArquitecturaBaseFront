import { expect, it } from "vitest";
import { catalogOptionPresentation, withoutPresentationFields } from "./catalogPresentation";
import { newCatalogField } from "./catalogFields";

it("takes removed fields out of the presentation and falls back to the text title", () => {
  expect(withoutPresentationFields(null, ["zone"])).toBeNull();
  expect(withoutPresentationFields({ title: ["zone"], description: ["tax", "zone", "detail"] }, ["zone"])).toEqual({ title: ["text"], description: ["tax", "detail"] });
  expect(withoutPresentationFields({ title: ["text", "zone"], description: ["tax"] }, ["zone", "tax"])).toEqual({ title: ["text"], description: [] });
  expect(withoutPresentationFields({ title: ["code", "zone"], description: [] }, ["other"])).toEqual({ title: ["code", "zone"], description: [] });
});

const item = { localId: "row", itemId: "saved-row", code: "NORTH", label: { es: "Frío Sur", en: "South Cooling" }, detail: { es: "Disponible" }, value: null, position: 1, isActive: true, fields: { tax: "30-71234567-8", zone: "zone-option", empty: null }, fieldTexts: { zone: { es: "Centro", en: "Central" } } };
it("keeps the usual text/detail presentation when no override is configured", () => {
  expect(catalogOptionPresentation(item, null, [], "Text", "es")).toEqual({ title: "Frío Sur", description: "Disponible" });
});
it("joins only selected nonempty fields and uses source option labels without leaking other values", () => {
  expect(catalogOptionPresentation(item, { title: ["text", "code"], description: ["tax", "zone", "empty"] }, [], "Text", "en")).toEqual({ title: "South Cooling · NORTH", description: "30-71234567-8 · Central" });
});
it("matches the sent scalar presentation with the shared screen format", () => {
  const fields = [
    { ...newCatalogField("amount", 1), id: "amount", type: "decimal" as const },
    { ...newCatalogField("day", 2), id: "day", type: "date" as const },
    { ...newCatalogField("enabled", 3), id: "enabled", type: "boolean" as const },
  ];
  const row = { ...item, value: "1.500,5", fields: { amount: "2.500,75", day: "2026-10-08", enabled: "false" } };
  expect(catalogOptionPresentation(row, { title: ["value"], description: ["amount", "day", "enabled"] }, fields, "Decimal", "es", { yes: "Sí", no: "No" }))
    .toEqual({ title: "1.500,5", description: "2.500,75 · 08/10/2026 · No" });
});
it("uses the new field type after changing away from a catalog source", () => {
  const field = { ...newCatalogField("zone", 1), id: "zone", type: "text" as const };
  expect(catalogOptionPresentation(item, { title: ["zone"], description: [] }, [field], "Text", "es").title).toBe("zone-option");
});

it("formats the selected language without reparsing input in that language", () => {
  const field = { ...newCatalogField("amount", 1), id: "amount", type: "decimal" as const };
  const row = { ...item, fields: { amount: "1.234,5" } };
  expect(catalogOptionPresentation(row, { title: ["amount"], description: [] }, [field], "Text", "en", undefined, "es").title).toBe("1,234.5");
});
