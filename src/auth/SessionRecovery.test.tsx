import { act, screen, waitFor, within } from "@testing-library/react";
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

  it("keeps access undecided during recovery and opens the dashboard without flashing the welcome page", async () => {
    // La recuperación se completa a mano para poder mirar la pantalla mientras todavía corre. Antes de que
    // `SessionRecovery` llame a `signinSilent` no hay nada que completar, y eso no puede pasar en silencio: la
    // recuperación no terminaría nunca y el test se quedaría esperando un perfil que no va a llegar.
    let completeRecovery = (): void => {
      throw new Error("signinSilent has not been called yet: there is no recovery in progress to complete.");
    };
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

    // La recuperación está en curso recién cuando `signinSilent` fue llamado, y eso pasa en un efecto. El router
    // pinta la pantalla en una transición y React puede correr los efectos en una tarea posterior: con la suite
    // entera en paralelo, `findByRole` encontraba la barra lateral antes de que la recuperación arrancara, y
    // `completeRecovery` todavía no hacía nada. No es cuestión de esperar más: hay que esperar a la llamada.
    await waitFor(() => expect(signinSilent).toHaveBeenCalledTimes(1));

    // La portada no aparece antes de decidir si existe una sesión en el servidor.
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Crear una cuenta" })).not.toBeInTheDocument();
    // Lo único que falta son los datos: todavía no llegó el perfil, así que no se muestra ninguno.
    expect(screen.queryByText("ana@example.com")).not.toBeInTheDocument();

    completeRecovery();

    // Los bloques de carga se rellenan solos, en la misma pantalla: ni recarga, ni cambio de URL.
    const sidebar = await screen.findByRole("complementary");
    expect(await within(sidebar).findByText("ana@example.com")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Inicio" })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).not.toBe("public");
    expect(signinSilent).toHaveBeenCalledTimes(1);
    // El rebote que se veía al recargar: `LoginPage` sacaba el navegador entero de la aplicación.
    expect(signinRedirect).not.toHaveBeenCalled();
  });

  it("stays at the public welcome page when the server has no session", async () => {
    signinSilent.mockRejectedValue(new Error("login_required"));

    renderRouteWithProviders("/");

    // La falta de cookie termina en la portada, sin una redirección interactiva.
    expect(await screen.findByRole("link", { name: "Crear una cuenta" })).toBeInTheDocument();
    expect(signinRedirect).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Español" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(signinSilent).toHaveBeenCalledTimes(1);
  });

  it("does not try to recover the session when there is already one in memory", async () => {
    auth.isAuthenticated = true;
    auth.user = signedInUser;

    renderRouteWithProviders("/");

    const sidebar = await screen.findByRole("complementary");
    expect(await within(sidebar).findByText("ana@example.com")).toBeInTheDocument();
    expect(signinSilent).not.toHaveBeenCalled();
  });

  it("does not touch the callback, which does its own exchange", async () => {
    renderRouteWithProviders("/auth/callback");

    expect(await screen.findByText("Iniciando sesión…")).toBeInTheDocument();
    expect(signinSilent).not.toHaveBeenCalled();
  });

  it("does not restart recovery when an anonymous visitor comes back from login", async () => {
    const { router } = renderRouteWithProviders("/");
    await screen.findByRole("link", { name: "Crear una cuenta" });
    await act(() => router.navigate("/login"));
    await screen.findByRole("textbox", { name: "Correo electrónico" });
    await act(() => router.navigate("/"));
    await screen.findByRole("link", { name: "Crear una cuenta" });
    expect(signinSilent).toHaveBeenCalledTimes(1);
  });

  it("does not recover a session again after a signed-in visitor logs out", async () => {
    auth.isAuthenticated = true;
    auth.user = signedInUser;
    const { router } = renderRouteWithProviders("/");
    await screen.findByRole("complementary");
    auth.isAuthenticated = false;
    auth.user = undefined;
    await act(() => router.navigate("/login"));
    await screen.findByRole("textbox", { name: "Correo electrónico" });
    await act(() => router.navigate("/"));
    await screen.findByRole("link", { name: "Crear una cuenta" });
    expect(signinSilent).not.toHaveBeenCalled();
  });
});
