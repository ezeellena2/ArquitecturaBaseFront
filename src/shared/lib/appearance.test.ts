import { describe, expect, it } from "vitest";
import { appearanceVariables, contrastRatio, initialAppearance, isAppearance, sameAppearance, type SystemAppearance } from "./appearance";

const palette = (color: string): SystemAppearance => ({ primaryColor: color, menuColor: color, headerColor: color, alternateRowColor: color,
  menuAccentColor: contrastRatio("#FFFFFF", color) >= contrastRatio("#000000", color) ? "#FFFFFF" : "#000000", font: "public-sans", overrides: {} });

describe("Global appearance", () => {
  it("preserves the approved Campo tokens without overrides", () => {
    expect(appearanceVariables(initialAppearance)).toEqual({});
  });

  it.each(["#000000", "#FFFFFF", "#FFFF00", "#777777", "#335F85", "#FF0000"])("keeps text and focus readable with %s", color => {
    const variables = appearanceVariables(palette(color));
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

  it.each(["#000000", "#FFFFFF", "#FFFF00", "#777777", "#335F85", "#FF0000", "#D4A20F"])("keeps the chosen option apart from the others with %s", color => {
    const variables = appearanceVariables(palette(color));
    // OE1-A: la elegida se rellena con este tono; las otras quedan blancas o, con el mouse, en el gris de superficie. La
    // fila abierta lleva una barra de este tono sobre el tinte de la marca.
    for (const background of ["#FFFFFF", variables["--color-surface-muted"], variables["--color-brand-50"]])
      expect(contrastRatio(variables["--color-brand-600"], background)).toBeGreaterThanOrEqual(3);
  });

  it("falls back to the initial palette for an incomplete or invalid palette", () => {
    expect(appearanceVariables(undefined)).toEqual({});
    expect(appearanceVariables({ ...initialAppearance, menuColor: "url(https://invalid)" })).toEqual({});
    expect(isAppearance({ ...initialAppearance, font: "comic-sans" })).toBe(false);
    expect(isAppearance({ ...initialAppearance, menuAccentColor: undefined })).toBe(false);
  });

  // ME3-B: the accent marks the current item of the main menu (bar, text, focus and avatar), as it was chosen.
  it("paints the current item of the menu with the chosen accent", () => {
    const variables = appearanceVariables({ ...initialAppearance, menuColor: "#223340", menuAccentColor: "#FFC10E" });
    expect(variables["--color-nav-accent"]).toBe("#FFC10E");
    expect(variables["--color-nav-current"]).toBe("#FFC10E");
    expect(variables["--color-nav-ink"]).toBe("#000000");
  });

  // ME10: an own piece replaces its variables; with the initial colors, over the explicit defaults so nothing else moves.
  it("paints the own pieces over the derived colors and ignores unknown keys", () => {
    const initial = appearanceVariables({ ...initialAppearance, overrides: { menuText: "#eeeeee", unknownPiece: "#ABCDEF" } });
    expect([initial["--color-nav-foreground"], initial["--color-nav-muted"], initial["--primary"]]).toEqual(["#EEEEEE", "#EEEEEE", "#285a3d"]);
    expect(Object.values(initial)).not.toContain("#ABCDEF");
    const custom = appearanceVariables({ ...initialAppearance, menuColor: "#223340", overrides: { panelSurface: "#FBF9F4" } });
    expect(custom["--color-subnav-surface"]).toBe("#FBF9F4");
    expect(custom["--color-nav-surface"]).toBe("#223340");
  });

  it("asks for the own pieces as an object of colors and compares them", () => {
    expect(isAppearance({ ...initialAppearance, overrides: undefined })).toBe(false);
    expect(isAppearance({ ...initialAppearance, overrides: { panelSurface: "red" } })).toBe(false);
    expect(sameAppearance({ ...initialAppearance, overrides: { panelSurface: "#fbf9f4" } }, { ...initialAppearance, overrides: { panelSurface: "#FBF9F4" } })).toBe(true);
    expect(sameAppearance(initialAppearance, { ...initialAppearance, overrides: { panelSurface: "#FBF9F4" } })).toBe(false);
  });

  // ME4: another font changes only the family; with the initial colors the approved CSS stays as it is.
  it("changes only the family when the font is not the initial one", () => {
    expect(appearanceVariables({ ...initialAppearance, font: "hanken-grotesk" }))
      .toEqual({ "--font-sans": '"Hanken Grotesk Variable", "Hanken Grotesk", ui-sans-serif, system-ui, sans-serif' });
    expect(appearanceVariables({ ...initialAppearance, menuColor: "#223340", font: "inter" })["--font-sans"]).toContain("Inter Variable");
  });
});
