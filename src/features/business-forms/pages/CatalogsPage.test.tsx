import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

it("uses server origin counts for the whole query and resets the page when choosing an origin", async () => {
  // Synthetic current DTO projection, deliberately one row but 100 matching catalogs.
  const page = { items: [{ id: "01990000-0000-7000-8000-000000000030", name: "Supervisores", description: null, origin: "Filters", optionsCount: null, usageCount: null, state: "Unavailable", stateReason: "Forms.Catalog.SourceUnavailable", canEdit: false }], page: 5, pageSize: 1, totalCount: 20, totalPages: 20, hasPrevious: true, hasNext: true, filterCounts: { byKind: { all: 100, manual: 80, filters: 20 } } };
  setup(["formcatalogs.read"]); const requests: URLSearchParams[] = [];
  server.use(http.get("/api/forms/catalogs", ({ request }) => { requests.push(new URL(request.url).searchParams); return HttpResponse.json(page); }));
  let router!: ReturnType<typeof renderRouteWithProviders>["router"];
  await act(async () => { router = renderRouteWithProviders("/catalogos?page=5&pageSize=1&sort=name").router; });
  const user = userEvent.setup(); await user.click(await screen.findByRole("button", { name: "De la base (20)" }));
  await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("kind")).toBe("Filters"));
  expect(new URLSearchParams(router.state.location.search).get("page")).toBeNull(); expect(new URLSearchParams(router.state.location.search).get("sort")).toBe("name");
  expect(screen.getByRole("button", { name: "Todos (100)" })).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Escritas a mano (80)" })).toBeInTheDocument();
  await waitFor(() => expect(requests.some(request => request.get("kind") === "Filters" && request.get("page") === "1")).toBe(true));
  expect(screen.queryByText("Forms.Catalog.SourceUnavailable", { exact: true })).not.toBeInTheDocument(); expect(screen.getByText("La vista Usuarios no está disponible.")).toBeInTheDocument();
});

it("requests the Unavailable state from the server and preserves origin/search/sort", async () => {
  setup(["formcatalogs.read"]); const requests: URLSearchParams[] = [];
  server.use(http.get("/api/forms/catalogs", ({ request }) => { requests.push(new URL(request.url).searchParams); return HttpResponse.json({ items: [], page: 1, pageSize: 1, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 0, manual: 0, filters: 0 } } }); }));
  let router!: ReturnType<typeof renderRouteWithProviders>["router"];
  await act(async () => { router = renderRouteWithProviders("/catalogos?page=5&pageSize=1&kind=Filters&sort=-name&search=supervisores").router; });
  const user = userEvent.setup(); const trigger = await screen.findByRole("button", { name: /^Estado:/ }); trigger.focus(); await user.keyboard("{Enter}"); await user.click(await screen.findByRole("menuitem", { name: "No se puede usar" }));
  await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("state")).toBe("Unavailable")); const params = new URLSearchParams(router.state.location.search);
  expect(params.get("kind")).toBe("Filters"); expect(params.get("search")).toBe("supervisores"); expect(params.get("sort")).toBe("-name"); expect(params.get("page")).toBeNull();
  await waitFor(() => expect(requests.some(request => request.get("state") === "Unavailable")).toBe(true)); expect(requests.at(-1)!.has("isActive")).toBe(false);
});
