import { useContext, useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useMatch } from "react-router";
import {
  administration,
  whatsapp,
  forms,
  isFormsPath,
  isWhatsAppPath,
  branchOf,
  isAdministrationPath,
  isBranch,
  navigation,
  type NavigationBranch,
  type NavigationItem,
  type NavigationLink,
  type NavigationPanel,
} from "../navigation";
import { FormsOverviewNavigationContext } from "../formsOverviewNavigation";
import { FolderMenuNavigationContext, isEntryPath, type FolderMenuAction, type FolderMenuContent, type FolderMenuEntry, type FolderMenuGroup, type FolderMenuLink, type FolderMenuSection } from "../folderMenuNavigation";
import { FolderIcon, FormIcon, PlusIcon, PublicTrackingIcon } from "@/shared/ui/icons";
import { menuIcons } from "@/shared/ui/menuIcons";
import { accountDetailOf, accountNameOf, initialOf } from "@/auth/accountName";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { usePermissions, type PermissionRequirement } from "@/auth/usePermissions";
import { useSystemPresentation } from "@/shared/api/presentation";
import { formatNumber } from "@/shared/lib/numberFormat";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, RefreshIcon } from "@/shared/ui/icons";
import { IconButton } from "@/shared/ui/IconButton";
import { Skeleton } from "@/shared/ui/skeleton";
import { ActionTooltip } from "@/shared/ui/ActionTooltip";
import { ActionsMenu } from "@/shared/ui/ActionsMenu";

const sidebarEdgeToggleClassName =
  "absolute top-15.5 -right-2.5 z-20 size-5 rounded-[var(--radius-control)] border border-[var(--color-control-border)] bg-[var(--color-canvas)] text-[var(--color-nav-surface)] hover:bg-[var(--color-subnav-surface)] hover:text-[var(--color-nav-surface)]";

/// Qué grupos están desplegados y cómo se alterna uno. Va por props porque el estado vive en la barra: un
/// grupo adentro de otro (Administración en el teléfono) lo necesita para plegarse sin conocer al de arriba.
interface BranchControls {
  isOpen: (labelKey: string) => boolean;
  toggle: (labelKey: string) => void;
}

/// Un ítem de navegación. Contraído, solo el ícono (con Tooltip) y el texto queda para el lector de pantalla.
/// Los íconos salen del mismo modelo para el panel, sus submenús y la barra contraída. `trailing` va en el mismo
/// renglón, después del texto: el bloque de carga del número de «Formularios».
function NavItem({
  item,
  label,
  collapsed,
  showIcon = true,
  trailing,
  onNavigate,
}: {
  item: NavigationLink;
  label: string;
  collapsed: boolean;
  showIcon?: boolean;
  trailing?: ReactNode;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const pathname = useLocation().pathname;
  // «Formularios» (`/formularios`) is every screen of a form: the list, the editor, its sheet and its load (FU2-A). The other
  // pages of the panel live under the same address and are theirs.
  const otherFormsPage = /^\/formularios\/(?:faltantes|biblioteca|documentos)(?:\/|$)/.test(pathname);

  const match = useMatch({ path: item.to, end: item.exact || item.to === "/" });
  const isCurrent = item.current ?? (!!match && !(item.to === "/formularios" && otherFormsPage));

  const link = (
    <Link
      to={item.to}
      aria-current={isCurrent ? "page" : undefined}
      onClick={() => { item.onSelect?.(); onNavigate?.(); }}
      className={cn(
          "relative flex min-h-7.5 items-center gap-2 rounded-[var(--radius-control)] px-2 py-1 text-sm transition-colors",
          isCurrent
            ? "bg-[var(--color-surface-muted)] font-medium text-[var(--color-content)] before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[2px] before:-translate-y-1/2 before:bg-[var(--color-brand-600)]"
            : "text-[var(--color-content-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)]",
          collapsed ? "size-7.5 justify-center px-0" : "",
        )}
    >
      {showIcon ? <Icon className="size-4 shrink-0" /> : null}
      {collapsed ? <span className="sr-only">{label}</span> : <span className="min-w-0 break-words leading-4">{label}</span>}
      {collapsed ? null : trailing}
    </Link>
  );

  if (!collapsed) {
    return link;
  }

  return (
    <ActionTooltip label={label} side="right">{link}</ActionTooltip>
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
  leading,
  trailing,
  actions,
  controls,
  translate,
  onNavigate,
}: {
  labelKey: string;
  icon: NavigationLink["icon"];
  items: NavigationItem[];
  showIcon?: boolean;
  leading?: ReactNode;
  /** Rows after the items: «Documentos recibidos» after the pages of the forms (DOC5-A), or what a folder has in the drawer (CM5). */
  trailing?: ReactNode;
  /** The ⋮ of a folder or a subfolder (CM4), after the row: it shows on hover or with the focus inside, and always on a touch screen. */
  actions?: ReactNode;
  controls: BranchControls;
  translate: (key: string) => string;
  onNavigate?: () => void;
}) {
  const listId = useId();
  const open = controls.isOpen(labelKey);
  const toggle = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={open ? listId : undefined}
      onClick={() => controls.toggle(labelKey)}
      className={cn(
        "flex min-h-7.5 items-center gap-2 rounded-[var(--radius-control)] px-2 py-1 text-sm text-[var(--color-content-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)]",
        actions ? "min-w-0 flex-1" : "w-full",
      )}
    >
      {showIcon ? <Icon className="size-4 shrink-0" /> : null}
      <span className="min-w-0 flex-1 break-words text-left leading-4">{translate(labelKey)}</span>
      <ChevronDownIcon
        aria-hidden="true"
        className={cn("size-4 shrink-0 transition-transform", open ? "" : "-rotate-90")}
      />
    </button>
  );

  return (
    <>
      {actions ? (
        <div className="group/branch flex items-center gap-1">
          {toggle}
          <span className="flex shrink-0 opacity-0 group-focus-within/branch:opacity-100 group-hover/branch:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100">{actions}</span>
        </div>
      ) : toggle}
      {open && leading ? leading : null}
      {open ? (
        // La guía arranca bajo el centro del ícono del padre; cuando no se muestra, arranca bajo su texto.
        <ul
          id={listId}
          className={cn(
            "mt-1 flex flex-col gap-1 border-l border-[var(--color-border)] pl-3",
            showIcon ? "ml-5.5" : "ml-3",
          )}
        >
          <NavItems items={items} controls={controls} translate={translate} onNavigate={onNavigate} showIcons={showIcon} />
          {trailing}
        </ul>
      ) : null}
    </>
  );
}

/// Los `li` de una lista de ítems ya filtrada, sea la del menú, la de un submenú o la del panel. Adentro de
/// una lista desplegada se conserva el ícono de cada destino, junto a la sangría y la guía del grupo.
/// Mientras los permisos no llegaron, lo que puede llegar a no verse ocupa su lugar con un bloque de carga:
/// si no, la lista se dibuja entera y se recorta sola un instante después, delante de quien la está leyendo.
function NavItems({
  items,
  controls,
  translate,
  onNavigate,
  showIcons = true,
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
        <Skeleton aria-hidden="true" className="h-7.5 rounded-[var(--radius-control)]" />
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
function PanelTrigger({
  icon: Icon,
  label,
  open,
  collapsed,
  panelId,
  onToggle,
}: {
  icon: NavigationLink["icon"];
  label: string;
  open: boolean;
  collapsed: boolean;
  panelId: string;
  onToggle: () => void;
}) {

  const trigger = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      onClick={onToggle}
      className={cn(
        "relative flex h-7.5 w-full items-center gap-2 rounded-[var(--radius-control)] px-2 text-sm transition-colors",
        open
          ? "bg-[var(--color-surface-muted)] font-medium text-[var(--color-content)] before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[2px] before:-translate-y-1/2 before:bg-[var(--color-brand-600)]"
          : "text-[var(--color-content-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)]",
        collapsed ? "size-7.5 justify-center px-0" : "",
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
    <ActionTooltip label={label} side="right">{trigger}</ActionTooltip>
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
    ? item.children.every((child) => Boolean(child.permission ?? child.access))
    : Boolean(item.permission ?? item.access);
}

const folderPanelPrefix = "folder-menu:";

/// A folder of the first level as a panel of the same model (CM1): its forms and a group per subfolder, with the folders they
/// come from for their actions.
interface FolderPanel extends NavigationPanel {
  readonly folder: FolderMenuSection;
  readonly links: NavigationLink[];
  readonly groups: readonly { readonly branch: NavigationBranch; readonly group: FolderMenuGroup }[];
}

/// The folders of the side menu (CM1, 2026-11-20) as items of the same model: each folder of the first level is a panel, with its
/// forms and a group per subfolder. Their names come from the server, so they go in `labels` instead of a translation key;
/// choosing a form records where it was opened from, which marks it, keeps its panel open while its screens are and, for a
/// form of a subfolder, opens its group (`activeGroup`).
function folderMenuModel(content: FolderMenuContent | undefined, entry: FolderMenuEntry | null, enter: ((entry: FolderMenuEntry) => void) | undefined) {
  const labels = new Map<string, string>();
  const link = (panel: string, menuLabel: string, scope: string, form: FolderMenuLink): NavigationLink => {
    const key = `folder-form:${scope}:${form.id}`;
    labels.set(key, form.label);
    return { labelKey: key, to: form.to, icon: FormIcon, current: entry?.key === key,
      onSelect: () => enter?.({ key, formId: form.id, panel, menuLabel, formLabel: form.label }) };
  };
  const group = (panel: string, menuLabel: string, source: FolderMenuGroup): NavigationBranch => {
    const key = `folder-group:${panel}:${source.id}`;
    labels.set(key, source.label);
    return { labelKey: key, icon: FolderIcon, children: source.links.map(form => link(panel, menuLabel, `${panel}:${source.id}`, form)) };
  };
  const own = (content?.menus ?? []).map((section): FolderPanel => {
    const key = folderPanelPrefix + section.id;
    labels.set(key, section.label);
    const links = section.links.map(form => link(key, section.label, key, form));
    const groups = section.groups.map(source => ({ branch: group(key, section.label, source), group: source }));
    return { labelKey: key, icon: menuIcons[section.icon], items: [...links, ...groups.map(({ branch }) => branch)], folder: section, links, groups };
  });
  const activeGroup = own.flatMap(panel => panel.groups).find(({ branch }) => branch.children.some(child => child.current))?.branch.labelKey;
  return { labels, own, activeGroup };
}

/// What a control of the menu asks for a folder (CM2, CM4), with the control itself, which the focus goes back to.
type FolderMenuActor = (action: FolderMenuAction, from: HTMLElement | null) => void;
interface FolderMenuItem { readonly label: string; readonly action: FolderMenuAction; readonly reason?: string | null; readonly destructive?: boolean }

/// The ⋮ of a folder or a subfolder (CM4), for whoever administers forms: each item asks `app` for its dialog, and the dialog gives
/// the focus back to ⋮ when it closes.
function FolderActions({ name, items, act }: { name: string; items: readonly FolderMenuItem[]; act: FolderMenuActor }) {
  const { t } = useTranslation();
  const trigger = useRef<HTMLButtonElement>(null);
  return (
    <ActionsMenu size="icon-xs" label={t("layout.sidebar.folderActions", { name })} triggerRef={trigger}
      items={items.map(item => ({ label: item.label, reason: item.reason, destructive: item.destructive, onSelect: () => act(item.action, trigger.current) }))} />
  );
}

/// «Editar…» (name and icon), «Nueva subcarpeta…», «Mover a…» and «Borrar». A folder with subfolders cannot go into another one.
function folderItems(folder: FolderMenuSection, t: (key: string) => string): FolderMenuItem[] {
  return [
    { label: t("layout.sidebar.folder.edit"), action: { kind: "edit", folderId: folder.id } },
    { label: t("layout.sidebar.folder.newSubfolder"), action: { kind: "createSubfolder", parentId: folder.id } },
    { label: t("layout.sidebar.folder.move"), action: { kind: "move", folderId: folder.id }, reason: folder.groups.length > 0 ? t("layout.sidebar.folder.moveReason") : null },
    { label: t("layout.sidebar.folder.delete"), action: { kind: "delete", folderId: folder.id }, destructive: true },
  ];
}

/// «Editar…» (only the name), «Agregar formularios…», «Mover a…» and «Borrar».
function subfolderItems(group: FolderMenuGroup, t: (key: string) => string): FolderMenuItem[] {
  return [
    { label: t("layout.sidebar.folder.edit"), action: { kind: "edit", folderId: group.id } },
    { label: t("layout.sidebar.folder.addForms"), action: { kind: "addForms", folderId: group.id } },
    { label: t("layout.sidebar.folder.move"), action: { kind: "move", folderId: group.id } },
    { label: t("layout.sidebar.folder.delete"), action: { kind: "delete", folderId: group.id }, destructive: true },
  ];
}

/// A row of the menu that does something instead of leading somewhere: «Nueva carpeta» and «Agregar formularios» (CM1), with their
/// +. They are rows because the menu is the only place of the folders, and what hid in a «…» was not found. Collapsed, the + with
/// its tooltip, like any item.
function MenuActionRow({ label, collapsed = false, onClick, ref }: { label: string; collapsed?: boolean; onClick: (target: HTMLElement) => void; ref?: Ref<HTMLButtonElement> }) {
  const row = (
    <button
      ref={ref}
      type="button"
      onClick={event => onClick(event.currentTarget)}
      className={cn(
        "flex min-h-7.5 items-center gap-2 rounded-[var(--radius-control)] px-2 py-1 text-sm text-[var(--color-content-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)]",
        collapsed ? "size-7.5 justify-center px-0" : "w-full",
      )}
    >
      <PlusIcon className="size-4 shrink-0" />
      {collapsed ? <span className="sr-only">{label}</span> : <span className="min-w-0 break-words text-left leading-4">{label}</span>}
    </button>
  );
  return collapsed ? <ActionTooltip label={label} side="right">{row}</ActionTooltip> : row;
}

/// What a folder has (CM1, CM6), in its panel or inside its group of the drawer: its forms, a group per subfolder (open only the
/// one of the open form) and, for whoever administers, the ⋮ of each group and «Agregar formularios» at the end. Only whoever
/// administers gets what is empty: a folder without forms or subfolders says so; one without any form but with catalogs leads to
/// them instead; and an empty subfolder has its own «Agregar formularios».
function FolderContents({ panel, act, controls, translate, onNavigate }: {
  panel: FolderPanel;
  act: FolderMenuActor | undefined;
  controls: BranchControls;
  translate: (key: string) => string;
  onNavigate?: () => void;
}) {
  const { t } = useTranslation();
  const { folder } = panel;
  const withoutForms = folder.links.length === 0 && folder.groups.every(group => group.links.length === 0);
  return (
    <>
      <NavItems items={panel.links} controls={controls} translate={translate} onNavigate={onNavigate} />
      {withoutForms && folder.catalogCount > 0 ? (
        <li>
          <NavItem item={{ labelKey: "layout.sidebar.folderCatalogs", to: `/catalogos?carpeta=${folder.id}`, icon: PublicTrackingIcon, current: false }}
            label={t("layout.sidebar.folderCatalogs", { count: folder.catalogCount })} collapsed={false} onNavigate={onNavigate} />
        </li>
      ) : folder.links.length === 0 && folder.groups.length === 0 ? (
        <li><p className="px-2 py-1 text-xs text-[var(--color-content-muted)]">{t("layout.sidebar.emptyFolder", { name: folder.label })}</p></li>
      ) : null}
      {panel.groups.map(({ branch, group }) => (
        <li key={branch.labelKey}>
          <NavBranch labelKey={branch.labelKey} icon={branch.icon} items={branch.children} controls={controls} translate={translate} onNavigate={onNavigate}
            actions={act ? <FolderActions name={group.label} items={subfolderItems(group, t)} act={act} /> : undefined}
            trailing={act && group.links.length === 0 ? <li><MenuActionRow label={t("layout.sidebar.addForms")} onClick={target => act({ kind: "addForms", folderId: group.id }, target)} /></li> : undefined} />
        </li>
      ))}
      {act ? <li><MenuActionRow label={t("layout.sidebar.addForms")} onClick={target => act({ kind: "addForms", folderId: folder.id }, target)} /></li> : null}
    </>
  );
}

/// The notice of a menu that could not be read, with Reintentar: instead of a shorter menu nobody would notice.
function MenuLoadError({ iconsOnly, onRetry }: { iconsOnly: boolean; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className={cn("mb-3 flex flex-col gap-2 rounded-[var(--radius-control)] border border-dashed border-[var(--color-border)] p-2", iconsOnly ? "items-center" : "")}>
      <p className={cn("px-1 text-xs text-[var(--color-content-muted)]", iconsOnly ? "sr-only" : "")}>{t("layout.sidebar.loadError")}</p>
      {iconsOnly ? (
        <IconButton label={t("layout.sidebar.retryLoad")} onClick={onRetry} size="icon-sm"><RefreshIcon className="size-4" /></IconButton>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>{t("actions.retry")}</Button>
      )}
    </div>
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
  const folderMenu = useContext(FolderMenuNavigationContext);
  const entry = folderMenu?.entry ?? null;
  const activeEntry = isEntryPath(location.pathname, entry) ? entry : null;
  const folderModel = folderMenuModel(folderMenu?.content, activeEntry, folderMenu?.enter);
  const translate = (key: string) => folderModel.labels.get(key) ?? t(key);
  // The folders' actions only for whoever administers forms (CM4); the server decides. When the dialog closes, the focus goes back
  // to what asked for it or, if that left the document with its folder (deleted, or moved into another one), to «Nueva carpeta»,
  // which whoever administers always has, on the desktop and in the drawer (CM6).
  const newFolderRow = useRef<HTMLButtonElement>(null);
  const manage = folderMenu?.content?.canManage ? folderMenu.act : undefined;
  const act: FolderMenuActor | undefined = manage
    ? (action, from) => manage(action, { get current() { return from?.isConnected ? from : newFolderRow.current; } })
    : undefined;

  // El grupo de la pantalla en la que estás parado. Los grupos arrancan plegados: el menú muestra a dónde se
  // puede ir sin desplegar todo, y el que importa —el de la ruta activa— se abre solo. Para un formulario abierto
  // desde una subcarpeta, es el grupo de esa subcarpeta (CM1).
  const activeBranchKey = folderModel.activeGroup ?? branchOf(location.pathname)?.labelKey;
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
  // A form opened from the menu keeps the panel of its folder open (CM1).
  const routePanel = activeEntry ? activeEntry.panel : isAdministrationPath(location.pathname) ? "admin" : isWhatsAppPath(location.pathname) ? "whatsapp" : isFormsPath(location.pathname) ? "forms" : undefined;
  const [openPanel, setOpenPanel] = useState<string | undefined>(routePanel);
  const [lastRoutePanel, setLastRoutePanel] = useState(routePanel);
  if (routePanel !== lastRoutePanel) {
    setLastRoutePanel(routePanel);
    setOpenPanel(routePanel);
  }
  // The folder just created opens as soon as the menu brings it (CM2); a folder that leaves the menu (deleted, or moved into
  // another one) closes its panel (CM6). Both are decided in the render, like the panel of the route.
  const created = folderMenu?.created ?? null;
  const [openedCreated, setOpenedCreated] = useState<string | null>(null);
  if (created !== null && created !== openedCreated && folderModel.own.some(panel => panel.folder.id === created)) {
    setOpenedCreated(created);
    setOpenPanel(folderPanelPrefix + created);
  } else if (openPanel?.startsWith(folderPanelPrefix) && folderMenu?.content && !folderModel.own.some(panel => panel.labelKey === openPanel)) {
    setOpenPanel(undefined);
  }
  const panelOpen = openPanel === "admin";
  const setPanelOpen = (next: boolean | ((previous: boolean) => boolean)) => {
    const value = typeof next === "function" ? next(panelOpen) : next;
    setOpenPanel(value ? "admin" : undefined);
  };

  function toggleBranch(labelKey: string) {
    setOpenBranchKeys((previous) =>
      previous.includes(labelKey) ? previous.filter((key) => key !== labelKey) : [...previous, labelKey],
    );
  }

  // En el teléfono cada panel (Administración, WhatsApp, Formularios y cada carpeta) es un grupo más del cajón, así
  // que su apertura tiene que contestar por el mismo camino que la de cualquier grupo, aunque el estado que la
  // guarda sea el del panel: también ahí se abre uno a la vez.
  const panelOf = (labelKey: string) => labelKey === forms.labelKey ? "forms" : labelKey === administration.labelKey ? "admin"
    : labelKey === whatsapp.labelKey ? "whatsapp" : labelKey.startsWith(folderPanelPrefix) ? labelKey : undefined;
  const controls: BranchControls = {
    isOpen: (labelKey) => { const panel = panelOf(labelKey); return panel === undefined ? openBranchKeys.includes(labelKey) : openPanel === panel; },
    toggle: (labelKey) => { const panel = panelOf(labelKey); if (panel === undefined) toggleBranch(labelKey); else setOpenPanel(openPanel === panel ? undefined : panel); },
  };

  useEffect(() => {
    if (!isMobile || !mobileOpen) {
      return;
    }

    // An Escape that a menu, a list or a dialog over the drawer already took (Radix marks it) closes only that one.
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented) {
        onCloseMobile();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isMobile, mobileOpen, onCloseMobile]);

  // Contraída a solo íconos únicamente en escritorio: el cajón de móvil siempre se ve expandido.
  const iconsOnly = collapsed && !isMobile;
  const onNavigate = isMobile ? onCloseMobile : undefined;
  // A link of an optional module («Biblioteca») shows only once the presentation says it is installed.
  const installedFeatures = useSystemPresentation().data?.installedFeatures;
  const allows = (permission?: PermissionRequirement, feature?: string) => (isPending || !permission || has(permission)) && (!feature || installedFeatures?.includes(feature) === true);
  // «Consumo» (CO1-B) shows with any of its pairs of permission and module.
  const canSee = (link: NavigationLink) => link.access ? link.access.some(pair => allows(pair.permission, pair.feature)) : allows(link.permission, link.feature);
  // Sin nombre no hay renglón de abajo: el del nombre ya muestra el correo o el número.
  const accountDetail = user ? accountDetailOf(user) : undefined;

  // El panel no se aplana nunca: se ve expandido aunque la barra esté contraída, que es justamente lo que lo
  // hace mejor que un desplegable de 40px.
  const adminItems = visibleItems(administration.items, canSee, false);
  const adminPending = isPending && administration.items.every(dependsOnPermissions);
  const showAdministration = adminItems.length > 0;
  const whatsappItems = visibleItems(whatsapp.items, canSee, false);
  const responses = useContext(FormsOverviewNavigationContext);
  const activateResponses = responses?.setActive;
  useEffect(() => { activateResponses?.(openPanel === "forms" && (!isMobile || mobileOpen)); }, [activateResponses, openPanel, isMobile, mobileOpen]);
  // «Formularios» and «Documentos recibidos» are drawn with their counters (FormsOverviewLink, ReceivedDocumentsLink), first and
  // together, with a line before the pages used to build forms (FU1-B, FormsDailyLinks).
  const formsPages = visibleItems(forms.items.filter(item => item.labelKey !== "navigation.formOverview" && item.labelKey !== "navigation.receivedDocuments"), canSee, false);
  const formsCounted = has(["formtemplates.read", "formrecords.read", "formapprovals.decide", "formrecords.create", "formdocuments.read"]);
  const ownPanel = folderModel.own.find(panel => panel.labelKey === openPanel);
  const selectedPanel = openPanel === "forms" ? forms : openPanel === "whatsapp" ? whatsapp : ownPanel ?? administration;
  const selectedItems = openPanel === "forms" ? formsPages : openPanel === "whatsapp" ? whatsappItems : ownPanel ? ownPanel.items : openPanel === "admin" ? adminItems : [];
  const PanelIcon = selectedPanel.icon;
  // A folder's panel shows also empty: only whoever administers gets an empty folder, with what to do in it.
  const panelVisible = (selectedItems.length > 0 || openPanel === "forms" && formsCounted || ownPanel !== undefined) && openPanel !== undefined && !isMobile;

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
          "navigation-surface relative flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]",
          isMobile
            ? cn(
                "fixed top-12 bottom-0 left-0 z-50 w-55 transition-transform duration-200",
                mobileOpen ? "translate-x-0" : "-translate-x-full",
              )
            // z-30: la flecha de colapsar sale por fuera del borde derecho, y sin esto queda tapada por la
            // banda del encabezado de la pantalla, que es `sticky z-20` y se pinta después.
            : cn("h-svh shrink-0 transition-[width] duration-200 z-30", iconsOnly ? "w-14" : "w-55"),
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
            className={sidebarEdgeToggleClassName}
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
          {isError ? <MenuLoadError iconsOnly={iconsOnly} onRetry={() => void refetch()} />
            : folderMenu?.failed ? <MenuLoadError iconsOnly={iconsOnly} onRetry={folderMenu.retry} /> : null}

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
                          className={cn("rounded-[var(--radius-control)]", iconsOnly ? "size-7.5" : "h-7.5")}
                        />
                      ) : isBranch(item) ? (
                        <NavBranch
                          labelKey={item.labelKey}
                          icon={item.icon}
                          items={item.children}
                          showIcon={false}
                          controls={controls}
                          translate={translate}
                          onNavigate={onNavigate}
                        />
                      ) : (
                        <NavItem
                          item={item}
                          label={t(item.labelKey)}
                          collapsed={iconsOnly}
                          onNavigate={onNavigate}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          {formsPages.length > 0 || formsCounted ? (
            <div className={cn("mt-2 border-t border-[var(--color-border)] pt-2", iconsOnly ? "flex justify-center" : "")}>
              {isPending ? <Skeleton aria-hidden="true" className={iconsOnly ? "size-7.5" : "h-7.5"} /> : isMobile ? (
                <ul><li><NavBranch labelKey={forms.labelKey} icon={forms.icon} items={formsPages} leading={<FormsDailyLinks onNavigate={onNavigate} enteredFromMenu={activeEntry !== null} separated={formsPages.length > 0}/>} controls={controls} translate={translate} onNavigate={onNavigate} /></li></ul>
              ) : (
                <PanelTrigger icon={forms.icon} label={t(forms.labelKey)} open={openPanel === "forms"} collapsed={iconsOnly} panelId={panelId}
                  onToggle={() => setOpenPanel(openPanel === "forms" ? undefined : "forms")} />
              )}
            </div>
          ) : null}
          {/* WhatsApp se separa de Inicio con la misma línea que Administración. */}
          {whatsappItems.length > 0 ? (
            <div className={cn("mt-2 border-t border-[var(--color-border)] pt-2", iconsOnly ? "flex justify-center" : "")}>
              {isPending ? <Skeleton aria-hidden="true" className={iconsOnly ? "size-7.5" : "h-7.5"} /> : isMobile ? (
                <ul><li><NavBranch labelKey={whatsapp.labelKey} icon={whatsapp.icon} items={whatsappItems} controls={controls} translate={translate} onNavigate={onNavigate} /></li></ul>
              ) : (
                <PanelTrigger icon={whatsapp.icon} label={t(whatsapp.labelKey)} open={openPanel === "whatsapp"} collapsed={iconsOnly} panelId={panelId}
                  onToggle={() => setOpenPanel(openPanel === "whatsapp" ? undefined : "whatsapp")} />
              )}
            </div>
          ) : null}

          {/* The folders (CM1): after WhatsApp and before Administración, in the order of the server, with «Nueva carpeta» at
              the end for whoever administers forms. While the menu is read nothing takes their place: a block would leave
              when there are none and lift what is below it. With nothing to show, neither the section nor its line. */}
          {!folderMenu?.pending && (folderModel.own.length > 0 || act) ? (
            <div className="mt-2 border-t border-[var(--color-border)] pt-2">
              <ul className={cn("flex flex-col gap-1", iconsOnly ? "items-center" : "")}>
                {folderModel.own.map(panel => (
                  <li key={panel.labelKey}>
                    {isMobile ? (
                      <NavBranch labelKey={panel.labelKey} icon={panel.icon} items={[]} controls={controls} translate={translate} onNavigate={onNavigate}
                        actions={act ? <FolderActions name={panel.folder.label} items={folderItems(panel.folder, t)} act={act} /> : undefined}
                        trailing={<FolderContents panel={panel} act={act} controls={controls} translate={translate} onNavigate={onNavigate} />} />
                    ) : (
                      <PanelTrigger icon={panel.icon} label={panel.folder.label} open={openPanel === panel.labelKey} collapsed={iconsOnly} panelId={panelId}
                        onToggle={() => setOpenPanel(openPanel === panel.labelKey ? undefined : panel.labelKey)} />
                    )}
                  </li>
                ))}
                {act ? <li><MenuActionRow ref={newFolderRow} label={t("layout.sidebar.newFolder")} collapsed={iconsOnly} onClick={target => act({ kind: "create" }, target)} /></li> : null}
              </ul>
            </div>
          ) : null}

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
                  className={cn("rounded-[var(--radius-control)]", iconsOnly ? "size-7.5" : "h-7.5 w-full")}
                />
              ) : isMobile ? (
                <ul className="flex flex-col gap-1">
                  <li>
                    <NavBranch
                      labelKey={administration.labelKey}
                      icon={administration.icon}
                      items={adminItems}
                      controls={controls}
                      translate={translate}
                      onNavigate={onNavigate}
                    />
                  </li>
                </ul>
              ) : (
                <PanelTrigger
                  icon={administration.icon}
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
          aria-label={translate(selectedPanel.labelKey)}
          className="subnavigation-surface relative z-30 flex h-svh w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]"
        >
          {/* El mismo alto que la marca del menú y que el Topbar: los tres bordes de arriba forman una sola
              línea que cruza la pantalla. */}
          <div className="flex h-12 items-center gap-2 border-b border-[var(--color-border)] px-3">
            <PanelIcon className="size-4 shrink-0 text-[var(--color-content-muted)]" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-content)]">{translate(selectedPanel.labelKey)}</p>
            {ownPanel && act ? <FolderActions name={ownPanel.folder.label} items={folderItems(ownPanel.folder, t)} act={act} /> : null}
          </div>

          <IconButton
            label={openPanel === "forms" ? t("layout.sidebar.closeForms") : openPanel === "admin" ? t("layout.sidebar.closeAdministration") : ownPanel ? t("layout.sidebar.closeMenu", { name: translate(ownPanel.labelKey) }) : t("layout.sidebar.closeWhatsApp")}
            onClick={() => setOpenPanel(undefined)}
            className={sidebarEdgeToggleClassName}
          >
            <ChevronLeftIcon className="size-3" />
          </IconButton>

          <div className="flex-1 overflow-y-auto px-2 pt-2.5 pb-3">
            {openPanel === "forms" ? <FormsDailyLinks onNavigate={onNavigate} enteredFromMenu={activeEntry !== null} separated={formsPages.length > 0}/> : null}
            <ul className="flex flex-col gap-1">
              {ownPanel ? <FolderContents panel={ownPanel} act={act} controls={controls} translate={translate} onNavigate={onNavigate} />
                : <NavItems items={openPanel === "forms" ? formsPages : selectedItems} controls={controls} translate={translate} onNavigate={onNavigate} pending={isPending} />}
            </ul>
          </div>
        </nav>
      ) : null}
    </>
  );
}

/// FU1-B: the group of every day, «Formularios» and «Documentos recibidos», with a line before the pages used to build forms
/// (`separated`); without any of them, neither the group nor the line.
function FormsDailyLinks({onNavigate,enteredFromMenu=false,separated}:{onNavigate?:()=>void;enteredFromMenu?:boolean;separated:boolean}) {
  const { has, isPending } = usePermissions();
  if (!isPending && !has(["formtemplates.read", "formrecords.read", "formapprovals.decide", "formrecords.create", "formdocuments.read"])) return null;
  return <>
    <ul className="flex flex-col gap-1"><FormsOverviewLink onNavigate={onNavigate} enteredFromMenu={enteredFromMenu}/><ReceivedDocumentsLink onNavigate={onNavigate}/></ul>
    {separated ? <div aria-hidden="true" className="my-2 border-t border-[var(--color-border)]"/> : null}
  </>;
}

/// «Formularios», con lo que espera tu decisión. Mientras el número carga, su lugar lo ocupa un bloque de carga en el
/// mismo renglón: debajo no se agrega nada que desaparezca al llegar el número y suba al resto del panel.
function FormsOverviewLink({onNavigate,enteredFromMenu=false}:{onNavigate?:()=>void;enteredFromMenu?:boolean}) {
 const overview=useContext(FormsOverviewNavigationContext);const {t}=useTranslation();const {has,isPending}=usePermissions();
 if(isPending)return <li><Skeleton aria-hidden="true" className="h-7.5 rounded-[var(--radius-control)]"/></li>;
 const link=forms.items.find(item=>item.labelKey==="navigation.formOverview") as NavigationLink;
 if(!has(link.permission!))return null;
 const pending=overview?.pending===true;
 const count=has("formapprovals.decide")&&!pending?overview?.count:undefined;
 return <li><NavItem item={{...link,current:enteredFromMenu?false:undefined}} label={t(link.labelKey)+(count===undefined?"":" ("+count+")")} trailing={pending?<Skeleton aria-hidden="true" className="h-3 w-5 shrink-0"/>:undefined} collapsed={false} onNavigate={onNavigate}/>{!pending&&overview?.failed?<Button variant="ghost" size="sm" onClick={overview.retry}>{t("actions.retry")}</Button>:null}</li>;
}

/// «Documentos recibidos» (DOC5-A), right below «Formularios» (FU1-B), with the documents that wait for someone of
/// the team. It loads like the number of «Formularios»: in the same row, and «Reintentar» below it when the number could not be read.
function ReceivedDocumentsLink({onNavigate}:{onNavigate?:()=>void}) {
  const documents = useContext(FormsOverviewNavigationContext)?.documents;
  const { t, i18n } = useTranslation();
  const { has, isPending } = usePermissions();
  if (isPending) return <li><Skeleton aria-hidden="true" className="h-7.5 rounded-[var(--radius-control)]"/></li>;
  if (!has("formdocuments.read")) return null;
  const link = forms.items.find(item => item.labelKey === "navigation.receivedDocuments") as NavigationLink;
  const pending = documents?.pending === true;
  const count = pending ? undefined : documents?.count;
  return <li>
    <NavItem item={link} label={t(link.labelKey) + (count === undefined ? "" : " (" + formatNumber(count, i18n.language) + ")")} trailing={pending ? <Skeleton aria-hidden="true" className="h-3 w-5 shrink-0"/> : undefined} collapsed={false} onNavigate={onNavigate}/>
    {!pending && documents?.failed ? <Button variant="ghost" size="sm" onClick={documents.retry}>{t("actions.retry")}</Button> : null}
  </li>;
}
