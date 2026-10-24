import { describe, expect, it } from "vitest";
import { catalogScalarText, formatCatalogValue, isCanonicalCatalogValue, parseCatalogValue, type CatalogValueType } from "./catalogValues";

describe("catalog value presentation and exact canonical input", () => {
  it.each<[CatalogValueType, string | null, string, string | null]>([
    ["Text", null, "es", null], ["Text", "", "en", null],
    ["Integer", "1.500", "es", "1500"], ["Integer", "-999,999,999,999,999,999", "en", "-999999999999999999"], ["Integer", "00012", "es", "12"],
    ["Decimal", "1.500,50", "es", "1500.5"], ["Decimal", "1500.50", "es", "1500.5"], ["Decimal", "1,500.50", "en", "1500.5"],
    ["Decimal", "9007199254740993.0123456789", "en", "9007199254740993.0123456789"],
    ["Decimal", "79228162514264337593543950335", "en", "79228162514264337593543950335"], ["Decimal", "-0,000", "es", "0"],
    ["Date", "2028-02-29", "es", "2028-02-29"], ["Date", "29/02/2028", "es", "2028-02-29"], ["Date", "02/29/2028", "en", "2028-02-29"],
  ])("parses %s input %s in %s without numeric rounding", (type, input, culture, value) => {
    expect(parseCatalogValue(type, input, culture)).toEqual({ valid: true, value });
  });
  it.each<[CatalogValueType, string]>([
    ["Text", "hidden"], ["Integer", "1000000000000000000"], ["Integer", "1,5"], ["Decimal", "1e3"], ["Decimal", "12,"],
    ["Decimal", "79228162514264337593543950336"], ["Decimal", "0.00000000000000000000000000001"], ["Date", "2026-02-29"],
  ])("rejects an invalid %s value instead of rounding or clamping %s", (type, input) => {
    expect(parseCatalogValue(type, input, "es")).toEqual({ valid: false, reason: "invalid" });
  });
  it.each(["Integer", "Decimal", "Date"] as const)("requires a value for %s", type => {
    expect(parseCatalogValue(type, "   ", "es")).toEqual({ valid: false, reason: "required" });
  });
  it("formats exact numbers and date-only values in the interface language", () => {
    expect(formatCatalogValue("Decimal", "9007199254740993.0123", "es")).toBe("9.007.199.254.740.993,0123");
    expect(formatCatalogValue("Integer", "1500", "en")).toBe("1,500");
    expect(formatCatalogValue("Date", "2026-10-22", "es")).toBe("22/10/2026");
    expect(formatCatalogValue("Text", null, "es")).toBe("");
  });
  it("shows editor text and canonical values with the shared format", () => {
    const labels = { yes: "Sí", no: "No" };
    expect(catalogScalarText("decimal", "1500,5", "es", labels, "es")).toBe("1.500,5");
    expect(catalogScalarText("integer", "1500", "en", labels)).toBe("1,500");
    expect(catalogScalarText("date", "2027-03-15", "es", labels)).toBe("15/03/2027");
    expect(catalogScalarText("boolean", "false", "es", labels)).toBe("No");
    expect(catalogScalarText("decimal", "treinta", "es", labels, "es")).toBe("treinta");
  });
  it("accepts only canonical captured values and keeps null exclusive to Text", () => {
    expect(isCanonicalCatalogValue("Text", null)).toBe(true);
    for (const [type, value] of [["Integer", "1500"], ["Decimal", "1500.5"], ["Date", "2028-02-29"]] as const) expect(isCanonicalCatalogValue(type, value)).toBe(true);
    for (const [type, value] of [["Text", "value"], ["Integer", null], ["Decimal", "1.500,5"], ["Decimal", "1.50"], ["Integer", "01"], ["Date", "29/02/2028"]] as const) expect(isCanonicalCatalogValue(type, value)).toBe(false);
  });
});
