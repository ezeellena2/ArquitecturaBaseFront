import { useTranslation } from "react-i18next";
import { Breadcrumbs } from "./Breadcrumbs";
import { UserMenu } from "./UserMenu";
import { IconButton } from "@/shared/ui/IconButton";
import { MenuIcon } from "@/shared/ui/icons";

interface TopbarProps {
  /// El ☰ se dibuja solo en el teléfono, donde es la única forma de abrir el cajón. En escritorio no: la
  /// flecha montada sobre el borde del menú ya lo contrae y lo expande, y dos controles para lo mismo, a
  /// treinta píxeles uno del otro, se leen como dos cosas distintas.
  isMobile: boolean;
  /// true cuando el cajón está abierto. El nombre del botón queda fijo (es un disclosure button típico): el
  /// estado lo anuncia aria-expanded, no el texto.
  drawerOpen: boolean;
  onToggleDrawer: () => void;
}

/// Barra superior (sección 7.2): migas de pan y menú del usuario, y en el teléfono el botón que abre el menú.
export function Topbar({ isMobile, drawerOpen, onToggleDrawer }: TopbarProps) {
  const { t } = useTranslation();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      <div className="flex min-w-0 items-center gap-3">
        {isMobile ? (
          <IconButton label={t("layout.topbar.toggle")} aria-expanded={drawerOpen} onClick={onToggleDrawer}>
            <MenuIcon className="size-5" />
          </IconButton>
        ) : null}
        <Breadcrumbs />
      </div>

      <UserMenu />
    </header>
  );
}
