import { createContext, type RefObject } from "react";
import type { MenuIconName } from "@/shared/ui/menuIcons";

/// The folders in the side menu (CM1 a CM6, 2026-11-20), already pruned, ordered and with where each form leads. The shell draws
/// them without knowing the forms module: `app` reads them and hands them over here.
export interface FolderMenuLink { readonly id: string; readonly label: string; readonly to: string }
/// A subfolder: a group of its menu's panel.
export interface FolderMenuGroup { readonly id: string; readonly label: string; readonly revision: number; readonly links: readonly FolderMenuLink[] }
/// A folder of the first level: a menu after WhatsApp, with its icon, its panel, its forms and a group per subfolder.
/// `catalogCount` counts the catalogs in it and in its subfolders, only for whoever administers forms.
export interface FolderMenuSection {
  readonly id: string;
  readonly label: string;
  readonly icon: MenuIconName;
  readonly revision: number;
  readonly catalogCount: number;
  readonly links: readonly FolderMenuLink[];
  readonly groups: readonly FolderMenuGroup[];
}
/// `canManage`: whoever administers forms sees every folder, also the empty ones, and their actions.
export interface FolderMenuContent { readonly canManage: boolean; readonly menus: readonly FolderMenuSection[] }
/// A form opened from the menu: while its screens are open, its panel stays open with it marked, and the breadcrumbs name the
/// menu and the form («Repartos / Hoja de ruta»). `key` tells apart the same form in two places of the menu.
export interface FolderMenuEntry {
  readonly key: string;
  readonly formId: string;
  readonly panel: string;
  readonly menuLabel: string;
  readonly formLabel: string;
}
/// What whoever administers forms asks of the folders from the menu (CM2, CM4): `app` opens its dialog.
export type FolderMenuAction =
  | { readonly kind: "create" }
  | { readonly kind: "createSubfolder"; readonly parentId: string }
  | { readonly kind: "edit"; readonly folderId: string }
  | { readonly kind: "move"; readonly folderId: string }
  | { readonly kind: "delete"; readonly folderId: string }
  | { readonly kind: "addForms"; readonly folderId: string };
export interface FolderMenuNavigation {
  readonly content?: FolderMenuContent;
  readonly pending: boolean;
  readonly failed: boolean;
  readonly retry: () => void;
  readonly entry: FolderMenuEntry | null;
  readonly enter: (entry: FolderMenuEntry) => void;
  /// Only for whoever administers forms. When the dialog closes, the focus goes back to `returnFocus`, which the menu reads then:
  /// what asked for it or, if it is no longer in the document because its folder left the menu, the row «Nueva carpeta».
  readonly act?: (action: FolderMenuAction, returnFocus: RefObject<HTMLElement | null>) => void;
  /// The last folder created from the menu: its panel opens as soon as the menu brings it (in the drawer, its group).
  readonly created?: string | null;
}
export const FolderMenuNavigationContext = createContext<FolderMenuNavigation | null>(null);

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/// Whether a path is one of the screens of the form the entry opened: its sheet (and what hangs from it), its entry or its design.
export function isEntryPath(pathname: string, entry: FolderMenuEntry | null): entry is FolderMenuEntry {
  return entry !== null && new RegExp(`^/formularios/${escaped(entry.formId)}(?:/(?:respuestas|cargar)(?:/|$)|/?$)`).test(pathname);
}
/// Only the sheet, the entry or the design themselves: what hangs below keeps its own breadcrumbs.
export function isEntryScreen(pathname: string, entry: FolderMenuEntry | null): entry is FolderMenuEntry {
  return entry !== null && new RegExp(`^/formularios/${escaped(entry.formId)}(?:/(?:respuestas|cargar))?/?$`).test(pathname);
}
