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

// Synthetic DTOs for the listings' behavior with folders (CM3, CP2-A, CP4); the HTTP contract tests consume the backend
// captures separately.
const billing = "0199a0c0-0000-7000-8000-0000000000f1";
const delivery = "0199a0c0-0000-7000-8000-0000000000f2";
const north = "0199a0c0-0000-7000-8000-0000000000f3";
const gone = "0199a0c0-0000-7000-8000-0000000000f9";
const folder = (id: string, parentId: string | null, name: string) => ({ id, parentId, name, revision: 1, icon: parentId === null ? "folder" : null });
const tree = (canManage: boolean) => ({ folders: [folder(billing, null, "Facturación"), folder(delivery, null, "Repartos"), folder(north, delivery, "Norte")], canManage });
const emptyPage = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false };
const catalogRow = { valueType: "Text", id: "01990000-0000-7000-8000-000000000030", name: "Artículos", description: null, origin: "Manual", optionsCount: 3, usageCount: null, state: "Active", stateReason: null, canEdit: true };
const formRow = { id: "01990000-0000-7000-8000-000000000001", name: { es: "Hoja de ruta" }, prefix: "HDR", questionCount: 4, activeVersionNumber: 1, displayState: "Published", lastChangedAtUtc: "2026-11-10T12:00:00Z", lastChangedBy: null, canEdit: true, lifecycle: fixtureLifecycle() };
const catalogPage = (items: unknown[] = []) => ({ ...emptyPage, items, totalCount: items.length, totalPages: items.length ? 1 : 0, filterCounts: { byKind: { all: items.length, manual: items.length, filters: 0 } } });

// The tree says `canManage` only to whoever administers forms (CM1 a CM6).
function asUser(permissions: string[]) {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/forms/folders", () => HttpResponse.json(tree(permissions.includes("formtemplates.manage")))));
}
function catalogRequests(items: unknown[] = []) {
  const requests: URLSearchParams[] = [];
  server.use(http.get("/api/forms/catalogs", ({ request }) => { requests.push(new URL(request.url).searchParams); return HttpResponse.json(catalogPage(items)); }));
  return requests;
}
// Radix opens the list of the only piece to choose by keyboard in jsdom.
async function openFolderFilter(name: string | RegExp = /^Carpeta /) {
  const trigger = await screen.findByRole("button", { name });
  act(() => trigger.focus());
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "Carpeta" });
}
const search = (router: ReturnType<typeof renderRouteWithProviders>["router"]) => new URLSearchParams(router.state.location.search);
beforeEach(async () => { queryClient.clear(); await i18n.changeLanguage("es"); });

describe("Catálogos with the «Carpeta» filter", () => {
  it("offers «Todas» apart, «Sin carpeta» and the folders with their subfolders, and puts the chosen one in the address on page 1", async () => {
    asUser(["formcatalogs.read"]);
    const requests = catalogRequests();
    let router!: ReturnType<typeof renderRouteWithProviders>["router"];
    await act(async () => { router = renderRouteWithProviders("/catalogos?page=3&pageSize=20&search=urea&state=Inactive").router; });
    // The listing goes the whole width: no panel of folders beside it.
    expect(screen.queryByRole("region", { name: "Carpetas" })).not.toBeInTheDocument();
    const list = await openFolderFilter("Carpeta Todas las carpetas");
    // O57: the reader hears a subfolder with the folder it goes in; the screen shows it indented.
    expect(await within(list).findByRole("option", { name: "Norte, en Repartos" })).toBeInTheDocument();
    expect(within(list).getAllByRole("option").map(item => item.textContent)).toEqual(["Todas las carpetas", "Sin carpeta", "Facturación", "Repartos", "Norte"]);
    expect(within(list).getByRole("option", { name: "Todas las carpetas" })).toHaveAttribute("aria-selected", "true");
    // «Todas las carpetas» goes apart, behind the only line, and the subfolder goes indented under its folder.
    expect(list.querySelectorAll("li[role=presentation]")).toHaveLength(1);
    expect(within(list).getByRole("option", { name: "Norte, en Repartos" }).style.paddingLeft).not.toBe("");
    await userEvent.click(within(list).getByRole("option", { name: "Norte, en Repartos" }));
    await waitFor(() => expect(search(router).get("carpeta")).toBe(north));
    expect(search(router).get("page")).toBeNull();
    expect(search(router).get("search")).toBe("urea");
    expect(search(router).get("state")).toBe("Inactive");
    await waitFor(() => expect(requests.at(-1)?.get("folderId")).toBe(north));
    expect(await screen.findByRole("button", { name: "Carpeta Norte" })).toBeInTheDocument();
    const again = await openFolderFilter("Carpeta Norte");
    expect(within(again).getByRole("option", { name: "Norte, en Repartos" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(within(again).getByRole("option", { name: "Sin carpeta" }));
    await waitFor(() => expect(search(router).get("carpeta")).toBe("sin-carpeta"));
    await waitFor(() => expect(requests.at(-1)?.get("withoutFolder")).toBe("true"));
    expect(requests.at(-1)?.get("folderId")).toBeNull();
  });

  it("says that a folder is empty with the folder's name", async () => {
    asUser(["formcatalogs.read"]);
    const requests = catalogRequests();
    await act(async () => { renderRouteWithProviders(`/catalogos?pageSize=20&carpeta=${north}`); });
    expect(await screen.findByText("No hay catálogos en «Norte»")).toBeInTheDocument();
    expect(requests.at(-1)?.get("folderId")).toBe(north);
    expect(requests.at(-1)?.get("withoutFolder")).toBeNull();
  });

  it("offers «Buscar en todas» when the search finds nothing in the folder, keeping what was written", async () => {
    asUser(["formcatalogs.read"]);
    const requests = catalogRequests();
    let router!: ReturnType<typeof renderRouteWithProviders>["router"];
    await act(async () => { router = renderRouteWithProviders("/catalogos?pageSize=20&search=urea&carpeta=sin-carpeta").router; });
    expect(await screen.findByText("No hay coincidencias en «Sin carpeta»")).toBeInTheDocument();
    expect(requests.at(-1)?.get("withoutFolder")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Buscar en todas" }));
    await waitFor(() => expect(search(router).get("carpeta")).toBeNull());
    expect(search(router).get("search")).toBe("urea");
  });

  it("goes back to «Todas» with a notice when the folder of the address no longer exists", async () => {
    asUser(["formcatalogs.read"]);
    const requests = catalogRequests();
    let router!: ReturnType<typeof renderRouteWithProviders>["router"];
    await act(async () => { router = renderRouteWithProviders(`/catalogos?pageSize=20&carpeta=${gone}`).router; });
    expect(await screen.findByText("La carpeta de la dirección ya no existe. Te mostramos todos.")).toBeInTheDocument();
    await waitFor(() => expect(search(router).get("carpeta")).toBeNull());
    expect(await screen.findByRole("button", { name: "Carpeta Todas las carpetas" })).toBeInTheDocument();
    await waitFor(() => expect(requests.at(-1)?.has("folderId")).toBe(false));
  });

  it("keeps the listing with «Todas» and offers Reintentar in the filter when the folders cannot be read", async () => {
    let fail = true;
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formcatalogs.read"] })),
      http.get("/api/forms/folders", () => fail ? HttpResponse.json({ code: "Boom", detail: "No pudimos." }, { status: 500 }) : HttpResponse.json(tree(false))));
    const requests = catalogRequests([catalogRow]);
    await act(async () => { renderRouteWithProviders(`/catalogos?pageSize=20&carpeta=${north}`); });
    expect(await screen.findByRole("link", { name: "Artículos" })).toBeInTheDocument();
    // While the tree is read the address' folder counts; once it fails, the listing goes on with «Todas».
    await waitFor(() => expect(requests.at(-1)?.has("folderId")).toBe(false));
    const list = await openFolderFilter("Carpeta Todas las carpetas");
    expect(await screen.findByText("No se pudieron traer las opciones.")).toBeInTheDocument();
    expect(within(list).getAllByRole("option").map(item => item.textContent)).toEqual(["Todas las carpetas"]);
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    // The folder of the address is back once the tree is read, with the list still open.
    expect(await within(list).findByRole("option", { name: "Norte, en Repartos" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(requests.at(-1)?.get("folderId")).toBe(north));
  });

  it("puts «Carpetas…» in the row menu only for whoever manages catalogs, without «Nueva carpeta» unless they administer forms", async () => {
    asUser(["formcatalogs.read", "formcatalogs.manage"]);
    catalogRequests([catalogRow]);
    server.use(http.get(`/api/forms/catalogs/${catalogRow.id}/folders`, () => HttpResponse.json({ folderIds: [north] })));
    await act(async () => { renderRouteWithProviders("/catalogos?pageSize=20"); });
    await userEvent.click(await screen.findByRole("button", { name: "Carpetas de «Artículos»" }));
    const dialog = await screen.findByRole("dialog", { name: "Carpetas de «Artículos»" });
    expect(await within(dialog).findByRole("button", { name: "Carpetas Norte" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Nueva carpeta" })).not.toBeInTheDocument();
  });

  it("leaves «Carpetas…» out of the row for whoever only reads", async () => {
    asUser(["formcatalogs.read"]);
    catalogRequests([catalogRow]);
    await act(async () => { renderRouteWithProviders("/catalogos?pageSize=20"); });
    expect(await screen.findByRole("link", { name: "Artículos" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carpeta Todas las carpetas" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Carpetas de «Artículos»" })).not.toBeInTheDocument();
  });
});

describe("Diseñar formularios with the «Carpeta» filter", () => {
  it("lists and counts the forms of the chosen folder, and «Carpetas…» offers «Nueva carpeta» to whoever administers forms", async () => {
    asUser(["formtemplates.read", "formtemplates.manage"]);
    const lists: URLSearchParams[] = [];
    const facets: URLSearchParams[] = [];
    server.use(
      http.get("/api/forms/definitions/facets", ({ request }) => { facets.push(new URL(request.url).searchParams); return HttpResponse.json({ active: 1, published: 1, drafts: 0, deactivated: 0 }); }),
      http.get("/api/forms/definitions", ({ request }) => { lists.push(new URL(request.url).searchParams); return HttpResponse.json({ ...emptyPage, items: [formRow], totalCount: 1, totalPages: 1 }); }),
      http.get(`/api/forms/definitions/${formRow.id}/folders`, () => HttpResponse.json({ folderIds: [] })),
    );
    let router!: ReturnType<typeof renderRouteWithProviders>["router"];
    await act(async () => { router = renderRouteWithProviders("/formularios?page=2&pageSize=20&publicationFilter=Published").router; });
    expect(screen.queryByRole("region", { name: "Carpetas" })).not.toBeInTheDocument();
    const list = await openFolderFilter("Carpeta Todas las carpetas");
    await userEvent.click(await within(list).findByRole("option", { name: "Repartos" }));
    await waitFor(() => expect(search(router).get("carpeta")).toBe(delivery));
    expect(search(router).get("page")).toBeNull();
    expect(search(router).get("publicationFilter")).toBe("Published");
    await waitFor(() => expect(lists.at(-1)?.get("folderId")).toBe(delivery));
    await waitFor(() => expect(facets.at(-1)?.get("folderId")).toBe(delivery));
    await userEvent.click(await screen.findByRole("button", { name: "Carpetas de «Hoja de ruta»" }));
    const dialog = await screen.findByRole("dialog", { name: "Carpetas de «Hoja de ruta»" });
    expect(await within(dialog).findByRole("button", { name: /^Carpetas / })).not.toHaveAccessibleName(/Repartos/);
    expect(within(dialog).getByRole("button", { name: "Nueva carpeta" })).toBeInTheDocument();
  });

  it("says that a folder is empty with its name, and offers «Buscar en todas» with a search", async () => {
    asUser(["formtemplates.read"]);
    server.use(
      http.get("/api/forms/definitions/facets", () => HttpResponse.json({ active: 0, published: 0, drafts: 0, deactivated: 0 })),
      http.get("/api/forms/definitions", () => HttpResponse.json(emptyPage)),
    );
    let router!: ReturnType<typeof renderRouteWithProviders>["router"];
    await act(async () => { router = renderRouteWithProviders(`/formularios?pageSize=20&carpeta=${north}`).router; });
    expect(await screen.findByText("No hay formularios en «Norte»")).toBeInTheDocument();
    await act(async () => { await router.navigate(`/formularios?pageSize=20&search=ruta&carpeta=${north}`); });
    expect(await screen.findByText("No hay coincidencias en «Norte»")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Buscar en todas" }));
    await waitFor(() => expect(search(router).get("carpeta")).toBeNull());
    expect(search(router).get("search")).toBe("ruta");
  });
});

describe("Formularios without folders", () => {
  it("has neither the panel nor the filter, and ignores an old link with a folder", async () => {
    const trees = vi.fn();
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formrecords.create"] })),
      http.get("/api/forms/folders", () => { trees(); return HttpResponse.json(tree(false)); }));
    const requests: URLSearchParams[] = [];
    server.use(http.get("/api/forms/overview", ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json({ forms: { ...emptyPage }, filterCounts: { active: 0, deactivated: 0, deactivatedPending: null } });
    }));
    await act(async () => { renderRouteWithProviders(`/formularios?pageSize=20&carpeta=${north}`); });
    await waitFor(() => expect(requests).not.toHaveLength(0));
    expect(requests.every(request => !request.has("folderId") && !request.has("withoutFolder"))).toBe(true);
    expect(await screen.findByRole("searchbox")).toBeInTheDocument();
    expect(screen.queryByText(/«Norte»/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Carpeta / })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Carpetas" })).not.toBeInTheDocument();
    expect(trees).not.toHaveBeenCalled();
  });
});
