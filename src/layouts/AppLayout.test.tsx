import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelSignOut } from "@/auth/signOutStatus";
import { queryClient } from "@/shared/api/queryClient";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

const signoutRedirect = vi.fn();

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return {
    ...actual,
    useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" }, signoutRedirect }),
  };
});

// Igual que UserMenu.test.tsx: con teclado (foco + Enter), no userEvent.click, para no chocar con el
// pointerdown de Radix.
async function signOut() {
  const trigger = await screen.findByRole("button", { name: /ana/i });
  trigger.focus();
  await userEvent.keyboard("{Enter}");

  await userEvent.click(await screen.findByRole("menuitem", { name: /cerrar sesión/i }));
}

describe("AppLayout", () => {
  beforeEach(() => {
    queryClient.clear();
    signoutRedirect.mockReset();
  });

  afterEach(() => {
    // El store de signOutStatus es un módulo compartido (a propósito, para no sumar un provider): sin esto,
    // un cierre de sesión que quedó "en curso" en un test se filtra al siguiente.
    cancelSignOut();
  });

  it("shows the sign-out transition instead of the layout with empty data", async () => {
    // signoutRedirect real navega afuera de la SPA y nunca resuelve desde el punto de vista de React: una
    // promesa que no se resuelve reproduce eso.
    signoutRedirect.mockReturnValue(new Promise(() => {}));

    renderRouteWithProviders("/");

    expect(await screen.findByRole("complementary")).toBeInTheDocument();

    await signOut();

    expect(await screen.findByText("Cerrando sesión…")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
    // Reemplaza todo el layout, no lo deja dibujado con los datos vacíos.
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("reverts the transition and lets the layout render again if signing out fails", async () => {
    // El rechazo (y el cancelSignOut del catch) puede resolverse en el mismo lote de microtareas que el
    // click: lo que importa es el estado final, no alcanzar a ver la transición a mitad de camino.
    signoutRedirect.mockRejectedValue(new Error("no se pudo cerrar la sesión"));

    renderRouteWithProviders("/");

    expect(await screen.findByRole("complementary")).toBeInTheDocument();

    await signOut();

    await waitFor(() => expect(screen.getByRole("complementary")).toBeInTheDocument());
    expect(screen.queryByText("Cerrando sesión…")).not.toBeInTheDocument();
  });
});
