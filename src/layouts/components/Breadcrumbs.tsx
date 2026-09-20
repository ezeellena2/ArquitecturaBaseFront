import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { navigation, type NavigationItem } from "../navigation";

function findActiveItem(pathname: string): NavigationItem | undefined {
  return navigation.flatMap((group) => group.items).find((item) => item.to === pathname);
}

/// Migas de pan de la barra superior (sección 7.2): "Inicio" siempre, y la página activa al lado si no es el tablero.
export function Breadcrumbs() {
  const { t } = useTranslation();
  const location = useLocation();
  const activeItem = findActiveItem(location.pathname);
  const homeLabel = t("navigation.dashboard");

  if (!activeItem || activeItem.to === "/") {
    return (
      <nav aria-label={t("layout.breadcrumbs.label")} className="min-w-0">
        <ol className="flex min-w-0 items-center gap-1.5 truncate text-sm">
          <li aria-current="page" className="truncate font-medium text-[var(--color-content)]">
            {homeLabel}
          </li>
        </ol>
      </nav>
    );
  }

  return (
    <nav aria-label={t("layout.breadcrumbs.label")} className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 truncate text-sm">
        <li className="truncate">
          <Link to="/" className="text-[var(--color-content-muted)] hover:text-[var(--color-content)] hover:underline">
            {homeLabel}
          </Link>
        </li>
        <li aria-hidden="true" className="text-[var(--color-content-muted)]">
          /
        </li>
        <li aria-current="page" className="truncate font-medium text-[var(--color-content)]">
          {t(activeItem.labelKey)}
        </li>
      </ol>
    </nav>
  );
}
