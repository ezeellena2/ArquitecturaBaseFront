import { describe, expect, it } from "vitest";
import { formatExactDecimal } from "./decimal";

describe("formatExactDecimal", () => {
  it.each([
    ["125500.00", "es", "125.500,00"],
    ["12.375", "es", "12,375"],
    ["90071992547409931234567890123456789.12345678901234567890", "en", "90,071,992,547,409,931,234,567,890,123,456,789.12345678901234567890"],
    ["-125500.00", "en", "-125,500.00"],
    ["0", "es", "0"],
    ["0.0000000000000000000000000001", "es", "0,0000000000000000000000000001"],
    ["-0.00", "es", "-0,00"],
  ])("preserves every digit and scale of %s in %s", (value, language, expected) => {
    expect(formatExactDecimal(value, language)).toBe(expected);
  });
  it.each(["", " 1.2 ", "1e3", "NaN", "Infinity", "1,2", "01.2", "+1", "1.", ".2", "1.2private", "--2"])("rejects noncanonical decimal input without returning %s", value => {
    expect(formatExactDecimal(value, "es")).toBeNull();
  });
});
