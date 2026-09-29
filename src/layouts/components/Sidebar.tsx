import { useEffect, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";
import {
  administration,
  branchOf,
  isAdministrationPath,
  isBranch,
  navigation,
  type NavigationItem,
  type NavigationLink,
} from "../navigation";
import { accountDetailOf, accountNameOf, initialOf } from "@/auth/accountName";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { usePermissions } from "@/auth/usePermissions";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, RefreshIcon } from "@/shared/ui/icons";
import { IconButton } from "@/shared/ui/IconButton";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/// Qué grupos están desplegados y cómo se alterna uno. Va por props porque el estado vive en la barra: un
/// grupo adentro de otro (Administración en el teléfono) lo necesita para plegarse sin conocer al de arriba.
interface BranchControls {
  isOpen: (labelKey: string) => boolean;
  toggle: (labelKey: string) => void;
}

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
          "relative flex h-[30px] items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm transition-colors",
          isActive
            ? "bg-[var(--color-surface-muted)] font-medium text-[var(--color-content)] before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[2px] before:-translate-y-1/2 before:bg-[var(--color-brand-600)]"
            : "text-[var(--color-content-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)]",
          collapsed ? "size-[30px] justify-center px-0" : "",
        )
      }
    >
      {showIcon ? <Icon className="size-4 shrink-0" /> : null}
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
/// Sus ítems pueden ser otro grupo (Administración en el teléfono, que adentro tiene Gestión de usuarios).
function NavBranch({
  labelKey,
  icon: Icon,
  items,
  showIcon = true,
  controls,
  translate,
  onNavigate,
}: {
  labelKey: string;
  icon: NavigationLink["icon"];
  items: NavigationItem[];
  showIcon?: boolean;
  controls: BranchControls;
  translate: (key: string) => string;
  onNavigate?: () => void;
}) {
  const listId = useId();
  const open = controls.isOpen(labelKey);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => controls.toggle(labelKey)}
        className="flex h-[30px] w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm text-[var(--color-content-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)]"
      >
        {showIcon ? <Icon className="size-4 shrink-0" /> : null}
        <span className="min-w-0 flex-1 truncate text-left">{translate(labelKey)}</span>
        <ChevronDownIcon
          aria-hidden="true"
          className={cn("size-4 shrink-0 transition-transform", open ? "" : "-rotate-90")}
        />
      </button>
      {open ? (
        // La guía arranca bajo el centro del ícono del padre (px-3 más medio ícono de 20), que es lo que
        // ata visualmente los hijos al grupo. Sin ícono —un grupo adentro de otro— arranca bajo su texto.
        <ul
          id={listId}
          className={cn(
            "mt-1 flex flex-col gap-1 border-l border-[var(--color-border)] pl-3",
            showIcon ? "ml-[22px]" : "ml-3",
          )}
        >
          <NavItems items={items} controls={controls} translate={translate} onNavigate={onNavigate} />
        </ul>
      ) : null}
    </>
  );
}

/// Los `li` de una lista de ítems ya filtrada, sea la del menú, la de un submenú o la del panel. Adentro de
/// una lista desplegada nada lleva ícono: la sangría y la guía ya cuentan de quién cuelga.
/// Mientras los permisos no llegaron, lo que puede llegar a no verse ocupa su lugar con un bloque de carga:
/// si no, la lista se dibuja entera y se recorta sola un instante después, delante de quien la está leyendo.
function NavItems({
  items,
  controls,
  translate,
  onNavigate,
  showIcons = false,
  pending = false,
}: {
  items: NavigationItem[];
  controls: BranchControls;
  translate: (key: string) => string;
  onNavigate?: () => void;
  showIcons?: boolean;
  pending?: boolean;
}) {
  return items.map((item) => (
    <li key={isBranch(item) ? item.labelKey : item.to}>
      {pending && dependsOnPermissions(item) ? (
        <Skeleton aria-hidden="true" className="h-9 rounded-[var(--radius-control)]" />
      ) : isBranch(item) ? (
        <NavBranch
          labelKey={item.labelKey}
          icon={item.icon}
          items={item.children}
          showIcon={showIcons}
          controls={controls}
          translate={translate}
          onNavigate={onNavigate}
        />
      ) : (
        <NavItem
          item={item}
          label={translate(item.labelKey)}
          collapsed={false}
          showIcon={showIcons}
          onNavigate={onNavigate}
        />
      )}
    </li>
  ));
}

/// El botón de Administración, al pie del menú. No es un grupo que se despliega en la lista: abre el panel de
/// al lado, y por eso la flecha apunta a un costado. Contraído es solo el ícono, con Tooltip, como cualquier
/// ítem, y con el panel abierto queda activo, que es lo que dice en qué sección estás parado.
function AdministrationTrigger({
  label,
  open,
  collapsed,
  panelId,
  onToggle,
}: {
  label: string;
  open: boolean;
  collapsed: boolean;
  panelId: string;
  onToggle: () => void;
}) {
  const Icon = administration.icon;

  const trigger = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      onClick={onToggle}
      className={cn(
        "relative flex h-[30px] w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm transition-colors",
        open
          ? "bg-[var(--color-surface-muted)] font-medium text-[var(--color-content)] before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[2px] before:-translate-y-1/2 before:bg-[var(--color-brand-600)]"
          : "text-[var(--color-content-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)]",
        collapsed ? "size-[30px] justify-center px-0" : "",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate text-left">{label}</span>
          <ChevronRightIcon
            aria-hidden="true"
            className={cn("size-4 shrink-0 transition-transform", open ? "rotate-180" : "")}
          />
        </>
      )}
    </button>
  );

  if (!collapsed) {
    return trigger;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
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
/// Administración va al pie y abre un segundo panel al lado, con sus pantallas adentro.
/// En menos de 768px es un cajón deslizable sobre un fondo oscurecido, que se cierra al navegar y con Escape.
export function Sidebar({ collapsed, onToggleCollapsed, isMobile, mobileOpen, onCloseMobile }: SidebarProps) {
  const { t } = useTranslation();
  const { has, isError, refetch } = usePermissions();
  // `isPending` es "todavía no sabemos", no "no hay": mientras dura, el menú reserva el lugar de los ítems
  // que dependen de un permiso y el pie reserva el del usuario, así nada aparece de golpe empujando al resto.
  const { data: user, isPending } = useCurrentUser();
  const location = useLocation();
  const panelId = useId();

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

  // El panel sigue a la sección, no a los clics: entrar a una ruta de administración lo abre y salir lo
  // cierra, también recargando o llegando desde un favorito. Mientras estás adentro se puede cerrar y abrir
  // a mano cuantas veces quieras; lo que lo vuelve a decidir es cambiar de sección.
  const adminRoute = isAdministrationPath(location.pathname);
  const [panelOpen, setPanelOpen] = useState(adminRoute);
  const [lastAdminRoute, setLastAdminRoute] = useState(adminRoute);

  if (adminRoute !== lastAdminRoute) {
    setLastAdminRoute(adminRoute);
    setPanelOpen(adminRoute);
  }

  function toggleBranch(labelKey: string) {
    setOpenBranchKeys((previous) =>
      previous.includes(labelKey) ? previous.filter((key) => key !== labelKey) : [...previous, labelKey],
    );
  }

  // En el teléfono Administración es un grupo más del cajón, así que su apertura tiene que contestar por el
  // mismo camino que la de cualquier grupo, aunque el estado que la guarda sea el del panel.
  const controls: BranchControls = {
    isOpen: (labelKey) => (labelKey === administration.labelKey ? panelOpen : openBranchKeys.includes(labelKey)),
    toggle: (labelKey) =>
      labelKey === administration.labelKey ? setPanelOpen((previous) => !previous) : toggleBranch(labelKey),
  };

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

  // El panel no se aplana nunca: se ve expandido aunque la barra esté contraída, que es justamente lo que lo
  // hace mejor que un desplegable de 40px.
  const adminItems = visibleItems(administration.items, canSee, false);
  const adminPending = isPending && administration.items.every(dependsOnPermissions);
  const showAdministration = adminItems.length > 0;
  const panelVisible = showAdministration && panelOpen && !isMobile;

  return (
    <>
      {isMobile && mobileOpen ? (
        // Debajo de la barra superior (h-16): así el botón ☰ que abre el cajón queda siempre visible y se
        // puede volver a usar para cerrarlo, en vez de quedar tapado por el propio cajón.
        <button
          type="button"
          aria-label={t("layout.sidebar.closeDrawer")}
          onClick={onCloseMobile}
          className="fixed inset-x-0 top-12 bottom-0 z-40 bg-black/50"
        />
      ) : null}

      <aside
        className={cn(
          "relative flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]",
          isMobile
            ? cn(
                "fixed top-12 bottom-0 left-0 z-50 w-[220px] transition-transform duration-200",
                mobileOpen ? "translate-x-0" : "-translate-x-full",
              )
            // z-30: la flecha de colapsar sale por fuera del borde derecho, y sin esto queda tapada por la
            // banda del encabezado de la pantalla, que es `sticky z-20` y se pinta después.
            : cn("h-svh shrink-0 transition-[width] duration-200 z-30", iconsOnly ? "w-[56px]" : "w-[220px]"),
        )}
      >
        {/* `h-16`, el mismo alto exacto que el Topbar. Con el alto automático medía 65 (16 + 32 + 16 + 1 de
            borde) contra los 64 del Topbar, que es `h-16` con `box-sizing: border-box`: la línea que cruza
            la pantalla salía quebrada un píxel justo en el borde de la barra. */}
        <div
          className={cn(
            "flex h-12 items-center border-b border-[var(--color-border)] px-3",
            iconsOnly ? "justify-center" : "",
          )}
        >
          {/* La marca es el nombre escrito, no un cuadrado de color esperando un logo: un cuadrado de color
              es lo que pone cualquier maqueta. Contraída queda la inicial. */}
          {iconsOnly ? (
            <span className="text-base font-bold tracking-[-0.02em] text-[var(--color-content)]">AB</span>
          ) : (
            <span className="truncate text-base tracking-[-0.02em]">
              <span className="font-bold text-[var(--color-content)]">Arquitectura</span>
              <span className="text-[var(--color-content-muted)]">Base</span>
            </span>
          )}
        </div>

        {/* La flecha va montada sobre el borde derecho, como un círculo mitad adentro y mitad afuera. Su eje
            es el centro de la banda de encabezado de la pantalla, que arranca donde termina el Topbar (64) y
            mide 56: 64 + 28 = 92. Restándole medio botón (12) queda en 80. El primer ítem del menú se alinea
            a ese mismo eje con el `pt` del nav, así el "Inicio" del menú, la flecha y el título de la
            pantalla quedan los tres sobre la misma línea. Va afuera del `nav` a propósito: ese tiene
            `overflow-y-auto` y la recortaría.

            Con el panel abierto no se dibuja: la flecha de cerrarlo ocupa ese mismo lugar sobre el borde de
            al lado, y dos círculos a la misma altura se leen como uno partido. */}
        {isMobile || panelVisible ? null : (
          <IconButton
            label={iconsOnly ? t("layout.sidebar.expand") : t("layout.sidebar.collapse")}
            onClick={onToggleCollapsed}
            className="absolute top-[62px] -right-2.5 z-20 size-5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]"
          >
            <ChevronLeftIcon className={cn("size-3 transition-transform", iconsOnly ? "rotate-180" : "")} />
          </IconButton>
        )}

        {/* El `pt` centra el primer ítem en el eje 92: expandido el ítem mide 36 (74 + 18), contraído mide 40
            (72 + 20). Son dos valores porque es el centro lo que tiene que coincidir, no el borde de arriba. */}
        <nav
          aria-label={t("layout.sidebar.navigation")}
          className="flex flex-1 flex-col overflow-y-auto px-2 pt-2 pb-2"
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
                  <p className="mt-3 mb-1 px-2 text-xs text-[var(--color-content-muted)]">
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
                          labelKey={item.labelKey}
                          icon={item.icon}
                          items={item.children}
                          showIcon={false}
                          controls={controls}
                          translate={t}
                          onNavigate={onNavigate}
                        />
                      ) : (
                        <NavItem
                          item={item}
                          label={t(item.labelKey)}
                          collapsed={iconsOnly}
                          showIcon={iconsOnly}
                          onNavigate={onNavigate}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {/* Administración cierra el menú, separada por una línea: es la sección que no se usa todo el día,
              y abajo queda a la misma distancia esté el menú como esté. En el teléfono no hay lugar para un
              panel al lado, así que se despliega adentro, como cualquier grupo. */}
          {adminPending || showAdministration ? (
            <div
              className={cn(
                "mt-auto border-t border-[var(--color-border)] pt-2",
                iconsOnly ? "flex justify-center" : "",
              )}
            >
              {adminPending ? (
                <Skeleton
                  aria-hidden="true"
                  className={cn("rounded-[var(--radius-control)]", iconsOnly ? "size-10" : "h-9 w-full")}
                />
              ) : isMobile ? (
                <ul className="flex flex-col gap-1">
                  <li>
                    <NavBranch
                      labelKey={administration.labelKey}
                      icon={administration.icon}
                      items={adminItems}
                      showIcon={false}
                      controls={controls}
                      translate={t}
                      onNavigate={onNavigate}
                    />
                  </li>
                </ul>
              ) : (
                <AdministrationTrigger
                  label={t(administration.labelKey)}
                  open={panelOpen}
                  collapsed={iconsOnly}
                  panelId={panelId}
                  onToggle={() => setPanelOpen((previous) => !previous)}
                />
              )}
            </div>
          ) : null}
        </nav>

        {/* Mientras el perfil no llegó, el pie ocupa el mismo lugar con bloques de carga en vez de quedar
            vacío y aparecer después empujando la barra. Si /api/me falló (ni datos ni pendiente) no se
            muestra nada: de ese error se ocupa la pantalla, no la barra lateral. */}
        {user || isPending ? (
          <div className="border-t border-[var(--color-border)] p-2">
            <div className={cn("flex items-center gap-2", iconsOnly ? "justify-center" : "")}>
              {user ? (
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-brand-600)] text-xs font-bold text-[var(--color-brand-ink)]"
                >
                  {initialOf(accountNameOf(user))}
                </span>
              ) : (
                <Skeleton aria-hidden="true" className="size-6 shrink-0 rounded-[var(--radius-control)]" />
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

      {/* El panel de Administración: un carril propio al lado del menú, con la misma lista de siempre pero
          entera y sin robarle lugar al menú de todos los días. Es un `nav` y no otro `aside`, porque es
          navegación y no una segunda barra: el único `complementary` de la pantalla sigue siendo el menú.
          `z-30` como la barra, y después de ella en el DOM: así su flecha sale sobre la banda de la pantalla. */}
      {panelVisible ? (
        <nav
          id={panelId}
          aria-label={t(administration.labelKey)}
          className="relative z-30 flex h-svh w-[200px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          {/* El mismo alto que la marca del menú y que el Topbar: los tres bordes de arriba forman una sola
              línea que cruza la pantalla. */}
          <div className="flex h-12 items-center border-b border-[var(--color-border)] px-3">
            <p className="truncate text-sm font-medium text-[var(--color-content)]">{t(administration.labelKey)}</p>
          </div>

          <IconButton
            label={t("layout.sidebar.closeAdministration")}
            onClick={() => setPanelOpen(false)}
            className="absolute top-[62px] -right-2.5 z-20 size-5 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)]"
          >
            <ChevronLeftIcon className="size-3" />
          </IconButton>

          <div className="flex-1 overflow-y-auto px-2 pt-2.5 pb-3">
            <ul className="flex flex-col gap-1">
              <NavItems items={adminItems} controls={controls} translate={t} onNavigate={onNavigate} pending={isPending} />
            </ul>
          </div>
        </nav>
      ) : null}
    </>
  );
}
