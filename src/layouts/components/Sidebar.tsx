import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { NavLink } from "react-router";
import { navigation, type NavigationItem } from "../navigation";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { usePermissions } from "@/auth/usePermissions";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ChevronLeftIcon, RefreshIcon } from "@/shared/ui/icons";
import { IconButton } from "@/shared/ui/IconButton";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "?";
}

/// Un ítem de navegación. Contraído, solo el ícono (con Tooltip) y el texto queda para el lector de pantalla.
function NavItem({
  item,
  label,
  collapsed,
  onNavigate,
}: {
  item: NavigationItem;
  label: string;
  collapsed: boolean;
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
          collapsed ? "justify-center px-2" : "",
        )
      }
    >
      <Icon className="size-5 shrink-0" />
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
          "flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]",
          isMobile
            ? cn(
                "fixed top-16 bottom-0 left-0 z-50 w-[264px] transition-transform duration-200",
                mobileOpen ? "translate-x-0" : "-translate-x-full",
              )
            : cn("h-svh shrink-0 transition-[width] duration-200", iconsOnly ? "w-[72px]" : "w-[264px]"),
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-4">
          {/* Cuadrado de marca: placeholder hasta que haya un logo real. Al lado no va ningún nombre: el
              lugar queda libre para la marca de quien use la plantilla. */}
          <span aria-hidden="true" className="size-8 shrink-0 rounded-lg bg-[var(--color-brand-600)]" />

          {isMobile ? null : (
            <IconButton
              label={iconsOnly ? t("layout.sidebar.expand") : t("layout.sidebar.collapse")}
              onClick={onToggleCollapsed}
              size="icon-sm"
            >
              <ChevronLeftIcon className={cn("size-4 transition-transform", iconsOnly ? "rotate-180" : "")} />
            </IconButton>
          )}
        </div>

        <nav aria-label={t("layout.sidebar.navigation")} className="flex-1 overflow-y-auto px-2 py-3">
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
            const items = group.items.filter((item) => !item.hidden);
            // Hasta que no llegan los permisos no se sabe qué ítems se ven. Filtrarlos igual haría desaparecer
            // medio menú para después devolverlo de golpe, que es peor que el spinner que esto reemplaza: se
            // muestran todos, y los que dependen de un permiso van como un bloque de carga del alto de un ítem.
            const visibleItems = isPending ? items : items.filter((item) => !item.permission || has(item.permission));

            if (visibleItems.length === 0) {
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
                <ul className="flex flex-col gap-1">
                  {visibleItems.map((item) => (
                    <li key={item.to}>
                      {isPending && item.permission ? (
                        <Skeleton aria-hidden="true" className="h-9 rounded-[var(--radius-control)]" />
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
                  {initialOf(user.displayName ?? user.email)}
                </span>
              ) : (
                <Skeleton aria-hidden="true" className="size-8 shrink-0 rounded-full" />
              )}
              {iconsOnly ? null : (
                <div className="min-w-0 flex-1">
                  {user ? (
                    <>
                      <p className="truncate text-sm font-medium text-[var(--color-content)]">{user.displayName ?? user.email}</p>
                      <p className="truncate text-xs text-[var(--color-content-muted)]">{user.email}</p>
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
