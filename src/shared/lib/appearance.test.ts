import { describe, expect, it } from "vitest";
import { appearanceVariables, contrastRatio, initialAppearance } from "./appearance";

describe("Global appearance", () => {
  it("preserves the approved Campo tokens without overrides", () => {
    expect(appearanceVariables(initialAppearance)).toEqual({});
  });

  it.each(["#000000", "#FFFFFF", "#FFFF00", "#777777", "#335F85", "#FF0000"])("keeps text and focus readable with %s", color => {
    const variables = appearanceVariables({ primaryColor: color, menuColor: color, headerColor: color, alternateRowColor: color });
    for (const [foreground, background] of [
      ["--primary-foreground", "--primary"], ["--color-nav-foreground", "--color-nav-surface"],
      ["--color-nav-muted", "--color-nav-hover"], ["--color-surface-header-foreground", "--color-surface-header"],
      ["--primary-foreground", "--color-primary-hover"], ["--color-brand-ink", "--color-brand-600"],
      ["--color-table-row-alternate-foreground", "--color-table-row-alternate"],
      ["--color-table-section-foreground", "--color-table-section"],
      ["--color-topbar-foreground", "--color-topbar-surface"],
    ]) expect(contrastRatio(variables[foreground], variables[background])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(variables["--color-brand-600"], "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(variables["--color-brand-500"], variables["--color-control-surface"])).toBeGreaterThanOrEqual(3);
    expect(variables["--primary"]).toBe(color);
    expect(Object.keys(variables).some(key => /danger|success|warning/.test(key))).toBe(false);
  });

  it("falls back to the initial palette for an incomplete or invalid palette", () => {
    expect(appearanceVariables(undefined)).toEqual({});
    expect(appearanceVariables({ ...initialAppearance, menuColor: "url(https://invalid)" })).toEqual({});
  });
});
