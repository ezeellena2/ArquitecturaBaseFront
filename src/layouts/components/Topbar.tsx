import { useTranslation } from "react-i18next";
import { Breadcrumbs } from "./Breadcrumbs";
import { UserMenu } from "./UserMenu";
import { IconButton } from "@/shared/ui/IconButton";
import { MenuIcon } from "@/shared/ui/icons";

interface TopbarProps {
  /// true cuando lo que controla el botón ☰ está actualmente abierto: el cajón en móvil, la sidebar
  /// expandida en escritorio.
  sidebarExpanded: boolean;
  onToggleSidebar: () => void;
}

/// Barra superior (sección 7.2): botón ☰, migas de pan y menú del usuario. El nombre del botón ☰ queda fijo
/// (es un disclosure button típico): el estado lo anuncia aria-expanded, no el texto.
export function Topbar({ sidebarExpanded, onToggleSidebar }: TopbarProps) {
  const { t } = useTranslation();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton label={t("layout.topbar.toggle")} aria-expanded={sidebarExpanded} onClick={onToggleSidebar}>
          <MenuIcon className="size-5" />
        </IconButton>
        <Breadcrumbs />
      </div>

      <UserMenu />
    </header>
  );
}
