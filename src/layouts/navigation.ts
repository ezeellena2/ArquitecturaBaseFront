import type { ComponentType } from "react";
import { HomeIcon, ShieldIcon, UsersIcon } from "@/shared/ui/icons";

export interface NavigationItem {
  /// Clave del texto en el namespace common (navigation.*).
  labelKey: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  /// Si está, el ítem se muestra solo a quien tenga el permiso.
  permission?: string;
  /// Ítems que existen pero todavía no tienen pantalla (Fase 4).
  hidden?: boolean;
}

export interface NavigationGroup {
  labelKey: string;
  items: NavigationItem[];
}

export const navigation: NavigationGroup[] = [
  { labelKey: "navigation.general", items: [{ labelKey: "navigation.dashboard", to: "/", icon: HomeIcon }] },
  {
    labelKey: "navigation.administration",
    items: [
      { labelKey: "navigation.users", to: "/usuarios", icon: UsersIcon, permission: "users.read" },
      { labelKey: "navigation.roles", to: "/roles", icon: ShieldIcon, permission: "roles.read", hidden: true },
    ],
  },
];
