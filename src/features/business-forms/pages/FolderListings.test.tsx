import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { fixtureLifecycle } from "@/test/visual/formFixtures";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

// Synthetic DTOs for the listings' behavior with folders (CP1-A, CP2-A, CP4); the HTTP contract tests consume the backend
// captures separately.
const north = "0199a0c0-0000-7000-8000-0000000000f3";
const delivery = "0199a0c0-0000-7000-8000-0000000000f2";
const folder = (id: string, parentId: string | null, name: string) => ({ id, parentId, name, revision: 1, menuPlacement: "None", menuIcon: null });
const tree = (canManage: boolean) => ({ folders: [folder(delivery, null, "Repartos"), folder(north, delivery, "Norte")], canManage });
const emptyPage = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false };
const catalogRow = { valueType: "Text", id: "01990000-0000-7000-8000-000000000030", name: "Artículos", description: null, origin: "Manual", optionsCount: 3, usageCount: null, state: "Active", stateReason: null, canEdit: true };
const formRow = { id: "01990000-0000-7000-8000-000000000001", name: { es: "Hoja de ruta" }, prefix: "HDR", questionCount: 4, activeVersionNumber: 1, displayState: "Published", lastChangedAtUtc: "2026-11-10T12:00:00Z", lastChangedBy: null, canEdit: true, lifecycle: fixtureLifecycle() };

function asUser(permissions: string[], canManage = permissions.some(permission => permission.endsWith(".manage"))) {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })), http.get("/api/forms/folders", () => HttpResponse.json(tree(canManage))));
}
beforeEach(async () => { queryClient.clear(); await i18n.changeLanguage("es"); });

describe("Catálogos with folders", () => {
  it("filters by the folder of the address and says it is empty with the folder's name", async () => {
    asUser(["formcatalogs.read"]);
    const requests: URLSearchParams[] = [];
    server.use(http.get("/api/forms/catalogs", ({ request }) => { requests.push(new URL(request.url).searchParams); return HttpResponse.json({ ...emptyPage, filterCounts: { byKind: { all: 0, manual: 0, filters: 0 } } }); }));
    await act(async () => { renderRouteWithProviders(`/catalogos?pageSize=20&carpeta=${north}`); });
    expect(await screen.findByText("No hay catálogos en «Norte»")).toBeInTheDocument();
    expect(requests.at(-1)?.get("folderId")).toBe(north);
    expect(requests.at(-1)?.get("withoutFolder")).toBeNull();
  });

  it("offers «Buscar en todas» when the search finds nothing in the folder, keeping what was written", async () => {
    asUser(["formcatalogs.read"]);
    const requests: URLSearchParams[] = [];
    server.use(http.get("/api/forms/catalogs", ({ request }) => { requests.push(new URL(request.url).searchParams); return HttpResponse.json({ ...emptyPage, filterCounts: { byKind: { all: 0, manual: 0, filters: 0 } } }); }));
    let router!: ReturnType<typeof renderRouteWithProviders>["router"];
    await act(async () => { router = renderRouteWithProviders(`/catalogos?pageSize=20&search=urea&carpeta=sin-carpeta`).router; });
    expect(await screen.findByText("No hay coincidencias en «Sin carpeta»")).toBeInTheDocument();
    expect(requests.at(-1)?.get("withoutFolder")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Buscar en todas" }));
    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("carpeta")).toBeNull());
    expect(new URLSearchParams(router.state.location.search).get("search")).toBe("urea");
  });

  it("puts «Carpetas…» in the row menu only for whoever manages catalogs, and opens its dialog", async () => {
    asUser(["formcatalogs.read", "formcatalogs.manage"]);
    server.use(http.get("/api/forms/catalogs", () => HttpResponse.json({ ...emptyPage, items: [catalogRow], totalCount: 1, totalPages: 1, filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } } })),
      http.get(`/api/forms/catalogs/${catalogRow.id}/folders`, () => HttpResponse.json({ folderIds: [north] })));
    await act(async () => { renderRouteWithProviders("/catalogos?pageSize=20"); });
    await userEvent.click(await screen.findByRole("button", { name: "Carpetas de «Artículos»" }));
    const dialog = await screen.findByRole("dialog", { name: "Carpetas de «Artículos»" });
    expect(await within(dialog).findByRole("checkbox", { name: "Norte" })).toBeChecked();
  });

  it("shows the tree without the + nor «Carpetas…» to whoever only reads", async () => {
    asUser(["formcatalogs.read"]);
    server.use(http.get("/api/forms/catalogs", () => HttpResponse.json({ ...emptyPage, items: [catalogRow], totalCount: 1, totalPages: 1, filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } } })));
    await act(async () => { renderRouteWithProviders("/catalogos?pageSize=20"); });
    const panel = await screen.findByRole("region", { name: "Carpetas" });
    expect(await within(panel).findByRole("button", { name: "Repartos" })).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: "Agregar carpeta" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carpetas de «Artículos»" })).not.toBeInTheDocument();
  });
});

describe("Diseñar formularios and Formularios with folders", () => {
  it("counts and lists the forms of the folder, and puts «Carpetas…» in the row menu", async () => {
    asUser(["formtemplates.read", "formtemplates.manage"]);
    const lists: URLSearchParams[] = [];
    const facets: URLSearchParams[] = [];
    server.use(
      http.get("/api/forms/definitions/facets", ({ request }) => { facets.push(new URL(request.url).searchParams); return HttpResponse.json({ active: 1, published: 1, drafts: 0, deactivated: 0 }); }),
      http.get("/api/forms/definitions", ({ request }) => { lists.push(new URL(request.url).searchParams); return HttpResponse.json({ ...emptyPage, items: [formRow], totalCount: 1, totalPages: 1 }); }),
      http.get(`/api/forms/definitions/${formRow.id}/folders`, () => HttpResponse.json({ folderIds: [] })),
    );
    await act(async () => { renderRouteWithProviders(`/formularios?pageSize=20&carpeta=${delivery}`); });
    await userEvent.click(await screen.findByRole("button", { name: "Carpetas de «Hoja de ruta»" }));
    expect(lists.at(-1)?.get("folderId")).toBe(delivery);
    expect(facets.at(-1)?.get("folderId")).toBe(delivery);
    const dialog = await screen.findByRole("dialog", { name: "Carpetas de «Hoja de ruta»" });
    expect(await within(dialog).findByRole("checkbox", { name: "Repartos" })).not.toBeChecked();
  });

  it("filters «Formularios» by the folder for whoever only loads", async () => {
    asUser(["formrecords.create"], false);
    const requests: URLSearchParams[] = [];
    server.use(http.get("/api/forms/overview", ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json({ forms: { ...emptyPage }, filterCounts: { active: 0, deactivated: 0, deactivatedPending: null } });
    }));
    await act(async () => { renderRouteWithProviders(`/formularios/respuestas?pageSize=20&carpeta=${north}`); });
    expect(await screen.findByText("No hay formularios en «Norte»")).toBeInTheDocument();
    expect(requests.at(-1)?.get("folderId")).toBe(north);
  });

  // CP4: with a search or a filter, an empty folder offers «Buscar en todas» and «Limpiar filtros», as in the other listings.
  it("offers «Limpiar filtros» in an empty folder of «Formularios» with a search, keeping the folder", async () => {
    asUser(["formrecords.create"], false);
    server.use(http.get("/api/forms/overview", () => HttpResponse.json({ forms: { ...emptyPage }, filterCounts: { active: 0, deactivated: 0, deactivatedPending: null } })));
    let router!: ReturnType<typeof renderRouteWithProviders>["router"];
    await act(async () => { router = renderRouteWithProviders(`/formularios/respuestas?pageSize=20&search=urea&carpeta=${north}`).router; });
    expect(await screen.findByText("No hay coincidencias en «Norte»")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buscar en todas" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("search")).toBeNull());
    expect(new URLSearchParams(router.state.location.search).get("carpeta")).toBe(north);
  });
});
