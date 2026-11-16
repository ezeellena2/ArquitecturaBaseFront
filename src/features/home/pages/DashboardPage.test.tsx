import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { loginMethodsQueryKey } from "@/shared/api/loginMethods";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser, phoneOnlyUser, whatsappLoginMethods } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const notice = "Agregá un correo para no perder el acceso si cambiás de número.";

describe("DashboardPage", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it("asks an account without email to add one", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json(phoneOnlyUser)));

    renderRouteWithProviders("/");

    await screen.findByText(notice);
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(notice);
    expect(within(banner).getByRole("link", { name: "Agregar correo" })).toHaveAttribute("href", "/perfil");
  });

  it("does not bother an account that has an email", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json(currentUser)));

    renderRouteWithProviders("/");

    await screen.findByRole("heading", { name: "Inicio" });
    await waitFor(() => expect(queryClient.getQueryState(currentUserQueryKey)?.status).toBe("success"));
    expect(screen.queryByText(notice)).not.toBeInTheDocument();
  });

  it("takes to Mi perfil, where the email is added", async () => {
    // La cuenta entra con su número, así que WhatsApp está prendido: el correo nuevo se confirma también con un código a
    // ese número (N11). Sin WhatsApp, «Agregar correo» queda apagado con el porqué.
    server.use(
      http.get("/api/me", () => HttpResponse.json(phoneOnlyUser)),
      http.get("/account/login-methods", () => HttpResponse.json(whatsappLoginMethods)),
    );

    const { router } = renderRouteWithProviders("/");

    await userEvent.click(await screen.findByRole("link", { name: "Agregar correo" }));

    expect(await screen.findByRole("heading", { name: "Mi perfil" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/perfil");
    await waitFor(() => expect(queryClient.getQueryState(loginMethodsQueryKey)?.status).toBe("success"));
    expect(screen.getByRole("button", { name: "Agregar correo" })).toBeEnabled();
  });
});
