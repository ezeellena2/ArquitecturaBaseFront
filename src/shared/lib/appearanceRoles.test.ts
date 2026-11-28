import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { appearanceRoles, appearanceRoleVariables, contrastRatio, initialAppearance, type AppearanceRole } from "./appearance";
import { appearanceColorsOf, appearanceRoleGroups, appearanceRolePairs, fixedRoleColors, unreadableRoles } from "./appearanceRoles";

const clementina = { primaryColor: "#2B4150", menuColor: "#223340", headerColor: "#F6F2E9", alternateRowColor: "#FBF7EE",
  menuAccentColor: "#FFC10E", font: "hanken-grotesk" as const, overrides: {} };

describe("Appearance pieces (ME10)", () => {
  it("has the server's sixty pieces, each in one group, and pairs of known colors", () => {
    expect(appearanceRoles).toHaveLength(60);
    expect(Object.values(appearanceRoleGroups).flat().sort()).toEqual([...appearanceRoles].sort());
    const known = new Set<string>([...appearanceRoles, "primary", "menu", "header", "alternateRow", "menuAccent", "canvas"]);
    for (const [foreground, background, minimum] of appearanceRolePairs) {
      expect(known.has(foreground) && known.has(background)).toBe(true);
      expect([3, 4.5]).toContain(minimum);
    }
  });

  it("keeps the fixed pieces equal to the stylesheet", () => {
    const css = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");
    for (const [role, color] of Object.entries(fixedRoleColors)) {
      const variable = appearanceRoleVariables[role as AppearanceRole][0];
      const declared = new RegExp(`${variable}:\\s*(#[\\da-f]{6});`, "i").exec(css)?.[1];
      expect(declared?.toUpperCase(), variable).toBe(color);
    }
  });

  it("shows what the application paints when a piece is automatic", () => {
    const { color } = appearanceColorsOf(initialAppearance);
    expect([color("panelSurface"), color("text"), color("chart1"), color("publicMeadow"), color("secondarySurface")])
      .toEqual(["#F2F3F2", "#1E2B21", "#285A3D", "#DFE8D9", "#F2F5F3"]);
    expect(appearanceColorsOf(clementina).color("menuText")).toBe("#FFFFFF");
  });

  it("paints an own piece and moves the pieces that follow it", () => {
    const { color, automatic } = appearanceColorsOf({ ...clementina, overrides: { links: "#123456", mutedSurface: "#eeeeee" } });
    expect([color("links"), color("chart1"), color("publicIcon"), color("secondarySurface")]).toEqual(["#123456", "#123456", "#123456", "#EEEEEE"]);
    expect(automatic("links")).not.toBe("#123456");
  });

  it("keeps every automatic pair readable with the initial colors and with a brand", () => {
    for (const appearance of [initialAppearance, clementina]) {
      const { color } = appearanceColorsOf(appearance);
      for (const [foreground, background, minimum] of appearanceRolePairs)
        expect(contrastRatio(color(foreground), color(background)), `${foreground} on ${background}`).toBeGreaterThanOrEqual(minimum);
    }
  });

  it("reports the own piece that does not read, the text when both sides are own", () => {
    expect(unreadableRoles({ ...clementina, overrides: { primaryText: "#2B4150" } })).toEqual({ primaryText: 4.5 });
    expect(unreadableRoles({ ...clementina, overrides: { panelSurface: "#101010" } })).toEqual({ panelSurface: 4.5 });
    expect(unreadableRoles({ ...clementina, overrides: { chatIncoming: "#101010", chatText: "#121212" } })).toEqual({ chatText: 4.5, chatIncoming: 4.5 });
    expect(unreadableRoles({ ...clementina, overrides: { chart1: "#F0F0F0" } })).toEqual({ chart1: 3 });
    expect(unreadableRoles({ ...clementina, overrides: { panelSurface: "#FBF9F4", panelSelected: "#ECE8E0", secondarySurface: "#F6F2E9" } })).toEqual({});
  });
});
