import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";
import { branchOf, isBranch, navigation, type NavigationBranch, type NavigationItem, type NavigationLink } from "../navigation";
import { accountDetailOf, accountNameOf, initialOf } from "@/auth/accountName";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { usePermissions } from "@/auth/usePermissions";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ChevronDownIcon, ChevronLeftIcon, RefreshIcon } from "@/shared/ui/icons";
import { IconButton } from "@/shared/ui/IconButton";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/// Un ítem de navegación. Contraído, solo el ícono (con Tooltip) y el texto queda para el lector de pantalla.
/// Adentro de un submenú va sin ícono: lo dicen la sangría y la guía vertical, y el ícono del padre ya
/// representa al grupo. El del hijo sigue existiendo en el modelo porque la barra contraída lo usa.
function NavItem({
  item,
  label,
  collapsed,
  showIcon = true,
  onNavigate,
}: {
  item: NavigationLink;
  label: string;
  collapsed: boolean;
  showIcon?: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  const link = (
    <NavLink
      to={item.to}
      end={item.to === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
            : "text-[var(--color-content-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)]",
          collapsed ? "size-10 justify-center px-0" : "",
        )
      }
    >
      {showIcon ? <Icon className="size-5 shrink-0" /> : null}
      {collapsed ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
    </NavLink>
  );

  if (!collapsed) {
    return link;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/// Un grupo desplegable. El padre es un `button` con `aria-expanded`, no un enlace: a un grupo no se navega.
/// Plegado, sus hijos no se dibujan; el menú tiene que decir dónde se puede ir, no listarlo todo siempre.
function NavBranch({
  branch,
  label,
  open,
  onToggle,
  translate,
  onNavigate,
}: {
  branch: NavigationBranch;
  label: string;
  open: boolean;
  onToggle: () => void;
  translate: (key: string) => string;
  onNavigate?: () => void;
}) {
  const Icon = branch.icon;
  const listId = useId();

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={onToggle}
        className="flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium text-[var(--color-content-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)]"
      >
        <Icon className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        <ChevronDownIcon
          aria-hidden="true"
          className={cn("size-4 shrink-0 transition-transform", open ? "" : "-rotate-90")}
        />
      </button>
      {open ? (
        // La guía arranca bajo el centro del ícono del padre (px-3 más medio ícono de 20), que es lo que
        // ata visualmente los hijos al grupo.
        <ul id={listId} className="mt-1 ml-[22px] flex flex-col gap-1 border-l border-[var(--color-border)] pl-3">
          {branch.children.map((child) => (
            <li key={child.to}>
              <NavItem
                item={child}
                label={translate(child.labelKey)}
                collapsed={false}
                showIcon={false}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/// Los ítems que esta persona puede ver, con los hijos de cada grupo ya filtrados. Un grupo se ve si se ve
/// alguno de sus hijos: no hay permiso que dé acceso al grupo y a ninguna de sus pantallas.
/// Contraída, los grupos desaparecen y sus hijos suben a la lista: la barra contraída es un lanzador, no un
/// mapa, y esconder destinos detrás de un desplegable de 40px sería cambiar un clic por dos.
/// Mientras los permisos no llegaron se muestran todos: filtrarlos igual haría desaparecer medio menú para
/// devolverlo de golpe, que es peor que el spinner que esto reemplaza.
function visibleItems(items: NavigationItem[], canSee: (link: NavigationLink) => boolean, iconsOnly: boolean) {
  return items.flatMap<NavigationItem>((item) => {
    if (!isBranch(item)) {
      return canSee(item) ? [item] : [];
    }

    const children = item.children.filter(canSee);

    if (children.length === 0) {
      return [];
    }

    return iconsOnly ? children : [{ ...item, children }];
  });
}

/// Si el ítem puede llegar a no verse, mientras los permisos no llegan ocupa su lugar un bloque de carga.
/// Un grupo lo reserva solo si todos sus hijos dependen de un permiso: si alguno no, el grupo se ve seguro.
function dependsOnPermissions(item: NavigationItem): boolean {
  return isBranch(item)
    ? item.children.every((child) => Boolean(child.permission))
    : Boolean(item.permission);
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  isMobile: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

/// Barra lateral (sección 7.2): marca + colapso, menú filtrado por permiso, y el bloque del usuario abajo.
/// En menos de 768px es un cajón deslizable sobre un fondo oscurecido, que se cierra al navegar y con Escape.
export function Sidebar({ collapsed, onToggleCollapsed, isMobile, mobileOpen, onCloseMobile }: SidebarProps) {
  const { t } = useTranslation();
  const { has, isError, refetch } = usePermissions();
  // `isPending` es "todavía no sabemos", no "no hay": mientras dura, el menú reserva el lugar de los ítems
  // que dependen de un permiso y el pie reserva el del usuario, así nada aparece de golpe empujando al resto.
  const { data: user, isPending } = useCurrentUser();
  const location = useLocation();

  // El grupo de la pantalla en la que estás parado. Los grupos arrancan plegados: el menú muestra a dónde se
  // puede ir sin desplegar todo, y el que importa —el de la ruta activa— se abre solo.
  const activeBranchKey = branchOf(location.pathname)?.labelKey;
  const [openBranchKeys, setOpenBranchKeys] = useState<string[]>(() => (activeBranchKey ? [activeBranchKey] : []));
  const [lastActiveBranchKey, setLastActiveBranchKey] = useState(activeBranchKey);

  // Entrar a una pantalla del grupo lo despliega, y se calcula durante el render en vez de con un efecto:
  // si no, al recargar /roles el menú aparecería plegado y recién después se abriría. Navegar entre hermanos
  // no cambia la clave, así que el grupo se queda como esté, incluso si se plegó a mano.
  if (activeBranchKey !== lastActiveBranchKey) {
    setLastActiveBranchKey(activeBranchKey);

    if (activeBranchKey && !openBranchKeys.includes(activeBranchKey)) {
      setOpenBranchKeys([...openBranchKeys, activeBranchKey]);
    }
  }

  function toggleBranch(labelKey: string) {
    setOpenBranchKeys((previous) =>
      previous.includes(labelKey) ? previous.filter((key) => key !== labelKey) : [...previous, labelKey],
    );
  }

  useEffect(() => {
    if (!isMobile || !mobileOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseMobile();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobile, mobileOpen, onCloseMobile]);

  // Contraída a solo íconos únicamente en escritorio: el cajón de móvil siempre se ve expandido.
  const iconsOnly = collapsed && !isMobile;
  const onNavigate = isMobile ? onCloseMobile : undefined;
  const canSee = (link: NavigationLink) => isPending || !link.permission || has(link.permission);
  // Sin nombre no hay renglón de abajo: el del nombre ya muestra el correo o el número.
  const accountDetail = user ? accountDetailOf(user) : undefined;

  return (
    <>
      {isMobile && mobileOpen ? (
        // Debajo de la barra superior (h-16): así el botón ☰ que abre el cajón queda siempre visible y se
        // puede volver a usar para cerrarlo, en vez de quedar tapado por el propio cajón.
        <button
          type="button"
          aria-label={t("layout.sidebar.closeDrawer")}
          onClick={onCloseMobile}
          className="fixed inset-x-0 top-16 bottom-0 z-40 bg-black/40"
        />
      ) : null}

      <aside
        className={cn(
          "relative flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]",
          isMobile
            ? cn(
                "fixed top-16 bottom-0 left-0 z-50 w-[264px] transition-transform duration-200",
                mobileOpen ? "translate-x-0" : "-translate-x-full",
              )
            // z-30: la flecha de colapsar sale por fuera del borde derecho, y sin esto queda tapada por la
            // banda del encabezado de la pantalla, que es `sticky z-20` y se pinta después.
            : cn("h-svh shrink-0 transition-[width] duration-200 z-30", iconsOnly ? "w-[72px]" : "w-[264px]"),
        )}
      >
        {/* `h-16`, el mismo alto exacto que el Topbar. Con el alto automático medía 65 (16 + 32 + 16 + 1 de
            borde) contra los 64 del Topbar, que es `h-16` con `box-sizing: border-box`: la línea que cruza
            la pantalla salía quebrada un píxel justo en el borde de la barra. */}
        <div
          className={cn(
            "flex h-16 items-center border-b border-[var(--color-border)] px-3",
            iconsOnly ? "justify-center" : "",
          )}
        >
          {/* Cuadrado de marca: placeholder hasta que haya un logo real. Al lado no va ningún nombre: el
              lugar queda libre para la marca de quien use la plantilla. */}
          <span aria-hidden="true" className="size-8 shrink-0 rounded-lg bg-[var(--color-brand-600)]" />
        </div>

        {/* La flecha va montada sobre el borde derecho, como un círculo mitad adentro y mitad afuera. Su eje
            es el centro de la banda de encabezado de la pantalla, que arranca donde termina el Topbar (64) y
            mide 56: 64 + 28 = 92. Restándole medio botón (12) queda en 80. El primer ítem del menú se alinea
            a ese mismo eje con el `pt` del nav, así el "Inicio" del menú, la flecha y el título de la
            pantalla quedan los tres sobre la misma línea. Va afuera del `nav` a propósito: ese tiene
            `overflow-y-auto` y la recortaría. */}
        {isMobile ? null : (
          <IconButton
            label={iconsOnly ? t("layout.sidebar.expand") : t("layout.sidebar.collapse")}
            onClick={onToggleCollapsed}
            className="absolute top-20 -right-3 z-20 size-6 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm hover:bg-[var(--color-surface-muted)]"
          >
            <ChevronLeftIcon className={cn("size-3.5 transition-transform", iconsOnly ? "rotate-180" : "")} />
          </IconButton>
        )}

        {/* El `pt` centra el primer ítem en el eje 92: expandido el ítem mide 36 (74 + 18), contraído mide 40
            (72 + 20). Son dos valores porque es el centro lo que tiene que coincidir, no el borde de arriba. */}
        <nav
          aria-label={t("layout.sidebar.navigation")}
          className={cn("flex-1 overflow-y-auto px-2 pb-3", iconsOnly ? "pt-2" : "pt-2.5")}
        >
          {/* Si /api/me falló no sabemos qué ítems mostrar, y el filtro de abajo los esconde. Sin avisar,
              una caída del backend pasa por un menú más corto de lo habitual, que nadie va a notar. El
              aviso queda para el lector de pantalla también cuando la barra está contraída. */}
          {isError ? (
            <div
              className={cn(
                "mb-3 flex flex-col gap-2 rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] p-2",
                iconsOnly ? "items-center" : "",
              )}
            >
              <p className={cn("px-1 text-xs text-[var(--color-content-muted)]", iconsOnly ? "sr-only" : "")}>
                {t("layout.sidebar.loadError")}
              </p>
              {iconsOnly ? (
                <IconButton label={t("layout.sidebar.retryLoad")} onClick={() => void refetch()} size="icon-sm">
                  <RefreshIcon className="size-4" />
                </IconButton>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
                  {t("actions.retry")}
                </Button>
              )}
            </div>
          ) : null}

          {navigation.map((group, index) => {
            const items = visibleItems(group.items, canSee, iconsOnly);

            if (items.length === 0) {
              return null;
            }

            return (
              <div key={group.labelKey} className={index === 0 ? "" : "mt-4"}>
                {/* El primer grupo (general) no lleva rótulo: coincide con la maqueta aprobada. */}
                {index > 0 && !iconsOnly ? (
                  <p className="mb-1 px-3 text-xs font-semibold tracking-wide text-[var(--color-content-muted)] uppercase">
                    {t(group.labelKey)}
                  </p>
                ) : null}
                {/* Contraída no hay lugar para el rótulo del grupo, y sin él los íconos quedan como una
                    lista sola. Una línea corta mantiene la separación que el rótulo daba. El rótulo
                    sigue existiendo para el lector de pantalla. */}
                {index > 0 && iconsOnly ? (
                  <>
                    <span className="sr-only">{t(group.labelKey)}</span>
                    <div aria-hidden="true" className="mx-auto mb-3 h-px w-8 bg-[var(--color-border)]" />
                  </>
                ) : null}
                <ul className={cn("flex flex-col gap-1", iconsOnly ? "items-center" : "")}>
                  {items.map((item) => (
                    <li key={isBranch(item) ? item.labelKey : item.to}>
                      {isPending && dependsOnPermissions(item) ? (
                        <Skeleton
                          aria-hidden="true"
                          className={cn("rounded-[var(--radius-control)]", iconsOnly ? "size-10" : "h-9")}
                        />
                      ) : isBranch(item) ? (
                        <NavBranch
                          branch={item}
                          label={t(item.labelKey)}
                          open={openBranchKeys.includes(item.labelKey)}
                          onToggle={() => toggleBranch(item.labelKey)}
                          translate={t}
                          onNavigate={onNavigate}
                        />
                      ) : (
                        <NavItem item={item} label={t(item.labelKey)} collapsed={iconsOnly} onNavigate={onNavigate} />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Mientras el perfil no llegó, el pie ocupa el mismo lugar con bloques de carga en vez de quedar
            vacío y aparecer después empujando la barra. Si /api/me falló (ni datos ni pendiente) no se
            muestra nada: de ese error se ocupa la pantalla, no la barra lateral. */}
        {user || isPending ? (
          <div className="border-t border-[var(--color-border)] p-3">
            <div className={cn("flex items-center gap-2", iconsOnly ? "justify-center" : "")}>
              {user ? (
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-600)] text-sm font-semibold text-white"
                >
                  {initialOf(accountNameOf(user))}
                </span>
              ) : (
                <Skeleton aria-hidden="true" className="size-8 shrink-0 rounded-full" />
              )}
              {iconsOnly ? null : (
                // min-h-9 es el alto de los dos renglones (text-sm y text-xs): una cuenta sin nombre tiene uno
                // solo, y así el pie mide lo mismo que con dos, con ese renglón centrado junto al avatar.
                <div className="flex min-h-9 min-w-0 flex-1 flex-col justify-center">
                  {user ? (
                    <>
                      <p className="truncate text-sm font-medium text-[var(--color-content)]">{accountNameOf(user)}</p>
                      {accountDetail === undefined ? null : (
                        <p className="truncate text-xs text-[var(--color-content-muted)]">{accountDetail}</p>
                      )}
                    </>
                  ) : (
                    // Los contenedores llevan el alto exacto de las dos líneas de texto que reemplazan
                    // (text-sm y text-xs): así el pie mide lo mismo antes y después, y no salta.
                    <>
                      <div className="flex h-5 items-center">
                        <Skeleton aria-hidden="true" className="h-3.5 w-24" />
                      </div>
                      <div className="flex h-4 items-center">
                        <Skeleton aria-hidden="true" className="h-3 w-32" />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
