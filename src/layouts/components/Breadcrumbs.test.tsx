import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { queryClient } from "@/shared/api/queryClient";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

async function breadcrumbs() {
  // Las barras separadoras son `aria-hidden`, así que no salen como `listitem`: esto lee las migas como
  // las lee un lector de pantalla, que es lo que importa.
  return within(await screen.findByRole("navigation", { name: /migas de pan/i })).getAllByRole("listitem");
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
});
