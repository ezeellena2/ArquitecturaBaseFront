import { afterEach, describe, expect, it, vi } from "vitest";
import { formatExactDecimal } from "./decimal";

describe("formatExactDecimal", () => {
  it.each([
    ["125500.00", "es", "125.500,00"],
    // es-AR groups the four-digit numbers too: «$ 1.210» next to «$ 750.280», never «$ 1210».
    ["1210", "es", "1.210"],
    ["1210.5", "en", "1,210.5"],
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
  // A catalog table formats every numeric cell on every render: building two formatters per cell cost about a hundred times more.
  describe("formatter reuse", () => {
    afterEach(() => { vi.restoreAllMocks(); });
    it("builds no new number formatter for a language already used", () => {
      formatExactDecimal("1.5", "es");
      const created = vi.spyOn(Intl, "NumberFormat");
      expect(["2500.25", "-3", "-0.00", "7"].map(value => formatExactDecimal(value, "es"))).toEqual(["2.500,25", "-3", "-0,00", "7"]);
      expect(created).not.toHaveBeenCalled();
    });
  });
});
