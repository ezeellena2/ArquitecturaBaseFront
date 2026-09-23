import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import { renderRouteWithProviders, renderWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
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

  it("names an account without email nor name by its number", async () => {
    // Una cuenta creada desde WhatsApp: `/api/me` trae el correo y el nombre en null.
    server.use(
      http.get("/api/me", () =>
        HttpResponse.json({ ...currentUser, email: null, displayName: null, phoneNumber: "+5493511234567" }),
      ),
    );

    renderRouteWithProviders("/");

    const sidebar = await screen.findByRole("complementary");
    expect((await within(sidebar).findAllByText("+5493511234567")).length).toBeGreaterThan(0);
    expect(within(sidebar).getByText("5")).toBeInTheDocument();
  });

  it("shows Roles and Configuración only to whoever has their permissions", async () => {
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["roles.read", "settings.manage"] })),
    );

    renderRouteWithProviders("/");

    await userEvent.click(await screen.findByRole("button", { name: /gestión de usuarios/i }));

    expect(screen.getByRole("link", { name: /roles y permisos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /configuración/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^usuarios$/i })).not.toBeInTheDocument();
  });

  describe("submenu", () => {
    it("starts folded away from its screens and unfolds when pressed", async () => {
      withBothPermissions();

      renderRouteWithProviders("/");

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

      // Entrar directo a /roles (un favorito, una recarga) tiene que mostrar dónde estás, no un grupo
      // plegado: el grupo de la ruta activa se despliega solo.
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

      renderRouteWithProviders("/configuracion");

      // Configuración es el otro ítem del mismo grupo rotulado: esperar a que aparezca prueba que los
      // permisos ya llegaron, así la ausencia del grupo no es la del menú todavía pendiente.
      expect(await screen.findByRole("link", { name: /configuración/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /gestión de usuarios/i })).not.toBeInTheDocument();
    });

    it("flattens the group into loose icons when the bar is collapsed", async () => {
      withBothPermissions();
      globalThis.localStorage.setItem("arquitecturabase.sidebar", '"collapsed"');

      renderRouteWithProviders("/");

      // Contraída la barra es un lanzador, no un mapa: no hay grupo que desplegar y las dos pantallas
      // quedan a un clic, con su nombre para el lector de pantalla.
      expect(await screen.findByRole("link", { name: /^usuarios$/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /roles y permisos/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /gestión de usuarios/i })).not.toBeInTheDocument();
    });
  });
});
