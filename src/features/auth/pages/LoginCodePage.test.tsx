import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";

const assign = vi.fn();

vi.stubGlobal("location", { ...globalThis.location, assign, origin: "https://localhost:5173" });

// Solo hace falta para el caso sin returnUrl, que termina en /login y ahí dispara el redirect de OIDC
// (LoginPage). El AuthProvider real llamaría a la Api de verdad para arrancarlo; acá no importa que lo haga,
// solo que se intente, así que se reemplaza por un espía como en ProtectedRoute.test.tsx.
const signinRedirect = vi.fn().mockResolvedValue(undefined);

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return {
    ...actual,
    AuthProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useAuth: () => ({ isAuthenticated: false, isLoading: false, user: undefined, signinRedirect }),
  };
});

const returnUrl = "/connect/authorize?client_id=web";

describe("LoginCodePage", () => {
  it("verifies the code and goes to the authorize request", async () => {
    server.use(
      http.post("/account/login-code/verify", () => HttpResponse.json({ returnUrl })),
    );
    renderRouteWithProviders(`/login/codigo?returnUrl=${encodeURIComponent(returnUrl)}`, {
      state: { email: "ana@example.com" },
    });

    await userEvent.type(screen.getAllByRole("textbox")[0], "482913");
    await userEvent.click(screen.getByRole("button", { name: /verificar/i }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith(returnUrl));
  });

  it("shows the message and the attempts left when the code is wrong", async () => {
    server.use(
      http.post("/account/login-code/verify", () =>
        HttpResponse.json(
          { status: 400, code: "Auth.LoginCode.Invalid", detail: "El código no es válido.", attemptsLeft: 4 },
          { status: 400 },
        ),
      ),
    );
    renderRouteWithProviders(`/login/codigo?returnUrl=${encodeURIComponent(returnUrl)}`, {
      state: { email: "ana@example.com" },
    });

    await userEvent.type(screen.getAllByRole("textbox")[0], "000000");
    await userEvent.click(screen.getByRole("button", { name: /verificar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("El código no es válido.");
    expect(screen.getByText(/te quedan 4 intentos/i)).toBeInTheDocument();
  });

  it("waits before letting the code be sent again", async () => {
    renderRouteWithProviders(`/login/codigo?returnUrl=${encodeURIComponent(returnUrl)}`, {
      state: { email: "ana@example.com", resendAfterSeconds: 60 },
    });

    expect(screen.getByRole("button", { name: /reenviar/i })).toBeDisabled();
  });

  it("without returnUrl in the query, does not show the code form and goes through /login", async () => {
    renderRouteWithProviders("/login/codigo");

    // Sin returnUrl no hay contexto del flujo: nunca se ve el formulario del código...
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    // ...y termina en /login sin returnUrl, que es lo que arranca el redirect de OIDC.
    await waitFor(() => expect(signinRedirect).toHaveBeenCalledTimes(1));
  });
});
