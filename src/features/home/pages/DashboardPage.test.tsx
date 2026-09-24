import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser, phoneOnlyUser } from "@/test/mocks/handlers";
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

    const banner = await screen.findByRole("status");
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
    server.use(http.get("/api/me", () => HttpResponse.json(phoneOnlyUser)));

    const { router } = renderRouteWithProviders("/");

    await userEvent.click(await screen.findByRole("link", { name: "Agregar correo" }));

    expect(await screen.findByRole("heading", { name: "Mi perfil" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/perfil");
    expect(await screen.findByRole("button", { name: "Agregar correo" })).toBeInTheDocument();
  });
});
