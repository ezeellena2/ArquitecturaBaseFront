/// ME4: the font of the whole application, from the closed list the server accepts. Each one ships with its package and only the
/// chosen one is downloaded (`loadFont`).
export const appearanceFonts = ["public-sans", "inter", "ibm-plex-sans", "source-sans-3", "hanken-grotesk", "nunito-sans"] as const;
export type AppearanceFont = (typeof appearanceFonts)[number];

export const fontFamilies: Record<AppearanceFont, string> = {
  "public-sans": "Public Sans", inter: "Inter", "ibm-plex-sans": "IBM Plex Sans", "source-sans-3": "Source Sans 3",
  "hanken-grotesk": "Hanken Grotesk", "nunito-sans": "Nunito Sans",
};

const fontLoaders: Record<AppearanceFont, () => Promise<unknown>> = {
  "public-sans": () => Promise.resolve(),
  inter: () => import("@fontsource-variable/inter"),
  "ibm-plex-sans": () => import("@fontsource-variable/ibm-plex-sans"),
  "source-sans-3": () => import("@fontsource-variable/source-sans-3"),
  "hanken-grotesk": () => import("@fontsource-variable/hanken-grotesk"),
  "nunito-sans": () => import("@fontsource-variable/nunito-sans"),
};

/// Public Sans comes with the bundle; another font downloads its stylesheet the first time it is used.
export const loadFont = (font: AppearanceFont) => fontLoaders[font]();

/// The stack of a font: its variable family first, then its name and the system ones.
export const fontStack = (font: AppearanceFont) =>
  `"${fontFamilies[font]} Variable", "${fontFamilies[font]}", ui-sans-serif, system-ui, sans-serif`;

export const isAppearanceFont = (value: unknown): value is AppearanceFont =>
  typeof value === "string" && (appearanceFonts as readonly string[]).includes(value);

export interface SystemAppearance {
  readonly primaryColor: string;
  readonly menuColor: string;
  readonly headerColor: string;
  readonly alternateRowColor: string;
  /// ME3-B: the current item of the main menu (bar, text, focus and avatar); it reads as text on the menu (4.5:1).
  readonly menuAccentColor: string;
  readonly font: AppearanceFont;
}

export type AppearanceColor = Exclude<keyof SystemAppearance, "font">;
export const appearanceColors: readonly AppearanceColor[] = ["primaryColor", "menuColor", "headerColor", "alternateRowColor", "menuAccentColor"];

export const initialAppearance: SystemAppearance = {
  primaryColor: "#285A3D", menuColor: "#24352B", headerColor: "#DFE8D9", alternateRowColor: "#F4F6F0", menuAccentColor: "#D3D7D5",
  font: "public-sans",
};

/// The minimum the server asks of the accent against the menu: it paints the name of the current item.
export const minimumMenuAccentContrast = 4.5;

export function isAppearance(value: unknown): value is SystemAppearance {
  if (!value || typeof value !== "object") return false;
  return appearanceColors.every(key => typeof (value as Record<string, unknown>)[key] === "string"
    && /^#[\da-f]{6}$/i.test((value as Record<string, string>)[key])) && isAppearanceFont((value as Record<string, unknown>).font);
}

/// Same colors and font, without telling upper from lower case.
export const sameAppearance = (first: SystemAppearance, second: SystemAppearance) =>
  appearanceColors.every(key => first[key].toUpperCase() === second[key].toUpperCase()) && first.font === second.font;

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

// The default palette leaves the approved CSS untouched (with it, the current item's text stays the menu's ink). Custom palettes
// override only color roles; a font other than the initial one, only the family.
export function appearanceVariables(appearance: SystemAppearance | undefined): Record<string, string> {
  if (!isAppearance(appearance)) return {};
  const font: Record<string, string> = appearance.font === initialAppearance.font ? {} : { "--font-sans": fontStack(appearance.font) };
  if (appearanceColors.every(key => appearance[key].toUpperCase() === initialAppearance[key])) return font;
  const { primaryColor: primary, menuColor: menu, headerColor: heading, alternateRowColor: alternate, menuAccentColor: accent } = appearance;
  const page = mix(heading, "#FFFFFF", .92);
  const control = mix(primary, "#FFFFFF", .97);
  const navInk = ink(menu);
  const hover = mix(menu, navInk === "#FFFFFF" ? "#000000" : "#FFFFFF", .07);
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
    "--color-nav-accent": accent, "--color-nav-ink": ink(accent), "--color-nav-current": accent,
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
    ...font,
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
  "--color-nav-current": "#ffffff",
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
