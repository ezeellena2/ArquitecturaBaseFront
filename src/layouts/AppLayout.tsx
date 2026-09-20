import { Suspense, useState } from "react";
import { Outlet } from "react-router";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { useLocalStorage } from "@/shared/hooks/useLocalStorage";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { Spinner } from "@/shared/ui/Spinner";

type SidebarState = "expanded" | "collapsed";

/// Caparazón de toda pantalla con sesión (sección 7.2): sidebar + topbar + el contenido de cada módulo
/// (`Outlet`). Envuelve el contenido en Suspense por las páginas que se cargan con `lazy`.
export function AppLayout() {
  const [sidebarState, setSidebarState] = useLocalStorage<SidebarState>("sidebar", "expanded");
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");

  const collapsed = sidebarState === "collapsed";

  function toggleCollapsed() {
    setSidebarState((previous) => (previous === "collapsed" ? "expanded" : "collapsed"));
  }

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  function toggleSidebar() {
    if (isMobile) {
      setMobileOpen((previous) => !previous);
    } else {
      toggleCollapsed();
    }
  }

  return (
    <div className="flex min-h-svh">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobileMenu}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar sidebarExpanded={isMobile ? mobileOpen : !collapsed} onToggleSidebar={toggleSidebar} />

        <main className="flex-1 overflow-y-auto p-6">
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
