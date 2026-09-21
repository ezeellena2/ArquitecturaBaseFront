import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { navigation } from "../navigation";

/// Pantallas que no están en el menú lateral pero igual tienen migas propias: al perfil se entra desde el
/// menú del usuario. La clave del texto es la misma que usa ese menú, para que los dos digan lo mismo.
const extraLabelKeys: Record<string, string> = { "/perfil": "layout.userMenu.profile" };

function findActiveLabelKey(pathname: string): string | undefined {
  const item = navigation.flatMap((group) => group.items).find((entry) => entry.to === pathname);

  return item?.labelKey ?? extraLabelKeys[pathname];
}

/// Migas de pan de la barra superior (sección 7.2): "Inicio" siempre, y la página activa al lado si no es el tablero.
export function Breadcrumbs() {
  const { t } = useTranslation();
  const location = useLocation();
  const activeLabelKey = location.pathname === "/" ? undefined : findActiveLabelKey(location.pathname);
  const homeLabel = t("navigation.dashboard");

  if (!activeLabelKey) {
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
          {t(activeLabelKey)}
        </li>
      </ol>
    </nav>
  );
}
