import { HttpResponse, http } from "msw";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { User } from "oidc-client-ts";
import type { AuthContextProps } from "react-oidc-context";
import { authConfig } from "./authConfig";
import { useCurrentUser } from "./useCurrentUser";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";

// Se reemplaza el módulo entero, no solo useAuth: el AuthProvider real arma un UserManager y arranca la
// renovación automática, y este test no tiene por qué depender de lo que ese objeto haga con la red. El
// puente con el cliente HTTP sí se ejerce, porque vive en nuestro AppAuthProvider.
vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  type SignedInAuth = Pick<AuthContextProps, "isAuthenticated" | "isLoading" | "user">;

  const auth: SignedInAuth = {
    isAuthenticated: true,
    isLoading: false,
    user: { access_token: "token-123" } as User,
  };

  return {
    ...actual,
    AuthProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useAuth: () => auth as AuthContextProps,
  };
});

function Profile() {
  const { data } = useCurrentUser();

  return <p>{data?.email ?? "sin sesión"}</p>;
}

describe("auth", () => {
  it("keeps the tokens out of browser storage", async () => {
    expect(authConfig.userStore).toBeDefined();
    expect(authConfig.stateStore).toBeDefined();
    expect(JSON.stringify(authConfig)).not.toContain("localStorage");
    expect(authConfig.scope).toBe("openid profile email roles offline_access api");
    expect(authConfig.client_id).toBe("web");

    await authConfig.userStore?.set("token-sonda", "valor");
    await authConfig.stateStore?.set("state-sonda", "valor");

    // Los tokens no tocan ningún storage del navegador; el code_verifier vive en sessionStorage.
    expect(globalThis.localStorage.getItem("oidc.token-sonda")).toBeNull();
    expect(globalThis.sessionStorage.getItem("oidc.token-sonda")).toBeNull();
    expect(globalThis.localStorage.getItem("oidc.state-sonda")).toBeNull();
    expect(globalThis.sessionStorage.getItem("oidc.state-sonda")).toBe("valor");
  });

  it("loads the profile of the signed in user", async () => {
    renderWithProviders(<Profile />);

    expect(await screen.findByText("ana@example.com")).toBeInTheDocument();
  });

  it("sends the token and the language already in the first request", async () => {
    let authorization: string | null = null;
    let language: string | null = null;
    server.use(
      http.get("/api/me", ({ request }) => {
        authorization = request.headers.get("authorization");
        language = request.headers.get("accept-language");

        return HttpResponse.json(currentUser);
      }),
    );

    renderWithProviders(<Profile />);
    await screen.findByText("ana@example.com");

    expect(authorization).toBe("Bearer token-123");
    expect(language).toBe("es");
  });
});
