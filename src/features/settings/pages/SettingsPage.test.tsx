import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const admin = { ...currentUser, permissions: ["settings.manage"] };

describe("SettingsPage", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows which mode the system is in", async () => {
    server.use(
      http.get("/api/me", () => HttpResponse.json(admin)),
      http.get("/api/settings", () => HttpResponse.json({ registrationMode: "InviteOnly" })),
    );

    renderRouteWithProviders("/configuracion");

    expect(await screen.findByRole("switch", { name: "Registro abierto" })).not.toBeChecked();
    expect(screen.getByText(/solo por invitación/i)).toBeInTheDocument();
  });

  it("explains what changes before opening the registration, and saves it when confirmed", async () => {
    const saved: unknown[] = [];
    server.use(
      http.get("/api/me", () => HttpResponse.json(admin)),
      http.get("/api/settings", () => HttpResponse.json({ registrationMode: "InviteOnly" })),
      http.put("/api/settings", async ({ request }) => {
        saved.push(await request.json());

        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderRouteWithProviders("/configuracion");

    await userEvent.click(await screen.findByRole("switch", { name: "Registro abierto" }));

    expect(await screen.findByText(/sin que vos la des de alta/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Cambiar" }));

    await waitFor(() => expect(saved).toEqual([{ registrationMode: "Open" }]));
  });

  it("changes nothing when the confirmation is cancelled", async () => {
    let puts = 0;
    server.use(
      http.get("/api/me", () => HttpResponse.json(admin)),
      http.get("/api/settings", () => HttpResponse.json({ registrationMode: "Open" })),
      http.put("/api/settings", () => {
        puts += 1;

        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderRouteWithProviders("/configuracion");

    const toggle = await screen.findByRole("switch", { name: "Registro abierto" });
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);
    await userEvent.click(await screen.findByRole("button", { name: "Cancelar" }));

    expect(puts).toBe(0);
    expect(screen.getByRole("switch", { name: "Registro abierto" })).toBeChecked();
  });

  it("sends whoever lacks settings.manage to the forbidden page", async () => {
    // El handler por defecto de /api/me devuelve permissions: ["users.read"].
    renderRouteWithProviders("/configuracion");

    expect(await screen.findByRole("heading", { name: /no tenés permiso/i })).toBeInTheDocument();
  });
});
