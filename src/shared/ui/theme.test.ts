/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync("src/index.css", "utf8");
const theme = /@theme\s*\{([\s\S]*?)\}/u.exec(stylesheet)?.[1] ?? "";
const tokens = new Map([...theme.matchAll(/(--[\w-]+):\s*(#[\da-f]{3,6}|var\(--[\w-]+\))\s*;/giu)]
  .map((match) => [match[1], match[2]]));

function token(name: string): string {
  const value = tokens.get(name);
  if (!value) throw new Error(`Missing theme token: ${name}`);
  return value.startsWith("var(") ? token(value.slice(4, -1)) : value;
}

function luminance(color: string): number {
  const hex = color.length === 4 ? color.slice(1).split("").map((digit) => digit + digit).join("") : color.slice(1);
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string): number {
  const values = [luminance(token(first)), luminance(token(second))];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

describe("The shared theme", () => {
  it.each([
    ["--color-nav-foreground", "--color-nav-surface"],
    ["--color-nav-muted", "--color-nav-surface"],
    ["--color-nav-foreground", "--color-nav-hover"],
    ["--color-nav-ink", "--color-nav-accent"],
    ["--color-content-muted", "--color-subnav-surface"],
    ["--color-content", "--color-subnav-hover"],
    ["--color-topbar-foreground", "--color-topbar-surface"],
    ["--color-topbar-muted", "--color-topbar-surface"],
    ["--color-content", "--color-page-header"],
    ["--color-content-muted", "--color-filter-surface"],
    ["--color-content-heading", "--color-surface-header"],
    ["--color-content-muted", "--color-control-surface"],
    ["--color-brand-ink", "--color-brand-600"],
    ["--color-danger", "--color-control-surface"],
    ["--color-success-700", "--color-success-50"],
    ["--color-warning-700", "--color-warning-50"],
  ])("keeps normal text readable: %s on %s", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["--color-nav-accent", "--color-nav-surface"],
    ["--color-brand-500", "--color-control-surface"],
    ["--color-control-border", "--color-control-surface"],
  ])("keeps focus and controls distinguishable: %s on %s", (foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
  });
});
