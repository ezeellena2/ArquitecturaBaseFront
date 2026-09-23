import { screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Breadcrumbs } from "./Breadcrumbs";
import { renderRouteWithProviders, renderWithProviders } from "@/test/utils/renderWithProviders";
import { queryClient } from "@/shared/api/queryClient";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

async function breadcrumbs() {
  // Las barras separadoras son `aria-hidden`, así que no salen como `listitem`: esto lee las migas como
  // las lee un lector de pantalla, que es lo que importa.
  return within(await screen.findByRole("navigation", { name: /migas de pan/i })).getAllByRole("listitem");
}

/// Una pantalla hija de mentira: lo único que hace es poner (o no) el último nivel de las migas, como lo va a
/// hacer la del rol.
function ChildScreen({ leaf }: { leaf?: string }) {
  useBreadcrumbLeaf(leaf);

  return null;
}

/// Las migas sueltas, en una ruta cualquiera. Se prueba la pieza sola a propósito: así cada caso elige la hoja
/// que quiere, incluso ninguna, sin depender de lo que pida una pantalla real. El recorrido contra las rutas
/// de verdad (`/roles/{id}` con el nombre del rol) vive en `RoleEditorPage.test.tsx`.
function renderBreadcrumbsAt(path: string, leaf?: string) {
  return renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <Breadcrumbs />
      <ChildScreen leaf={leaf} />
    </MemoryRouter>,
  );
}

describe("Breadcrumbs", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it("shows the group of a screen that lives inside one", async () => {
    // El fundamento visual sacó la descripción de las pantallas porque el grupo ya se lee en el menú y en
    // las migas. Si las migas se quedaran en dos niveles, ese lugar no existiría.
    renderRouteWithProviders("/usuarios");

    expect((await breadcrumbs()).map((item) => item.textContent)).toEqual([
      "Inicio",
      "Gestión de usuarios",
      "Usuarios",
    ]);
  });

  it("leaves the middle level out for a screen that is not in a group", async () => {
    renderRouteWithProviders("/perfil");

    expect((await breadcrumbs()).map((item) => item.textContent)).toEqual(["Inicio", "Mi perfil"]);
  });

  it("is only Inicio on the dashboard", async () => {
    renderRouteWithProviders("/");

    expect((await breadcrumbs()).map((item) => item.textContent)).toEqual(["Inicio"]);
  });

  describe("on a child route", () => {
    it("links back to the screen it hangs from and ends in the leaf the screen sets", async () => {
      renderBreadcrumbsAt("/roles/abc", "Soporte");

      const items = await breadcrumbs();

      expect(items.map((item) => item.textContent)).toEqual([
        "Inicio",
        "Gestión de usuarios",
        "Roles y permisos",
        "Soporte",
      ]);
      // El padre es un enlace: es el camino de vuelta al listado. La hoja es la página actual.
      expect(within(items[2]).getByRole("link", { name: "Roles y permisos" })).toHaveAttribute("href", "/roles");
      expect(items[3]).toHaveAttribute("aria-current", "page");
    });

    it("ends in the link to its section until the screen sets the leaf", async () => {
      // Mientras la pantalla no dijo cómo se llama, el enlace queda último pero no es la página actual:
      // decir que sí sería anunciar que estás en el listado.
      renderBreadcrumbsAt("/roles/abc");

      const items = await breadcrumbs();

      expect(items.map((item) => item.textContent)).toEqual(["Inicio", "Gestión de usuarios", "Roles y permisos"]);
      expect(within(items[2]).getByRole("link", { name: "Roles y permisos" })).toBeInTheDocument();
      expect(items.filter((item) => item.hasAttribute("aria-current"))).toEqual([]);
    });

    it("does not change the crumbs of the screen itself", async () => {
      // Una hoja que quedó puesta no le agrega un nivel a una ruta que está en el menú.
      renderBreadcrumbsAt("/roles", "Soporte");

      const items = await breadcrumbs();

      expect(items.map((item) => item.textContent)).toEqual(["Inicio", "Gestión de usuarios", "Roles y permisos"]);
      expect(items[2]).toHaveAttribute("aria-current", "page");
      expect(within(items[2]).queryByRole("link")).not.toBeInTheDocument();
    });
  });
});
