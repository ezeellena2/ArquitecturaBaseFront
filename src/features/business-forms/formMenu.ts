import type { FormMenu, FormMenuGroup } from "./api/folders";
import type { MenuIconName } from "@/shared/ui/menuIcons";

/// What a form of the side menu opens (CP5-A): the sheet to whoever sees or decides responses, with «Cargar» in its header, and
/// the entry to whoever only loads. Null when the person cannot open it.
export function menuFormPath(id: string, permissions: readonly string[]): string | null {
  if (permissions.includes("formrecords.read") || permissions.includes("formapprovals.decide")) return `/formularios/${id}/respuestas`;
  return permissions.includes("formrecords.create") ? `/formularios/${id}/cargar` : null;
}

export interface FormMenuLink { readonly id: string; readonly label: string; readonly to: string }
export interface FormMenuLinkGroup { readonly id: string; readonly label: string; readonly links: readonly FormMenuLink[] }
export interface FormMenuLinkSection extends FormMenuLinkGroup { readonly icon: MenuIconName; readonly groups: readonly FormMenuLinkGroup[] }
/// The menu as the shell draws it: the menus of their own, and the groups that go at the end of «Gestión de formularios» and of
/// «Administración». The server already prunes and orders it; here each form gets where it leads.
export interface FormMenuLinks {
  readonly sections: readonly FormMenuLinkSection[];
  readonly formsGroups: readonly FormMenuLinkGroup[];
  readonly administrationGroups: readonly FormMenuLinkGroup[];
}

export function shapeFormMenu(menu: FormMenu, permissions: readonly string[]): FormMenuLinks {
  if (menuFormPath("", permissions) === null) return { sections: [], formsGroups: [], administrationGroups: [] };
  const links = (forms: FormMenuGroup["forms"]) => forms.map(form => ({ id: form.id, label: form.name, to: menuFormPath(form.id, permissions) ?? "" }));
  const group = (source: FormMenuGroup): FormMenuLinkGroup => ({ id: source.folderId, label: source.name, links: links(source.forms) });
  return {
    sections: menu.menus.map(section => ({ id: section.folderId, label: section.name, icon: section.icon, links: links(section.forms), groups: section.groups.map(group) })),
    formsGroups: menu.forms.map(group),
    administrationGroups: menu.administration.map(group),
  };
}
