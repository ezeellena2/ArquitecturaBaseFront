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

/// Un grupo desplegable y un enlace son cosas distintas, y el tipo lo dice: sin esto, `to` tendría que ser
/// opcional en todos lados y cada uso terminaría con un `!` o un `?? ""`.
export function isBranch(item: NavigationItem): item is NavigationBranch {
  return "children" in item;
}

export const navigation: NavigationGroup[] = [
  { labelKey: "navigation.general", items: [{ labelKey: "navigation.dashboard", to: "/", icon: HomeIcon }] },
  {
    labelKey: "navigation.administration",
    items: [
      {
        labelKey: "navigation.userManagement",
        icon: UsersIcon,
        children: [
          { labelKey: "navigation.users", to: "/usuarios", icon: UsersIcon, permission: "users.read" },
          { labelKey: "navigation.roles", to: "/roles", icon: ShieldIcon, permission: "roles.read" },
        ],
      },
      { labelKey: "navigation.settings", to: "/configuracion", icon: SettingsIcon, permission: "settings.manage" },
    ],
  },
];

/// Todos los enlaces del menú, sin los grupos. Lo usan las migas y cualquiera que busque una ruta: agrupar
/// en el menú no anida las URLs, así que la ruta activa, o su padre, está siempre en esta lista plana.
export const navigationLinks: NavigationLink[] = navigation.flatMap((group) =>
  group.items.flatMap((item) => (isBranch(item) ? item.children : [item])),
);

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

  return navigation
    .flatMap((group) => group.items)
    .filter(isBranch)
    .find((branch) => branch.children.some((child) => child.to === path || isChildOf(path, child.to)));
}
