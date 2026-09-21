import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

describe("Sidebar", () => {
  // AppProviders usa el queryClient de la app (un singleton). Sin esto, la respuesta de /api/me de un test
  // queda cacheada (staleTime: 30s) y se filtra al siguiente, que pisó el handler con otro permiso.
  beforeEach(() => {
    queryClient.clear();
  });

  it("hides the items whose permission the user does not have", async () => {
    // El handler por defecto de /api/me devuelve permissions: ["users.read"].
    renderRouteWithProviders("/");

    expect(await screen.findByRole("link", { name: /usuarios/i })).toBeInTheDocument();
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
    await within(sidebar).findByText(currentUser.email);
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
});
