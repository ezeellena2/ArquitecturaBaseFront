import { describe, expect, it } from "vitest";
import { formatTypedValue, formatYesNo } from "./typedValue";

describe("typed value screen format", () => {
  it.each([
    ["integer", "1500", "es", "1.500"],
    ["integer", "1500", "en", "1,500"],
    ["decimal", "1500.5", "es", "1.500,5"],
    ["decimal", "1500.5", "en", "1,500.5"],
    ["decimal", "9007199254740993.0123", "es", "9.007.199.254.740.993,0123"],
    ["date", "2027-03-15", "es", "15/03/2027"],
    ["date", "2027-03-15", "en", "03/15/2027"],
  ] as const)("formats integers, decimals and dates with one screen format per language (%s %s in %s)", (type, value, language, expected) => {
    expect(formatTypedValue(type, value, language)).toBe(expected);
  });

  it("returns null for a value that is not canonical", () => {
    expect(formatTypedValue("decimal", "1.500,5", "es")).toBeNull();
    expect(formatTypedValue("date", "15/03/2027", "es")).toBeNull();
  });

  it("names booleans with the given labels only for true and false", () => {
    const labels = { yes: "Sí", no: "No" };
    expect(formatYesNo("true", labels)).toBe("Sí");
    expect(formatYesNo(true, labels)).toBe("Sí");
    expect(formatYesNo("false", labels)).toBe("No");
    expect(formatYesNo(false, labels)).toBe("No");
    expect(formatYesNo("x", labels)).toBeNull();
  });
});
