export interface SystemAppearance {
  readonly primaryColor: string;
  readonly menuColor: string;
  readonly headerColor: string;
  readonly alternateRowColor: string;
}

export const initialAppearance: SystemAppearance = {
  primaryColor: "#285A3D", menuColor: "#24352B", headerColor: "#DFE8D9", alternateRowColor: "#F4F6F0",
};

export function isAppearance(value: unknown): value is SystemAppearance {
  if (!value || typeof value !== "object") return false;
  return Object.keys(initialAppearance).every(key => typeof (value as Record<string, unknown>)[key] === "string"
    && /^#[\da-f]{6}$/i.test((value as Record<string, string>)[key]));
}

function channels(hex: string) {
  return [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function luminance(hex: string) {
  const rgb = channels(hex).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}

export function contrastRatio(first: string, second: string) {
  const values = [luminance(first), luminance(second)];
  return (Math.max(...values) + .05) / (Math.min(...values) + .05);
}

function ink(background: string) {
  return contrastRatio("#FFFFFF", background) >= contrastRatio("#000000", background) ? "#FFFFFF" : "#000000";
}

function mix(color: string, target: string, amount: number) {
  const destination = channels(target);
  return "#" + channels(color).map((channel, index) => Math.round(channel + (destination[index] - channel) * amount).toString(16).padStart(2, "0")).join("").toUpperCase();
}

function readable(color: string, background: string, minimum: number) {
  const target = ink(background);
  for (let step = 0; step <= 100; step++) {
    const candidate = mix(color, target, step / 100);
    if (contrastRatio(candidate, background) >= minimum) return candidate;
  }
  return target;
}

// The default palette leaves the approved CSS untouched. Custom palettes override only color roles.
export function appearanceVariables(appearance: SystemAppearance | undefined): Record<string, string> {
  if (!isAppearance(appearance) || Object.entries(initialAppearance).every(([key, value]) => appearance[key as keyof SystemAppearance].toUpperCase() === value)) return {};
  const { primaryColor: primary, menuColor: menu, headerColor: heading, alternateRowColor: alternate } = appearance;
  const page = mix(heading, "#FFFFFF", .92);
  const control = mix(primary, "#FFFFFF", .97);
  const navInk = ink(menu);
  const hover = mix(menu, navInk === "#FFFFFF" ? "#000000" : "#FFFFFF", .07);
  const accent = readable(mix(menu, ink(menu), .8), menu, 3);
  const topbar = mix(heading, "#FFFFFF", .4);
  const link = readable(primary, "#FFFFFF", 4.5);
  const section = mix(heading, "#FFFFFF", .5);
  return {
    "--primary": primary, "--primary-foreground": ink(primary),
    "--color-primary-hover": mix(primary, ink(primary) === "#FFFFFF" ? "#000000" : "#FFFFFF", .08),
    "--color-brand-50": mix(primary, "#FFFFFF", .93), "--color-brand-100": mix(primary, "#FFFFFF", .85),
    "--color-brand-600": link, "--color-brand-700": mix(link, "#000000", .15),
    "--color-brand-500": readable(primary, control, 3), "--color-brand-ink": ink(link),
    "--color-nav-surface": menu, "--color-nav-foreground": navInk, "--color-nav-muted": navInk,
    "--color-nav-hover": hover, "--color-nav-border": readable(menu, hover, 3),
    "--color-nav-accent": accent, "--color-nav-ink": ink(accent),
    "--color-subnav-surface": mix(menu, "#FFFFFF", .94), "--color-subnav-hover": mix(menu, "#FFFFFF", .86),
    "--color-topbar-surface": topbar, "--color-topbar-foreground": ink(topbar),
    "--color-topbar-muted": ink(topbar), "--color-topbar-border": mix(menu, "#FFFFFF", .7),
    "--color-page-header": page, "--color-surface-header": heading, "--color-surface-header-foreground": ink(heading),
    "--color-filter-surface": mix(primary, "#FFFFFF", .94), "--color-control-surface": control,
    "--color-control-border": readable(primary, control, 3), "--color-border": mix(menu, "#FFFFFF", .7),
    "--color-table-row-alternate": alternate, "--color-table-row-alternate-foreground": ink(alternate),
    "--color-table-row-hover": mix(primary, "#FFFFFF", .89),
    "--color-table-section": section, "--color-table-section-foreground": ink(section),
    "--color-surface-muted": mix(primary, "#FFFFFF", .94),
    "--color-tooltip-foreground": "#FFFFFF",
  };
}

// Explicit defaults keep the initial palette preview independent from a custom global palette.
export const initialAppearanceVariables: Record<string, string> = {
  "--color-primary-hover": "#255338",
  "--color-surface-header-foreground": "#000000",
  "--primary": "#285a3d",
  "--primary-foreground": "#ffffff",
  "--color-brand-50": "#f0f3f1",
  "--color-brand-100": "#dfe6e2",
  "--color-brand-600": "#285a3d",
  "--color-brand-700": "#224d34",
  "--color-brand-500": "#285a3d",
  "--color-brand-ink": "#fff",
  "--color-nav-surface": "#24352b",
  "--color-nav-foreground": "#ffffff",
  "--color-nav-muted": "#ffffff",
  "--color-nav-hover": "#213128",
  "--color-nav-border": "#6e7a73",
  "--color-nav-accent": "#d3d7d5",
  "--color-nav-ink": "#000000",
  "--color-subnav-surface": "#f2f3f2",
  "--color-subnav-hover": "#e0e3e1",
  "--color-topbar-surface": "#ecf1e8",
  "--color-topbar-foreground": "#000000",
  "--color-topbar-muted": "#000000",
  "--color-topbar-border": "#bdc2bf",
  "--color-page-header": "#fcfdfc",
  "--color-surface-header": "#dfe8d9",
  "--color-content": "#1e2b21",
  "--color-content-heading": "#24402c",
  "--color-content-muted": "#48594d",
  "--color-filter-surface": "#f2f5f3",
  "--color-control-surface": "#f9faf9",
  "--color-control-border": "#285a3d",
  "--color-border": "#879786",
  "--color-table-row-alternate": "#f4f6f0",
  "--color-table-row-alternate-foreground": "#000000",
  "--color-table-section": "#eff4ec",
  "--color-table-section-foreground": "#000000",
  "--color-table-row-hover": "#e7edea",
  "--color-surface-muted": "#f2f5f3",
  "--color-tooltip-foreground": "#fff"
};
