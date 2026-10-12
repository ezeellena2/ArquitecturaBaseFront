import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { queryClient } from "@/shared/api/queryClient";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import i18n from "@/shared/i18n";
import listRaw from "@/test/fixtures/catalogs-http/manual/list-es.json";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
function setup(permissions: string[]) { server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })), http.get("/api/forms/catalogs", () => HttpResponse.json(listRaw))); }
beforeEach(async () => { queryClient.clear(); await i18n.changeLanguage("es"); });
describe("Catalog routes and navigation", () => {
  it("lists the raw localized page with Read, hides New without Manage, and opens the catalog panel", async () => {
    setup(["formcatalogs.read"]);
    await act(async () => { renderRouteWithProviders("/catalogos?page=2&pageSize=1&sort=name"); });
    expect(await screen.findByRole("link", { name: listRaw.items[0]!.name })).toHaveAttribute("href", "/catalogos/" + listRaw.items[0]!.id);
    expect(screen.queryByRole("button", { name: "Nuevo catálogo" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Catálogos" })).toBeInTheDocument();
  });
  it("chooses Manual without a write and navigates to the protected editor", async () => {
    setup(["formcatalogs.read", "formcatalogs.manage"]); let writes = 0;
    server.use(http.post("/api/forms/catalogs", () => { writes++; return HttpResponse.json({}, { status: 500 }); }));
    let router!: ReturnType<typeof renderRouteWithProviders>["router"];
    await act(async () => { router = renderRouteWithProviders("/catalogos?pageSize=20").router; });
    const user = userEvent.setup(); await user.click(await screen.findByRole("button", { name: "Nuevo catálogo" }));
    expect(screen.getByRole("radio", { name: "Tomarlas de la base, con filtros" })).toBeEnabled();
    expect(screen.queryByRole("radio", { name: "Escribir una consulta" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/catalogos/nuevo"));
    await screen.findByRole("textbox", { name: "Nombre" });
    expect(writes).toBe(0);
  });
  it.each([{ permissions: ["formcatalogs.manage"] }, { permissions: [] }])("does not open the catalog list without Read: %j", async ({ permissions }) => {
    setup(permissions); let reads = 0;
    server.use(http.get("/api/forms/catalogs", () => { reads++; return HttpResponse.json(listRaw); }));
    let router!: ReturnType<typeof renderRouteWithProviders>["router"];
    await act(async () => { router = renderRouteWithProviders("/catalogos").router; });
    await waitFor(() => expect(router.state.location.pathname).toBe("/sin-permiso"));
    expect(reads).toBe(0);
  });
});
