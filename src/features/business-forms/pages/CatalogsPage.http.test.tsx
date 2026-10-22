import { act, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { queryClient } from "@/shared/api/queryClient";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import i18n from "@/shared/i18n";
import listRaw from "@/test/fixtures/catalogs-http/manual-current/list-es.json";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
function setup(permissions: string[]) { server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })), http.get("/api/forms/catalogs", () => HttpResponse.json(listRaw))); }
beforeEach(async () => { queryClient.clear(); await i18n.changeLanguage("es"); });
  it("lists the raw localized page with Read, hides New without Manage, and opens the catalog panel", async () => {
    setup(["formcatalogs.read"]);
    await act(async () => { renderRouteWithProviders("/catalogos?page=2&pageSize=1&sort=name"); });
    expect(await screen.findByRole("link", { name: listRaw.items[0]!.name })).toHaveAttribute("href", "/catalogos/" + listRaw.items[0]!.id);
    expect(screen.queryByRole("button", { name: "Nuevo catálogo" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Catálogos" })).toBeInTheDocument();
  });
