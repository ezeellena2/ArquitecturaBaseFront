import { screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { User } from "oidc-client-ts";
import type { AuthContextProps } from "react-oidc-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

const signedInUser = { access_token: "token-123" } as User;

const signinSilent = vi.fn<() => Promise<User | null>>();
const signinRedirect = vi.fn<() => Promise<void>>();

type FakeAuth = Pick<AuthContextProps, "isAuthenticated" | "isLoading" | "user" | "signinSilent" | "signinRedirect">;

// Se reemplaza el módulo entero, como en auth.test.tsx: el AuthProvider real arma un UserManager y saldría a
// la red de verdad. Acá lo que se prueba es qué hace la aplicación con lo que ese objeto responde.
const auth: FakeAuth = {
  isAuthenticated: false,
  isLoading: false,
  user: undefined,
  signinSilent,
  signinRedirect,
};

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return {
    ...actual,
    AuthProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useAuth: () => auth as AuthContextProps,
  };
});

describe("SessionRecovery", () => {
  beforeEach(() => {
    // El queryClient de AppProviders es un singleton con staleTime propio (mismo patrón que UsersPage.test).
    queryClient.clear();
    auth.isAuthenticated = false;
    auth.user = undefined;
    signinSilent.mockReset().mockResolvedValue(null);
    signinRedirect.mockReset().mockResolvedValue(undefined);
  });

  it("recovers the session in the background instead of bouncing through the login screen", async () => {
    // La recuperación se completa a mano para poder mirar la transición mientras corre.
    let completeRecovery = () => {};
    signinSilent.mockImplementation(
      () =>
        new Promise<User>((resolve) => {
          completeRecovery = () => {
            auth.isAuthenticated = true;
            auth.user = signedInUser;
            resolve(signedInUser);
          };
        }),
    );

    renderRouteWithProviders("/");

    expect(await screen.findByText("Restaurando tu sesión…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Mientras corre no se monta nada abajo, así que ProtectedRoute nunca ve el estado intermedio.
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

    completeRecovery();

    expect(await screen.findByRole("heading", { level: 1, name: "Inicio" })).toBeInTheDocument();
    expect(signinSilent).toHaveBeenCalledTimes(1);
    // El rebote que se veía al recargar: `LoginPage` sacaba el navegador entero de la aplicación.
    expect(signinRedirect).not.toHaveBeenCalled();
  });

  it("ends at the login screen, and not stuck in the transition, when the server has no session", async () => {
    signinSilent.mockRejectedValue(new Error("login_required"));

    renderRouteWithProviders("/");

    // Sin `returnUrl` la pantalla de ingreso no muestra el formulario: dispara el redirect de OIDC, que es el
    // camino que ya existía para quien no tiene sesión.
    await waitFor(() => expect(signinRedirect).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("button", { name: "Español" })).toBeInTheDocument();
    expect(screen.queryByText("Restaurando tu sesión…")).not.toBeInTheDocument();
    expect(signinSilent).toHaveBeenCalledTimes(1);
  });

  it("does not try to recover the session when there is already one in memory", async () => {
    auth.isAuthenticated = true;
    auth.user = signedInUser;

    renderRouteWithProviders("/");

    expect(await screen.findByRole("heading", { level: 1, name: "Inicio" })).toBeInTheDocument();
    expect(signinSilent).not.toHaveBeenCalled();
  });

  it("does not touch the callback, which does its own exchange", async () => {
    renderRouteWithProviders("/auth/callback");

    expect(await screen.findByText("Iniciando sesión…")).toBeInTheDocument();
    expect(signinSilent).not.toHaveBeenCalled();
  });
});
