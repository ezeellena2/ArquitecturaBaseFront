import { contrastRatio, hasInitialColors, initialAppearanceVariables, mix, paletteVariables, appearanceRoleVariables, type AppearanceRole, type SystemAppearance } from "./appearance";

/// ME10: the nine groups of «Colores por pieza», in the order of the screen.
export const appearanceRoleGroups = {
  menu: ["menuText", "menuHover", "menuLines", "panelSurface", "panelSelected", "topbarSurface", "topbarText", "topbarLines"],
  buttons: ["primaryText", "primaryHover", "secondarySurface", "links", "linksHover", "focus"],
  fields: ["fieldSurface", "fieldBorder", "filterSurface", "tag"],
  tables: ["headerText", "alternateText", "rowHover", "sectionRow", "sectionText", "selected"],
  surfaces: ["text", "textMuted", "headings", "lines", "pageHeader", "mutedSurface"],
  notices: ["success", "successSoft", "successStrong", "warning", "warningSoft", "warningStrong", "danger", "dangerStrong"],
  charts: ["chart1", "chart2", "chart3", "chart4", "chart5"],
  chat: ["chatBackground", "chatIncoming", "chatOutgoing", "chatText", "chatMuted", "chatRead", "chatIncomingBorder", "chatOutgoingBorder", "chatDate"],
  public: ["publicText", "publicMuted", "publicLines", "publicHeader", "publicMeadow", "publicField", "publicFooter", "publicIcon"],
} as const satisfies Record<string, readonly AppearanceRole[]>;
export type AppearanceRoleGroup = keyof typeof appearanceRoleGroups;

/// The colors a pair names besides the pieces: the five basic ones and the page.
type BaseColor = "primary" | "menu" | "header" | "alternateRow" | "menuAccent" | "canvas";
export type AppearanceColorKey = AppearanceRole | BaseColor;

const text = 4.5, graphic = 3;

/// The same pairs the server knows (`AppearanceRole.Pairs`): text over its background, field borders, focus and charts over theirs.
export const appearanceRolePairs: readonly (readonly [AppearanceColorKey, AppearanceColorKey, number])[] = [
  ["menuText", "menu", text], ["menuText", "menuHover", text], ["text", "panelSurface", text], ["text", "panelSelected", text],
  ["topbarText", "topbarSurface", text],
  ["primaryText", "primary", text], ["primaryText", "primaryHover", text], ["text", "secondarySurface", text], ["links", "canvas", text],
  ["linksHover", "canvas", text], ["focus", "canvas", graphic],
  ["text", "fieldSurface", text], ["fieldBorder", "fieldSurface", graphic], ["text", "filterSurface", text], ["text", "tag", text],
  ["headerText", "header", text], ["alternateText", "alternateRow", text], ["text", "rowHover", text], ["sectionText", "sectionRow", text],
  ["text", "selected", text],
  ["text", "canvas", text], ["textMuted", "canvas", text], ["headings", "canvas", text], ["text", "pageHeader", text], ["text", "mutedSurface", text],
  ["success", "canvas", text], ["successStrong", "successSoft", text], ["warning", "canvas", text], ["warningStrong", "warningSoft", text],
  ["danger", "canvas", text], ["dangerStrong", "canvas", text],
  ["chart1", "canvas", graphic], ["chart2", "canvas", graphic], ["chart3", "canvas", graphic], ["chart4", "canvas", graphic], ["chart5", "canvas", graphic],
  ["chatText", "chatIncoming", text], ["chatText", "chatOutgoing", text], ["chatMuted", "chatIncoming", text], ["chatMuted", "chatOutgoing", text],
  ["chatMuted", "chatDate", text], ["chatRead", "chatOutgoing", graphic],
  ["publicText", "publicMeadow", text], ["publicText", "publicFooter", text], ["publicMuted", "canvas", text], ["publicIcon", "canvas", graphic],
];

/// The pieces that do not derive from the palette: the values of `index.css` (a test keeps them equal).
export const fixedRoleColors: Partial<Record<AppearanceRole, string>> = {
  text: "#1E2B21", textMuted: "#48594D", headings: "#24402C",
  success: "#176B4C", successSoft: "#EDF5EF", successStrong: "#15553E", warning: "#86621A", warningSoft: "#FFF7DF", warningStrong: "#725418",
  danger: "#AD3443", dangerStrong: "#922B38",
  chatBackground: "#F0ECE4", chatIncoming: "#FFFFFF", chatOutgoing: "#D9EFCD", chatText: "#203227", chatMuted: "#526258", chatRead: "#126A85",
  chatIncomingBorder: "#BBC5B7", chatOutgoingBorder: "#ADC5A0", chatDate: "#FAF9F6",
  publicText: "#25292C", publicMuted: "#656C71",
};

/// The pieces that follow another one in `index.css` (`var(...)` or a `color-mix` with the headers' color and the page).
const followedRoles: Partial<Record<AppearanceRole, (color: (key: AppearanceColorKey) => string) => string>> = {
  secondarySurface: color => color("mutedSurface"), chart1: color => color("links"), chart2: color => color("success"),
  chart3: color => color("warning"), chart4: color => color("danger"), chart5: color => color("textMuted"),
  publicLines: color => mix("#FFFFFF", color("header"), .65), publicHeader: color => color("topbarSurface"),
  publicMeadow: color => color("header"), publicField: color => mix("#FFFFFF", color("header"), .48),
  publicFooter: color => mix("#FFFFFF", color("header"), .22), publicIcon: color => color("links"),
};

/// What each key paints with this appearance: the own color, or the automatic one (derived, fixed or followed).
export function appearanceColorsOf(appearance: SystemAppearance) {
  const derived = hasInitialColors(appearance) ? initialAppearanceVariables : paletteVariables(appearance);
  const base: Record<BaseColor, string> = { primary: appearance.primaryColor, menu: appearance.menuColor, header: appearance.headerColor,
    alternateRow: appearance.alternateRowColor, menuAccent: appearance.menuAccentColor, canvas: "#FFFFFF" };
  const automatic = (role: AppearanceRole): string =>
    (fixedRoleColors[role] ?? followedRoles[role]?.(color) ?? derived[appearanceRoleVariables[role][0]]).toUpperCase();
  function color(key: AppearanceColorKey): string {
    if (key in base) return base[key as BaseColor].toUpperCase();
    return (appearance.overrides[key] ?? automatic(key as AppearanceRole)).toUpperCase();
  }
  return { color, automatic };
}

/// The own pieces that do not read in a pair, with the minimum they need. Each pair is checked when one of its sides is own,
/// with the colors the application paints; when both are own, the text carries the error.
export function unreadableRoles(appearance: SystemAppearance): Partial<Record<AppearanceRole, number>> {
  const { color } = appearanceColorsOf(appearance);
  const own = (key: AppearanceColorKey) => Object.hasOwn(appearance.overrides, key);
  const unreadable: Partial<Record<AppearanceRole, number>> = {};
  for (const [foreground, background, minimum] of appearanceRolePairs) {
    if (!own(foreground) && !own(background)) continue;
    if (contrastRatio(color(foreground), color(background)) >= minimum) continue;
    const role = (own(foreground) ? foreground : background) as AppearanceRole;
    unreadable[role] ??= minimum;
  }
  return unreadable;
}
