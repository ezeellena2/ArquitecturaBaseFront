import { useContext } from "react";
import { FormsResponseNavigationContext } from "../formsNavigation";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { branchOf, isFormsPath, navigationLinks, parentLinkOf, withoutTrailingSlash } from "../navigation";
import { useCurrentBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";

/// Pantallas que no están en el menú lateral pero igual tienen migas propias: al perfil se entra desde el
/// menú del usuario. La clave del texto es la misma que usa ese menú, para que los dos digan lo mismo.
const extraLabelKeys: Record<string, string> = { "/perfil": "layout.userMenu.profile" };

const linkClassName = "text-[var(--color-content-muted)] hover:text-[var(--color-content)] hover:underline";

function findActiveLabelKey(pathname: string): string | undefined {
  return navigationLinks.find((entry) => entry.to === pathname)?.labelKey ?? extraLabelKeys[pathname];
}

function Separator() {
  return (
    <li aria-hidden="true" className="text-[var(--color-content-muted)]">
      /
    </li>
  );
}

/// Migas de pan de la barra superior (sección 7.2): "Inicio" siempre, y la página activa al lado si no es el
/// tablero. Si la página vive en un grupo desplegable del menú, el grupo va en el medio: es el único lugar,
/// junto con el menú, donde se lee a qué conjunto pertenece la pantalla. El grupo no es un enlace porque no
/// tiene ruta: agrupar en el menú no anida URLs.
///
/// Una ruta hija (`/roles/abc`) no está en el menú: la pantalla de la que cuelga va como enlace, que es el
/// camino de vuelta, y el último nivel lo pone la pantalla con `useBreadcrumbLeaf`, porque solo ella sabe
/// cómo se llama lo que muestra. Hasta que lo pone, el enlace queda último y sin `aria-current`: la página
/// actual no es el listado.
export function Breadcrumbs() {
  const { t } = useTranslation();
  // Sin la barra del final, como la lee el router: `/roles/` es el listado.
  const pathname = withoutTrailingSlash(useLocation().pathname);
  const leaf = useCurrentBreadcrumbLeaf();
  const responsePath = /^\/formularios\/(?:respuestas$|([^/]+)\/respuestas(?:\/([^/]+))?$)/.exec(pathname);
  if (responsePath) return <ResponseBreadcrumbs formId={responsePath[1]} detail={!!responsePath[2]} leaf={leaf} />;
  const activeLabelKey = pathname === "/" ? undefined : findActiveLabelKey(pathname);
  const parentLink = activeLabelKey ? undefined : parentLinkOf(pathname);
  const branchLabelKey = activeLabelKey || parentLink ? (isFormsPath(pathname) ? "navigation.forms" : branchOf(pathname)?.labelKey) : undefined;
  // En una ruta del menú, la hoja se ignora: si quedó puesta, no le agrega un nivel a una pantalla que no
  // es hija de nadie.
  const currentLabel = activeLabelKey ? t(activeLabelKey) : leaf;
  const homeLabel = t("navigation.dashboard");

  if (!activeLabelKey && !parentLink) {
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
          <Link to="/" className={linkClassName}>
            {homeLabel}
          </Link>
        </li>
        <Separator />
        {branchLabelKey ? (
          <>
            <li className="truncate text-[var(--color-content-muted)]">{t(branchLabelKey)}</li>
            <Separator />
          </>
        ) : null}
        {parentLink ? (
          <>
            <li className="truncate">
              <Link to={parentLink.to} className={linkClassName}>
                {t(parentLink.labelKey)}
              </Link>
            </li>
            {currentLabel ? <Separator /> : null}
          </>
        ) : null}
        {currentLabel ? (
          <li aria-current="page" className="truncate font-medium text-[var(--color-content)]">
            {currentLabel}
          </li>
        ) : null}
      </ol>
    </nav>
  );
}

function ResponseBreadcrumbs({formId,detail,leaf}:{formId?:string;detail:boolean;leaf?:string}) {
 const {t}=useTranslation();const navigation=useContext(FormsResponseNavigationContext);const name=navigation?.items.find(item=>item.id===formId)?.name;
 return <nav aria-label={t("layout.breadcrumbs.label")} className="min-w-0"><ol className="flex min-w-0 items-center gap-1.5 truncate text-sm"><li><Link to="/" className={linkClassName}>{t("navigation.dashboard")}</Link></li><Separator/><li><Link to="/formularios/respuestas" className={linkClassName}>{t("navigation.forms")}</Link></li><Separator/>{detail&&formId?<><li className="truncate"><Link to={`/formularios/${formId}/respuestas`} className={linkClassName}>{name??t("navigation.responses")}</Link></li><Separator/></>:null}<li aria-current="page" className="truncate font-medium">{leaf??t("navigation.responses")}</li></ol></nav>;
}
