// ME5: the tab says «screen · application name». The screen title comes from `Page`, the name from the public presentation
// (`SystemTheme`); either can arrive first, so each one sets its part and the title is composed again.
let appName = "";
let screenTitle = "";
const initialTitle = typeof document === "undefined" ? "" : document.title;

function apply() {
  if (typeof document === "undefined") return;
  document.title = [screenTitle, appName].filter(Boolean).join(" · ") || initialTitle;
}

export function setDocumentAppName(name: string | undefined) {
  appName = name?.trim() ?? "";
  apply();
}

/// Sets the screen part while the screen is shown; the returned function clears it if no other screen took its place.
export function setDocumentScreenTitle(title: string): () => void {
  screenTitle = title.trim();
  apply();
  const mine = screenTitle;
  return () => {
    if (screenTitle !== mine) return;
    screenTitle = "";
    apply();
  };
}

const defaultIcon = { href: "/favicon.svg", type: "image/svg+xml" };

/// ME5: the uploaded icon, or the one of the template without it.
export function setDocumentIcon(href: string | null) {
  if (typeof document === "undefined") return;
  const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) return;
  link.href = href ?? defaultIcon.href;
  link.type = href ? "image/png" : defaultIcon.type;
}
