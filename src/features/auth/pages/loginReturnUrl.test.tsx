import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { AuthContextProps } from "react-oidc-context";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

// vi.hoisted porque el vi.mock de abajo se iza arriba de este archivo y ahí el mock todavía no existiría.
const { signinRedirect } = vi.hoisted(() => ({ signinRedirect: vi.fn(() => Promise.resolve()) }));

// Se reemplaza el módulo entero, como en auth.test.tsx: lo único que se mira acá es si el ingreso arranca el
// redirect de OIDC, no lo que el UserManager real haría con la red.
vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  type AnonymousAuth = Pick<AuthContextProps, "isAuthenticated" | "isLoading" | "user" | "signinRedirect">;

  const auth: AnonymousAuth = {
    isAuthenticated: false,
    isLoading: false,
    user: undefined,
    signinRedirect,
  };

  return {
    ...actual,
    AuthProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useAuth: () => auth as AuthContextProps,
  };
});

const authorizeUrl = "/connect/authorize?client_id=web";

describe("el returnUrl del ingreso", () => {
  beforeEach(() => {
    signinRedirect.mockClear();
  });

  it("arranca el ingreso de nuevo cuando alguien abre /login/codigo sin returnUrl", async () => {
    renderRouteWithProviders("/login/codigo");

    await waitFor(() => expect(signinRedirect).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /enviar código/i })).not.toBeInTheDocument();
  });

  it("arranca el ingreso de nuevo cuando el returnUrl no es un pedido de autorización", async () => {
    renderRouteWithProviders(`/login?returnUrl=${encodeURIComponent("/")}`);

    await waitFor(() => expect(signinRedirect).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: /enviar código/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /google/i })).not.toBeInTheDocument();
  });

  it("muestra el formulario y no toca el returnUrl cuando es un pedido de autorización", async () => {
    renderRouteWithProviders(`/login?returnUrl=${encodeURIComponent(authorizeUrl)}`);

    expect(await screen.findByRole("button", { name: /enviar código/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /google/i })).toHaveAttribute(
      "href",
      `/account/external/google?returnUrl=${encodeURIComponent(authorizeUrl)}`,
    );
    expect(signinRedirect).not.toHaveBeenCalled();
  });
});
