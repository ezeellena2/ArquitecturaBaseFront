import { createContext } from "react";
import type { MenuIconName } from "@/shared/ui/menuIcons";

/// The folders in the side menu (CP5-A, 2026-11-04), already pruned, ordered and with where each form leads. The shell draws
/// them without knowing the forms module: `app` reads them and hands them over here.
export interface FolderMenuLink { readonly id: string; readonly label: string; readonly to: string }
export interface FolderMenuGroup { readonly id: string; readonly label: string; readonly links: readonly FolderMenuLink[] }
/// A menu of its own: below Inicio, with its panel, its forms and a group per subfolder.
export interface FolderMenuSection extends FolderMenuGroup { readonly icon: MenuIconName; readonly groups: readonly FolderMenuGroup[] }
export interface FolderMenuContent {
  readonly sections: readonly FolderMenuSection[];
  /// The groups that go at the end of «Gestión de formularios» and of «Administración».
  readonly formsGroups: readonly FolderMenuGroup[];
  readonly administrationGroups: readonly FolderMenuGroup[];
}
/// A form opened from the menu: while its screens are open, its panel stays open with it marked, and the breadcrumbs name the
/// menu and the form («Repartos / Hoja de ruta»). `key` tells apart the same form in two places of the menu.
export interface FolderMenuEntry {
  readonly key: string;
  readonly formId: string;
  readonly panel: string;
  readonly menuLabel: string;
  readonly formLabel: string;
}
export interface FolderMenuNavigation {
  readonly content?: FolderMenuContent;
  readonly pending: boolean;
  readonly failed: boolean;
  readonly retry: () => void;
  readonly entry: FolderMenuEntry | null;
  readonly enter: (entry: FolderMenuEntry) => void;
}
export const FolderMenuNavigationContext = createContext<FolderMenuNavigation | null>(null);

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/// Whether a path is one of the screens of the form the entry opened: its sheet (and what hangs from it) or its entry.
export function isEntryPath(pathname: string, entry: FolderMenuEntry | null): entry is FolderMenuEntry {
  return entry !== null && new RegExp(`^/formularios/${escaped(entry.formId)}/(?:respuestas|cargar)(?:/|$)`).test(pathname);
}
/// Only the sheet or the entry themselves: what hangs below keeps its own breadcrumbs.
export function isEntryScreen(pathname: string, entry: FolderMenuEntry | null): entry is FolderMenuEntry {
  return entry !== null && new RegExp(`^/formularios/${escaped(entry.formId)}/(?:respuestas|cargar)/?$`).test(pathname);
}
