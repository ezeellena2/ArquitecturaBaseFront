import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import { renderRouteWithProviders, renderWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser, phoneOnlyUser } from "@/test/mocks/handlers";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

/// Quien tiene las dos pantallas del grupo.
function withBothPermissions() {
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["users.read", "roles.read"] })),
  );
}

/// Quien ve el panel entero: las dos pantallas del grupo y Configuración.
function withEveryAdministrationPermission() {
  server.use(
    http.get("/api/me", () =>
      HttpResponse.json({ ...currentUser, permissions: ["users.read", "roles.read", "settings.manage"] }),
    ),
  );
}

/// Fuera de una ruta de administración el panel arranca cerrado, y sus pantallas no están en el menú: hay
/// que abrirlo, que es exactamente lo que hace quien usa la aplicación.
async function openAdministration() {
  await userEvent.click(await screen.findByRole("button", { name: /^administración$/i }));
}

describe("Sidebar", () => {
  // AppProviders usa el queryClient de la app (un singleton). Sin esto, la respuesta de /api/me de un test
  // queda cacheada (staleTime: 30s) y se filtra al siguiente, que pisó el handler con otro permiso.
  beforeEach(() => {
    queryClient.clear();
    globalThis.localStorage.clear();
  });

  it("hides the items whose permission the user does not have", async () => {
    // El handler por defecto de /api/me devuelve permissions: ["users.read"].
    renderRouteWithProviders("/");

    await openAdministration();
    await userEvent.click(await screen.findByRole("button", { name: /gestión de usuarios/i }));

    expect(screen.getByRole("link", { name: /usuarios/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /roles/i })).not.toBeInTheDocument();
  });

  it("hides Usuarios too when the user does not have users.read", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: [] })));

    renderRouteWithProviders("/");

    // Acotado a la sidebar (el tablero también muestra el correo en su tarjeta de sesión): espera a que
    // resuelva /api/me, la misma consulta que decide qué ítems esconder. Hasta que no termine, "Usuarios"
    // también está ausente por estar todo pendiente, no porque el filtro haya funcionado. El pie de la
    // sidebar solo pinta el correo una vez que esa consulta trajo al usuario.
    const sidebar = await screen.findByRole("complementary");
    await within(sidebar).findByText("ana@example.com");
    expect(within(sidebar).queryByRole("link", { name: /usuarios/i })).not.toBeInTheDocument();
  });

  it("says that the menu could not be loaded instead of shrinking in silence", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ code: "General.Unexpected" }, { status: 500 })));

    renderRouteWithProviders("/");

    const nav = within(await screen.findByRole("navigation", { name: /navegación principal/i }));

    expect(await nav.findByText(/no pudimos cargar tu menú/i)).toBeInTheDocument();
    expect(nav.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("remembers that the menu is collapsed", async () => {
    renderRouteWithProviders("/");

    await userEvent.click(await screen.findByRole("button", { name: /contraer|expandir/i }));

    expect(globalThis.localStorage.getItem("arquitecturabase.sidebar")).toBe('"collapsed"');
  });

  it("names an account without email nor name by its number, formatted for reading", async () => {
    // Una cuenta creada desde WhatsApp: `/api/me` trae el correo y el nombre en null. El número nunca en E.164.
    server.use(http.get("/api/me", () => HttpResponse.json({ ...phoneOnlyUser, displayName: null })));

    renderRouteWithProviders("/");

    const sidebar = await screen.findByRole("complementary");
    // Una sola vez: sin nombre, el número va en el renglón del nombre y el de abajo no lo repite.
    expect(await within(sidebar).findByText("+54 9 11 2345-6789")).toBeInTheDocument();
    expect(within(sidebar).queryByText("+5491123456789")).not.toBeInTheDocument();
    expect(within(sidebar).getByText("5")).toBeInTheDocument();
  });

  it("shows the number where the email would go when the account has a name but no email", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json(phoneOnlyUser)));

    renderRouteWithProviders("/");

    const sidebar = await screen.findByRole("complementary");
    expect(await within(sidebar).findByText("Ana Pérez")).toBeInTheDocument();
    expect(within(sidebar).getByText("+54 9 11 2345-6789")).toBeInTheDocument();
  });

  it("shows Roles and Configuración only to whoever has their permissions", async () => {
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["roles.read", "settings.manage"] })),
    );

    renderRouteWithProviders("/");

    await openAdministration();
    await userEvent.click(await screen.findByRole("button", { name: /gestión de usuarios/i }));

    expect(screen.getByRole("link", { name: /roles y permisos/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /configuración/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^usuarios$/i })).not.toBeInTheDocument();
  });

  describe("administration panel", () => {
    it("opens from the foot of the menu and closes again from the panel", async () => {
      withEveryAdministrationPermission();

      renderRouteWithProviders("/");

      const trigger = await screen.findByRole("button", { name: /^administración$/i });

      // En el Inicio el panel no está: el menú dice a dónde se puede ir sin listarlo todo.
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("navigation", { name: /^administración$/i })).not.toBeInTheDocument();

      await userEvent.click(trigger);

      const panel = screen.getByRole("navigation", { name: /^administración$/i });
      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(within(panel).getByRole("button", { name: /gestión de usuarios/i })).toBeInTheDocument();
      expect(within(panel).getByRole("button", { name: /configuración/i })).toBeInTheDocument();

      await userEvent.click(within(panel).getByRole("button", { name: /cerrar administración/i }));

      expect(screen.queryByRole("navigation", { name: /^administración$/i })).not.toBeInTheDocument();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("opens itself on an administration route", async () => {
      withBothPermissions();

      // Entrar directo a /roles (un favorito, una recarga) tiene que mostrar dónde estás, no un panel
      // cerrado y un menú de un solo ítem.
      renderRouteWithProviders("/roles");

      const panel = await screen.findByRole("navigation", { name: /^administración$/i });
      expect(await within(panel).findByRole("link", { name: /roles y permisos/i })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByRole("button", { name: /^administración$/i })).toHaveAttribute("aria-expanded", "true");
    });

    it("closes itself when leaving administration", async () => {
      withBothPermissions();

      renderRouteWithProviders("/roles");

      await screen.findByRole("navigation", { name: /^administración$/i });

      // Acotado al menú: "Inicio" también es el primer nivel de las migas.
      const menu = screen.getByRole("navigation", { name: /navegación principal/i });
      await userEvent.click(within(menu).getByRole("link", { name: /inicio/i }));

      // El panel es de Administración: fuera de sus rutas, ocupar 264 px con lo que no está en pantalla
      // sería robarle ancho al contenido.
      await waitFor(() => expect(screen.queryByRole("navigation", { name: /^administración$/i })).toBeNull());
    });

    it("hides the collapse arrow while the panel is open", async () => {
      withBothPermissions();

      renderRouteWithProviders("/");

      expect(await screen.findByRole("button", { name: /contraer menú/i })).toBeInTheDocument();

      await openAdministration();

      // Las dos flechas redondas viven sobre el mismo borde y a la misma altura: con el panel abierto se
      // pisarían. Manda la de cerrar el panel, que es la que corresponde a lo que está pasando.
      expect(screen.queryByRole("button", { name: /contraer menú/i })).not.toBeInTheDocument();
    });

    it("stays a button with the bar collapsed, instead of flattening into loose icons", async () => {
      withBothPermissions();
      globalThis.localStorage.setItem("arquitecturabase.sidebar", '"collapsed"');

      renderRouteWithProviders("/");

      // Contraída, esconder destinos detrás de un desplegable de 40 px cambiaría un clic por dos; el panel
      // no: el mismo clic abre las tres pantallas a la vez, con su ancho entero.
      const trigger = await screen.findByRole("button", { name: /^administración$/i });
      expect(screen.queryByRole("link", { name: /^usuarios$/i })).not.toBeInTheDocument();

      await userEvent.click(trigger);

      const panel = screen.getByRole("navigation", { name: /^administración$/i });
      expect(within(panel).getByRole("button", { name: /gestión de usuarios/i })).toBeInTheDocument();
    });

    it("does not show Administración at all to whoever has none of its permissions", async () => {
      server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: [] })));

      renderRouteWithProviders("/");

      // El pie de la barra pinta el correo recién cuando /api/me respondió: hasta entonces la ausencia
      // sería la del menú pendiente, no la del filtro.
      const sidebar = await screen.findByRole("complementary");
      await within(sidebar).findByText("ana@example.com");
      expect(screen.queryByRole("button", { name: /^administración$/i })).not.toBeInTheDocument();
    });

    it("unfolds inside the drawer on the phone, with no second panel", async () => {
      withBothPermissions();

      // El cajón de móvil ya ocupa la pantalla: un panel al lado no entra. Se monta la barra sola, en móvil,
      // porque `useMediaQuery` no cambia con el ancho en jsdom.
      renderWithProviders(
        <MemoryRouter initialEntries={["/"]}>
          <Sidebar collapsed={false} onToggleCollapsed={vi.fn()} isMobile mobileOpen onCloseMobile={vi.fn()} />
        </MemoryRouter>,
      );

      await userEvent.click(await screen.findByRole("button", { name: /^administración$/i }));

      expect(screen.queryByRole("navigation", { name: /^administración$/i })).not.toBeInTheDocument();

      // Los hijos quedan a tres niveles: Administración, el grupo, y la pantalla.
      await userEvent.click(await screen.findByRole("button", { name: /gestión de usuarios/i }));

      expect(screen.getByRole("link", { name: /^usuarios$/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /roles y permisos/i })).toBeInTheDocument();
    });
  });

  describe("submenu", () => {
    it("starts folded away from its screens and unfolds when pressed", async () => {
      withBothPermissions();

      renderRouteWithProviders("/");

      await openAdministration();

      const group = await screen.findByRole("button", { name: /gestión de usuarios/i });

      // En el Inicio ningún hijo está activo: el grupo arranca plegado, y sus pantallas no se dibujan.
      expect(group).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("link", { name: /^usuarios$/i })).not.toBeInTheDocument();

      await userEvent.click(group);

      expect(group).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("link", { name: /^usuarios$/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /roles y permisos/i })).toBeInTheDocument();
    });

    it("opens itself on the screen of one of its children", async () => {
      withBothPermissions();

      // Entrar directo a /roles abre el panel y, adentro, el grupo de la ruta activa.
      renderRouteWithProviders("/roles");

      expect(await screen.findByRole("button", { name: /gestión de usuarios/i })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(await screen.findByRole("link", { name: /roles y permisos/i })).toHaveAttribute("aria-current", "page");
    });

    it("opens itself on a child route of one of its screens, with that screen marked", async () => {
      withBothPermissions();

      // /roles/abc (la pantalla de un rol) no está en el menú, pero es parte de "Roles y permisos". Se monta la
      // barra sola a propósito, en esa URL, para probar la pieza sin la pantalla del rol y lo que pide; el
      // recorrido contra las rutas de verdad vive en `RoleEditorPage.test.tsx`.
      renderWithProviders(
        <MemoryRouter initialEntries={["/roles/abc"]}>
          <Sidebar
            collapsed={false}
            onToggleCollapsed={vi.fn()}
            isMobile={false}
            mobileOpen={false}
            onCloseMobile={vi.fn()}
          />
        </MemoryRouter>,
      );

      expect(await screen.findByRole("button", { name: /gestión de usuarios/i })).toHaveAttribute(
        "aria-expanded",
        "true",
      );
      expect(await screen.findByRole("link", { name: /roles y permisos/i })).toHaveAttribute("aria-current", "page");
    });

    it("stays open while navigating between its children", async () => {
      withBothPermissions();

      renderRouteWithProviders("/roles");

      const users = await screen.findByRole("link", { name: /^usuarios$/i });

      await userEvent.click(users);

      // La ruta es `lazy`: el enlace ya existe, lo que tarda en llegar es que pase a ser el activo.
      await waitFor(() => expect(users).toHaveAttribute("aria-current", "page"));
      expect(screen.getByRole("button", { name: /gestión de usuarios/i })).toHaveAttribute("aria-expanded", "true");
    });

    it("shows a single child to whoever has a single permission", async () => {
      // Este es el riesgo del patrón: que el submenú dibuje sus hijos completos y el permiso se controle
      // recién al entrar. El permiso es de cada hijo, no del grupo. El handler por defecto trae users.read.
      renderRouteWithProviders("/usuarios");

      const group = await screen.findByRole("button", { name: /gestión de usuarios/i });
      const children = within(group.closest("li") as HTMLElement).getAllByRole("link");

      expect(children).toHaveLength(1);
      expect(children[0]).toHaveAccessibleName(/usuarios/i);
    });

    it("does not show the group at all to whoever has none of its permissions", async () => {
      server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["settings.manage"] })));

      server.use(http.get("/api/settings", () => HttpResponse.json({ registrationMode: "InviteOnly", defaultCulture: "es", defaultTimeZoneId: "UTC", defaultPageSize: 20, revision: 1 })));
      renderRouteWithProviders("/configuracion");

      // Configuración es el otro ítem del panel: esperar a que aparezca prueba que los permisos ya llegaron,
      // así la ausencia del grupo no es la del menú todavía pendiente.
      expect(await screen.findByRole("button", { name: /configuración/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /gestión de usuarios/i })).not.toBeInTheDocument();
    });
  });
});
