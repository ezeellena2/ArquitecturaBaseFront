import type { ComponentType } from "react";
import { HomeIcon, SettingsIcon, ShieldIcon, UsersIcon } from "@/shared/ui/icons";

interface NavigationEntry {
  /// Clave del texto en el namespace common (navigation.*).
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
}

/// Un enlace del menú: lleva a una ruta y, si declara permiso, se muestra solo a quien lo tenga.
export interface NavigationLink extends NavigationEntry {
  to: string;
  permission?: string;
}

/// Un ítem que agrupa enlaces. No tiene `to` a propósito: a un grupo no se navega, se despliega. Tampoco
/// tiene permiso propio: se ve si se ve alguno de sus hijos, que es lo mismo que decir que no hay un permiso
/// que dé acceso al grupo y no a ninguna de sus pantallas.
export interface NavigationBranch extends NavigationEntry {
  children: NavigationLink[];
}

export type NavigationItem = NavigationLink | NavigationBranch;

export interface NavigationGroup {
  labelKey: string;
  items: NavigationItem[];
}

/// Un grupo que no se lista en el menú: al pie hay un botón con su ícono, y lo que tiene adentro se abre en
/// un panel al lado (escritorio) o se despliega dentro del cajón (teléfono). Es para lo que no se usa todo el
/// día y no tiene por qué ocupar el menú de siempre.
export interface NavigationPanel extends NavigationGroup {
  icon: ComponentType<{ className?: string }>;
}

/// Un grupo desplegable y un enlace son cosas distintas, y el tipo lo dice: sin esto, `to` tendría que ser
/// opcional en todos lados y cada uso terminaría con un `!` o un `?? ""`.
export function isBranch(item: NavigationItem): item is NavigationBranch {
  return "children" in item;
}

/// Los enlaces de una lista de ítems, sin los grupos.
function linksOf(items: NavigationItem[]): NavigationLink[] {
  return items.flatMap((item) => (isBranch(item) ? item.children : [item]));
}

export const navigation: NavigationGroup[] = [
  { labelKey: "navigation.general", items: [{ labelKey: "navigation.dashboard", to: "/", icon: HomeIcon }] },
];

/// Administración no está en la lista de arriba: vive al pie del menú y se abre en su propio panel.
export const administration: NavigationPanel = {
  labelKey: "navigation.administration",
  icon: ShieldIcon,
  items: [
    {
      labelKey: "navigation.userManagement",
      icon: UsersIcon,
      children: [
        { labelKey: "navigation.users", to: "/usuarios", icon: UsersIcon, permission: "users.read" },
        { labelKey: "navigation.roles", to: "/roles", icon: ShieldIcon, permission: "roles.read" },
      ],
    },
    { labelKey: "navigation.settings", icon: SettingsIcon, children: [
      { labelKey: "navigation.settingsLanguage", to: "/configuracion/idioma", icon: SettingsIcon, permission: "settings.manage" },
      { labelKey: "navigation.settingsTimeZone", to: "/configuracion/zona-horaria", icon: SettingsIcon, permission: "settings.manage" },
      { labelKey: "navigation.settingsLists", to: "/configuracion/listados", icon: SettingsIcon, permission: "settings.manage" },
      { labelKey: "navigation.settingsRegistration", to: "/configuracion/registro", icon: SettingsIcon, permission: "settings.manage" },
    ] },
  ],
};

/// Todos los ítems que el menú puede mostrar, los del panel incluidos. El panel es otra forma de mostrarlos,
/// no otro árbol: las migas y la ruta activa no tienen por qué saber dónde está dibujado cada uno.
const allItems: NavigationItem[] = [...navigation.flatMap((group) => group.items), ...administration.items];

/// Todos los enlaces del menú, sin los grupos. Lo usan las migas y cualquiera que busque una ruta: agrupar
/// en el menú no anida las URLs, así que la ruta activa, o su padre, está siempre en esta lista plana.
export const navigationLinks: NavigationLink[] = linksOf(allItems);

/// La ruta sin la barra del final. El router abre `/roles/` como `/roles`, así que las migas y el menú tienen
/// que leerla igual: `/roles/` es el listado con una barra de más, no una hija ni una ruta que no conocen. El
/// Inicio se queda en "/".
export function withoutTrailingSlash(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

/// Si una ruta, ya sin la barra del final, es hija de la de un enlace (`/roles/abc` de `/roles`). La barra es
/// la que separa una hija de un nombre más largo (`/rolesviejos`). El Inicio no cuenta: todas las rutas
/// empiezan con "/".
function isChildOf(pathname: string, to: string): boolean {
  return to !== "/" && pathname.startsWith(`${to}/`);
}

/// Si una ruta es de alguna pantalla del enlace: la suya o una hija.
function leadsTo(pathname: string, link: NavigationLink): boolean {
  return link.to === pathname || isChildOf(pathname, link.to);
}

/// El enlace del menú del que cuelga una ruta hija, como la pantalla de un rol: el menú no la lista, pero
/// pertenece a esa sección. Las migas lo ponen como enlace, que es el camino de vuelta.
export function parentLinkOf(pathname: string): NavigationLink | undefined {
  const path = withoutTrailingSlash(pathname);

  return navigationLinks.find((link) => isChildOf(path, link.to));
}

/// El grupo al que pertenece una ruta, si está adentro de uno. Es el nivel del medio de las migas. Vale
/// también para las rutas hijas de sus pantallas: así el menú se despliega solo en `/roles/abc`.
export function branchOf(pathname: string): NavigationBranch | undefined {
  const path = withoutTrailingSlash(pathname);

  return allItems.filter(isBranch).find((branch) => branch.children.some((child) => leadsTo(path, child)));
}

/// Si una ruta vive adentro del panel de Administración. Es lo que lo abre solo al entrar y lo cierra al
/// salir: el panel se ocupa de una sección, y fuera de ella le sacaría 264 px al contenido para nada.
export function isAdministrationPath(pathname: string): boolean {
  const path = withoutTrailingSlash(pathname);

  return path === "/configuracion" || linksOf(administration.items).some((link) => leadsTo(path, link));
}
