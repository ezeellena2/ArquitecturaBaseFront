import type { FormFolder, FormMenu, FormMenuGroup } from "./api/folders";
import type { MenuIconName } from "@/shared/ui/menuIcons";

/// What a form of the side menu opens (CM1): the sheet to whoever sees or decides responses, with «Agregar respuesta» in its
/// header if they also load; otherwise the entry to whoever loads; otherwise its design to whoever administers or reads the
/// designs. Null when the person cannot open it.
export function menuFormPath(id: string, permissions: readonly string[]): string | null {
  if (permissions.includes("formrecords.read") || permissions.includes("formapprovals.decide")) return `/formularios/${id}/respuestas`;
  if (permissions.includes("formrecords.create")) return `/formularios/${id}/cargar`;
  return permissions.includes("formtemplates.manage") || permissions.includes("formtemplates.read") ? `/formularios/${id}` : null;
}

export interface FormMenuLink { readonly id: string; readonly label: string; readonly to: string }
/// A subfolder: a group of its menu's panel.
export interface FormMenuLinkGroup { readonly id: string; readonly label: string; readonly revision: number; readonly links: readonly FormMenuLink[] }
/// A folder of the first level: a menu with its icon, its forms and a group per subfolder. `catalogCount` counts the catalogs in it
/// and in its subfolders, only for whoever administers forms.
export interface FormMenuLinkSection {
  readonly id: string;
  readonly label: string;
  readonly icon: MenuIconName;
  readonly revision: number;
  readonly catalogCount: number;
  readonly links: readonly FormMenuLink[];
  readonly groups: readonly FormMenuLinkGroup[];
}
/// The menu as the shell draws it: the folders of the first level, and whether the person administers them. The server already
/// prunes and orders it; here each form gets where it leads.
export interface FormMenuLinks { readonly canManage: boolean; readonly menus: readonly FormMenuLinkSection[] }

export function shapeFormMenu(menu: FormMenu, permissions: readonly string[]): FormMenuLinks {
  const links = (forms: FormMenuGroup["forms"]) => forms.flatMap(form => {
    const to = menuFormPath(form.id, permissions);
    return to === null ? [] : [{ id: form.id, label: form.name, to }];
  });
  return {
    canManage: menu.canManage,
    menus: menu.menus.map(section => ({
      id: section.folderId, label: section.name, icon: section.icon, revision: section.revision, catalogCount: section.catalogCount, links: links(section.forms),
      groups: section.groups.map(group => ({ id: group.folderId, label: group.name, revision: group.revision, links: links(group.forms) })),
    })),
  };
}

/// The folders of the menu as the folder dialogs take them: each menu, a folder of the first level with its icon, and each of its
/// groups, a subfolder of it.
export function menuFolders(content: Pick<FormMenuLinks, "menus">): FormFolder[] {
  return content.menus.flatMap(menu => [
    { id: menu.id, parentId: null, name: menu.label, revision: menu.revision, icon: menu.icon },
    ...menu.groups.map(group => ({ id: group.id, parentId: menu.id, name: group.label, revision: group.revision, icon: null })),
  ]);
}
