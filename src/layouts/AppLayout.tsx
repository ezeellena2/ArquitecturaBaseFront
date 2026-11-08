import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { useIsSigningOut } from "@/auth/signOutStatus";
import { useProfileLanguageSync } from "@/auth/useLanguagePreference";
import { useLocalStorage } from "@/shared/hooks/useLocalStorage";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { PageLoading } from "@/shared/ui/PageLoading";
import { Spinner } from "@/shared/ui/Spinner";

type SidebarState = "expanded" | "collapsed";

// Las teclas con las que el navegador mueve una página. Con Ctrl, Alt o Cmd son atajos de otra cosa.
const scrollKeys = new Set(["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown", " "]);

/// Caparazón de toda pantalla con sesión (sección 7.2): sidebar + topbar + el contenido de cada módulo
/// (`Outlet`). Envuelve el contenido en Suspense por las páginas que se cargan con `lazy`.
export function AppLayout() {
  const { t } = useTranslation();
  const [sidebarState, setSidebarState] = useLocalStorage<SidebarState>("sidebar", "expanded");
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isSigningOut = useIsSigningOut();
  const shellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);

  // El idioma guardado en la cuenta manda sobre el de este navegador, y acá es donde se aplica: apenas llega
  // el perfil, y para toda pantalla con sesión (sección 9 del spec de la Fase 4).
  useProfileLanguageSync();

  // Re Pág, Av Pág, Inicio, Fin, Espacio y las flechas mueven lo que tiene el foco, y el que scrollea es `main`: con
  // el foco en el menú, en la barra o en ninguna parte (al abrir una pantalla, o cuando se fue el botón que lo tenía)
  // esas teclas no movían nada hasta hacer clic en el contenido. Entonces la tecla le pasa el foco a `main` y el
  // navegador, que mira el foco recién después de avisarle a la página, mueve el contenido con esa misma tecla.
  //
  // Lo que ya tiene la tecla se queda con ella: un control que la usó (`defaultPrevented`, como el menú de usuario
  // con la flecha), un botón con Espacio, y todo lo que está adentro del contenido o en un diálogo, donde un campo, un
  // desplegable o una grilla siguen siendo los que la reciben.
  useEffect(() => {
    function handOverScrollKeys(event: KeyboardEvent) {
      const shell = shellRef.current;
      const content = contentRef.current;
      const focused = document.activeElement;

      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey || !scrollKeys.has(event.key)
        || shell === null || content === null || content.contains(focused)) {
        return;
      }

      const outsideContent = focused === null || focused === document.body || shell.contains(focused);

      if (outsideContent && !(event.key === " " && focused?.closest("button"))) {
        content.focus({ preventScroll: true });
      }
    }

    document.addEventListener("keydown", handOverScrollKeys);

    return () => document.removeEventListener("keydown", handOverScrollKeys);
  }, []);

  const collapsed = sidebarState === "collapsed";

  function toggleCollapsed() {
    setSidebarState((previous) => (previous === "collapsed" ? "expanded" : "collapsed"));
  }

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  // Solo el teléfono: en escritorio el menú se contrae con la flecha de su borde, no desde la barra.
  function toggleMobileMenu() {
    setMobileOpen((previous) => !previous);
  }

  // Keep the transition while UserMenu revokes the server session, clears local data and commits /login.
  if (isSigningOut) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-sm font-medium text-[var(--color-content)]">{t("layout.signingOut")}</p>
      </div>
    );
  }

  // La raíz mide exactamente la pantalla (`h-svh`, no `min-h-svh`) para que el que scrollea sea `<main>` y no
  // el documento. Con `min-h-svh` la raíz crecía con el contenido, `main` nunca desbordaba y la banda de
  // `Page`, que es `sticky` dentro de `main`, se iba con el resto: adherida a un contenedor que no se mueve.
  // Así, además, la barra superior queda siempre a la vista, y el menú lateral scrollea por su cuenta.
  //
  // Al imprimir, la raíz vuelve a crecer con el contenido (`print:h-auto`, y `main` sin recortar): con el alto
  // de una pantalla, de un listado largo salía solo lo que entraba en la primera hoja.
  return (
    <div ref={shellRef} className="flex h-svh print:h-auto">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobileMenu}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar isMobile={isMobile} drawerOpen={mobileOpen} onToggleDrawer={toggleMobileMenu} />

        {/* Sin padding: la banda de encabezado de cada pantalla llega a los bordes. El margen del contenido
            lo pone `Page`, que es el único que sabe dónde termina la banda y dónde empieza el cuerpo.

            `relative` para que `main` contenga lo que se posiciona adentro. Un `sr-only` (como el `legend` de
            cada área del selector de permisos) es `absolute`: sin un ancestro posicionado se ubica respecto
            del documento, `main` no lo recorta, y el que termina scrolleando es el documento, con la barra
            superior incluida. Visto en un navegador: 400 px de más y una barra de scroll ajena.

            `scroll-pt-14` (el alto de la banda de `Page`) porque la banda está adherida arriba de `main` y tapa
            lo que queda debajo. Sin ese margen, el navegador da por visible un control que la banda tapa entero:
            con Shift+Tab, el foco caía detrás de la banda y `main` no se movía (WCAG 2.4.11). Los controles de la
            banda lo compensan con el mismo valor en negativo (ver `Page`): llegar a uno con Tab no mueve `main`.

            `tabIndex={-1}` para que tome el foco cuando le pasan las teclas que mueven la pantalla (ver el efecto
            de arriba) o cuando se hace clic en un lugar vacío del contenido, sin sumarse al recorrido con Tab. Sin
            contorno: no es un control, es la pantalla entera, y el foco visible lo muestran los controles de adentro. */}
        <main
          ref={contentRef}
          tabIndex={-1}
          className="relative min-h-0 flex-1 scroll-pt-14 overflow-y-auto outline-none print:overflow-visible"
        >
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
