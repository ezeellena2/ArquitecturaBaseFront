import { afterEach, describe, expect, it, vi } from "vitest";
import { formatNumber, formatPercent, numberFormat, numberLocale } from "./numberFormat";

// The one number format (2026-11-12): the CLDR standard of the region of each language of the app, es-AR and en-US.
describe("numberFormat", () => {
  it.each([
    ["es", 1210, "1.210"],
    ["es", 750280, "750.280"],
    ["es", 1234.5, "1.234,5"],
    ["es", -1234567.25, "-1.234.567,25"],
    ["en", 1210, "1,210"],
    ["en", 750280, "750,280"],
    ["en", 1234.5, "1,234.5"],
    ["en", -1234567.25, "-1,234,567.25"],
  ] as const)("writes a number with the region of its language: %s %d", (language, value, expected) => {
    expect(formatNumber(value, language)).toBe(expected);
  });

  it("groups the four-digit numbers in Spanish, as Argentina does and the bare es of Spain does not", () => {
    expect(formatNumber(1210, "es")).toBe("1.210");
    expect(formatNumber(12345678901234567890n, "es")).toBe("12.345.678.901.234.567.890");
  });

  it("maps each language of the app to its region, Spanish by default as the menu", () => {
    expect(numberLocale("es")).toBe("es-AR");
    expect(numberLocale("en")).toBe("en-US");
    expect(numberLocale("en-US")).toBe("en-US");
    expect(numberLocale("es-AR")).toBe("es-AR");
  });

  it("keeps the options of a size, a percent or a short number", () => {
    expect(formatNumber(1.25, "es", { maximumFractionDigits: 1 })).toBe("1,3");
    expect(formatNumber(0.18, "en", { style: "percent", maximumFractionDigits: 0 })).toBe("18%");
    expect(formatNumber(4400000, "en", { notation: "compact", maximumSignificantDigits: 2 })).toBe("4.4M");
  });

  // A percentage goes with its sign as the region writes it (2026-11-12), never glued by hand in a text: «45%» in both
  // languages, «10,5%» in Spanish.
  it("writes a share as a percentage with the region of its language", () => {
    expect(formatPercent(0.45, "es")).toBe("45%");
    expect(formatPercent(0.45, "en")).toBe("45%");
    expect(formatPercent(0.105, "es", { maximumFractionDigits: 1 })).toBe("10,5%");
    expect(formatPercent(0.105, "en", { maximumFractionDigits: 1 })).toBe("10.5%");
    expect(formatPercent(12.5, "es")).toBe("1.250%");
  });

  // A table formats every numeric cell on every render, and building a formatter costs about a hundred times more than using one.
  describe("formatter reuse", () => {
    afterEach(() => { vi.restoreAllMocks(); });
    it("builds no new formatter for a language and options already used", () => {
      formatNumber(1, "es");
      formatNumber(1, "es", { maximumFractionDigits: 1 });
      const created = vi.spyOn(Intl, "NumberFormat");
      expect([formatNumber(2500.25, "es"), formatNumber(1.25, "es", { maximumFractionDigits: 1 })]).toEqual(["2.500,25", "1,3"]);
      expect(numberFormat("es")).toBe(numberFormat("es-AR"));
      expect(created).not.toHaveBeenCalled();
    });
  });
});
