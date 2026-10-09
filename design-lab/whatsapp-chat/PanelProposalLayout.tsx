import { useEffect, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet, useLocation } from "react-router";
import { accountDetailOf, accountNameOf, initialOf } from "@/auth/accountName";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { useProfileLanguageSync } from "@/auth/useLanguagePreference";
import { administration, isBranch } from "@/layouts/navigation";
import { Topbar } from "@/layouts/components/Topbar";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { IconButton } from "@/shared/ui/IconButton";
import { ChevronLeftIcon, ChevronRightIcon, HomeIcon, MailIcon, PublicWhatsAppIcon, ShieldIcon, SmartphoneIcon, UsersIcon } from "@/shared/ui/icons";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";

type Panel = "whatsapp" | "administration";
type MenuIcon = ComponentType<{ className?: string }>;
const edgeClass = "absolute top-[62px] -right-2.5 z-30 size-5 rounded-[var(--radius-control)] border border-[var(--color-control-border)] bg-[var(--color-canvas)] text-[var(--color-nav-surface)] hover:bg-[var(--color-subnav-surface)] hover:text-[var(--color-nav-surface)]";

function PanelTrigger({ label, icon: Icon, open, collapsed, onClick }: { label: string; icon: MenuIcon; open: boolean; collapsed: boolean; onClick: () => void }) {
  return <Button type="button" variant="ghost" aria-expanded={open} onClick={onClick} className={cn("w-full justify-start", open ? "bg-[var(--color-surface-muted)]" : "", collapsed ? "justify-center" : "")}>
    <Icon className="size-4 shrink-0" />
    {collapsed ? <span className="sr-only">{label}</span> : <><span className="min-w-0 flex-1 text-left">{label}</span><ChevronRightIcon className={cn("size-4 shrink-0", open ? "rotate-180" : "")} /></>}
  </Button>;
}

function MenuLink({ to, label, icon: Icon, collapsed = false, onNavigate }: { to: string; label: string; icon: MenuIcon; collapsed?: boolean; onNavigate: () => void }) {
  return <NavLink to={to} end={to === "/"} onClick={onNavigate} className={({ isActive }) => cn(
    "relative flex min-h-[30px] items-center gap-2 rounded-[var(--radius-control)] px-2 py-1 text-sm transition-colors",
    isActive ? "bg-[var(--color-surface-muted)] font-medium text-[var(--color-content)] before:absolute before:top-1/2 before:left-0 before:h-4 before:w-[2px] before:-translate-y-1/2 before:bg-[var(--color-brand-600)]" : "text-[var(--color-content-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)]",
    collapsed ? "justify-center" : "",
  )}><Icon className="size-4 shrink-0" /><span className={collapsed ? "sr-only" : "min-w-0 break-words"}>{label}</span></NavLink>;
}

// Composición temporal para revisar dos paneles sin refactorizar el Sidebar
// productivo antes de elegir el diseño. Conserva sus medidas, tokens y Topbar.
export function PanelProposalLayout() {
  const { t } = useTranslation();
  const { t: p } = useTranslation("chatProposal");
  const { t: ai } = useTranslation("llmProposal");
  const { t: f } = useTranslation("finalProposal");
  const { data: user } = useCurrentUser();
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(() => location.pathname.startsWith("/whatsapp") ? "whatsapp" : "administration");
  useProfileLanguageSync();
  const leaf = location.pathname.split("/").at(-1);
  useBreadcrumbLeaf(location.pathname.startsWith("/whatsapp/") ? leaf === "ia" ? ai("title") : leaf === "plantillas" ? f("templates") : leaf === "conexion" ? f("connection") : p(leaf === "contactos" ? "contactsMenu" : "title") : undefined);

  useEffect(() => {
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setDrawerOpen(false); }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);

  const iconsOnly = collapsed && !isMobile;
  const panelLabel = panel === "whatsapp" ? "WhatsApp" : t(administration.labelKey);
  const PanelIcon = panel === "whatsapp" ? PublicWhatsAppIcon : ShieldIcon;
  const closeDrawer = () => setDrawerOpen(false);
  const toggle = (next: Panel) => setPanel(current => current === next ? null : next);
  const links = panel === "whatsapp" ? [
    { to: "/whatsapp/chats", label: p("title"), icon: PublicWhatsAppIcon },
    { to: "/whatsapp/contactos", label: p("contactsMenu"), icon: UsersIcon },
    { to: "/whatsapp/plantillas", label: f("templates"), icon: MailIcon },
    { to: "/whatsapp/conexion", label: f("connection"), icon: SmartphoneIcon },
  ] : administration.items.flatMap(item => isBranch(item) ? item.children : [item]).map(item => ({ ...item, label: t(item.labelKey) }));

  function childrenOf(next: Panel) {
    if (!isMobile || panel !== next) return null;
    return <ul className="ml-[22px] mt-1 flex flex-col gap-1 border-l border-[var(--color-border)] pl-3">
      {links.map(link => <li key={link.to}><MenuLink {...link} onNavigate={closeDrawer} /></li>)}
    </ul>;
  }

  return <div className="flex h-svh print:h-auto">
    {isMobile && drawerOpen ? <button type="button" aria-label={t("layout.sidebar.closeDrawer")} onClick={closeDrawer} className="fixed inset-x-0 top-12 bottom-0 z-40 bg-black/50" /> : null}
    <aside className={cn("navigation-surface relative z-50 flex shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]", isMobile ? cn("fixed top-12 bottom-0 left-0 w-[220px]", drawerOpen ? "translate-x-0" : "-translate-x-full") : iconsOnly ? "w-[56px]" : "w-[220px]")}>
      {!isMobile ? <div className="h-12 shrink-0 border-b border-[var(--color-border)]" /> : null}
      {!isMobile && panel === null ? <IconButton label={t(iconsOnly ? "layout.sidebar.expand" : "layout.sidebar.collapse")} className={edgeClass} onClick={() => setCollapsed(value => !value)}><ChevronLeftIcon className={cn("size-3", iconsOnly ? "rotate-180" : "")} /></IconButton> : null}
      <nav aria-label={t("layout.sidebar.navigation")} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-2">
        <MenuLink to="/" label={t("navigation.dashboard")} icon={HomeIcon} collapsed={iconsOnly} onNavigate={() => { closeDrawer(); setPanel(null); }} />
        <PanelTrigger label="WhatsApp" icon={PublicWhatsAppIcon} collapsed={iconsOnly} open={panel === "whatsapp"} onClick={() => toggle("whatsapp")} />
        {childrenOf("whatsapp")}
        <div className="mt-auto border-t border-[var(--color-border)] pt-2">
          <PanelTrigger label={t(administration.labelKey)} icon={ShieldIcon} collapsed={iconsOnly} open={panel === "administration"} onClick={() => toggle("administration")} />
          {childrenOf("administration")}
        </div>
      </nav>
      {user ? <div className="flex items-center gap-2 border-t border-[var(--color-border)] p-2">
        <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--color-brand-600)] text-xs font-bold text-[var(--color-brand-ink)]">{initialOf(accountNameOf(user))}</span>
        {!iconsOnly ? <div className="min-w-0 py-1"><p className="truncate text-sm font-medium">{accountNameOf(user)}</p><p className="truncate text-xs text-[var(--color-content-muted)]">{accountDetailOf(user)}</p></div> : null}
      </div> : null}
    </aside>
    {!isMobile && panel ? <nav aria-label={panelLabel} className="subnavigation-surface relative z-30 flex h-svh w-[224px] shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--color-border)] px-3"><PanelIcon className="size-4 shrink-0" /><p className="truncate text-sm font-medium">{panelLabel}</p></div>
      <IconButton label={p("closePanel", { name: panelLabel })} className={edgeClass} onClick={() => setPanel(null)}><ChevronLeftIcon className="size-3" /></IconButton>
      <ul className="flex flex-col gap-1 overflow-y-auto px-2 pt-2.5 pb-3">{links.map(link => <li key={link.to}><MenuLink {...link} onNavigate={closeDrawer} /></li>)}</ul>
    </nav> : null}
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Topbar isMobile={isMobile} drawerOpen={drawerOpen} onToggleDrawer={() => setDrawerOpen(value => !value)} />
      <main className="relative min-h-0 flex-1 scroll-pt-14 overflow-y-auto print:overflow-visible"><Outlet /></main>
    </div>
  </div>;
}

export function OutsideProposal() {
  const { t } = useTranslation("chatProposal");
  return <Page title={t("outsideTitle")}><Surface><EmptyState embedded title={t("outsideTitle")} description={t("outsideHint")} /></Surface></Page>;
}
