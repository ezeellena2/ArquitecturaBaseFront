import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { queryClient } from "@/shared/api/queryClient";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import i18n from "@/shared/i18n";
// Explicit synthetic current DTO for route behavior. Producer bodies live in CatalogsPage.http.test.
const listRaw = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 0, manual: 0, filters: 0 } } };
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
function setup(permissions: string[]) { server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })), http.get("/api/forms/catalogs", () => HttpResponse.json(listRaw))); }
beforeEach(async () => { queryClient.clear(); await i18n.changeLanguage("es"); });
// The state is filtered with the button of the bar of the only piece to choose (DS1-A), named by «Estado» and what it says.
async function openStates(current: string) {
  const trigger = await screen.findByRole("button", { name: `Estado ${current}` });
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "Estado" });
}
async function chooseState(current: string, option: string) {
  await userEvent.click(within(await openStates(current)).getByRole("option", { name: option }));
}
// The origin too (2026-11-22): its button says «De dónde salen» and the chosen one, and its list has no counts (FO1-A).
async function openOrigins(current = "Todos") {
  const trigger = await screen.findByRole("button", { name: `De dónde salen ${current}` });
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "De dónde salen" });
}
async function chooseOrigin(option: string, current?: string) {
  await userEvent.click(within(await openOrigins(current)).getByRole("option", { name: option }));
}
describe("Catalog routes and navigation", () => {
  it("chooses Manual without a write and navigates to the protected editor", async () => {
    setup(["formcatalogs.read", "formcatalogs.manage"]); let writes = 0;
    server.use(http.post("/api/forms/catalogs", () => { writes++; return HttpResponse.json({}, { status: 500 }); }));
    let router!: ReturnType<typeof renderRouteWithProviders>["router"];
    await act(async () => { router = renderRouteWithProviders("/catalogos?pageSize=20").router; });
    const user = userEvent.setup(); await user.click(await screen.findByRole("button", { name: "Nuevo catálogo" }));
    // The origin is the shared piece to choose (2026-11-22): its list offers the two origins and no query.
    await user.click(screen.getByRole("button", { name: "¿De dónde salen las opciones? Escribirlas a mano" }));
    const origins = await screen.findByRole("listbox", { name: "¿De dónde salen las opciones?" });
    expect(within(origins).getByRole("option", { name: "Tomarlas de la base, con filtros" })).not.toHaveAttribute("aria-disabled");
    expect(within(origins).queryByRole("option", { name: "Escribir una consulta" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
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

it("asks the server for the chosen origin, without counts, and goes back to page 1", async () => {
  // Synthetic current DTO projection, deliberately one row but 100 matching catalogs.
  const page = { items: [{ valueType: "Text" as const, id: "01990000-0000-7000-8000-000000000030", name: "Supervisores", description: null, origin: "Filters", optionsCount: null, usageCount: null, state: "Unavailable", stateReason: "Forms.Catalog.ContentInvalid", canEdit: false }], page: 5, pageSize: 1, totalCount: 20, totalPages: 20, hasPrevious: true, hasNext: true, filterCounts: { byKind: { all: 100, manual: 80, filters: 20 } } };
  setup(["formcatalogs.read"]); const requests: URLSearchParams[] = [];
  server.use(http.get("/api/forms/catalogs", ({ request }) => { requests.push(new URL(request.url).searchParams); return HttpResponse.json(page); }));
  let router!: ReturnType<typeof renderRouteWithProviders>["router"];
  await act(async () => { router = renderRouteWithProviders("/catalogos?page=5&pageSize=1&sort=name").router; });
  const origins = await openOrigins();
  expect(within(origins).getAllByRole("option").map(option => option.textContent)).toEqual(["Todos", "Escritas a mano", "De la base"]);
  expect(within(origins).getByRole("option", { name: "Todos" }).nextElementSibling).toHaveAttribute("role", "presentation");
  await userEvent.click(within(origins).getByRole("option", { name: "De la base" }));
  await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("kind")).toBe("Filters"));
  expect(new URLSearchParams(router.state.location.search).get("page")).toBeNull(); expect(new URLSearchParams(router.state.location.search).get("sort")).toBe("name");
  expect(screen.getByRole("button", { name: "De dónde salen De la base" })).toHaveFocus();
  await waitFor(() => expect(requests.some(request => request.get("kind") === "Filters" && request.get("page") === "1")).toBe(true));
  expect(screen.queryByText("Forms.Catalog.ContentInvalid", { exact: true })).not.toBeInTheDocument(); expect(screen.getByText("El catálogo tiene una configuración no válida.")).toBeInTheDocument();
});

it("requests the Unavailable state from the server and preserves origin/search/sort", async () => {
  setup(["formcatalogs.read"]); const requests: URLSearchParams[] = [];
  server.use(http.get("/api/forms/catalogs", ({ request }) => { requests.push(new URL(request.url).searchParams); return HttpResponse.json({ items: [], page: 1, pageSize: 1, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 0, manual: 0, filters: 0 } } }); }));
  let router!: ReturnType<typeof renderRouteWithProviders>["router"];
  await act(async () => { router = renderRouteWithProviders("/catalogos?page=5&pageSize=1&kind=Filters&sort=-name&search=supervisores").router; });
  await chooseState("Todos los estados", "No se puede usar");
  await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("state")).toBe("Unavailable")); const params = new URLSearchParams(router.state.location.search);
  expect(params.get("kind")).toBe("Filters"); expect(params.get("search")).toBe("supervisores"); expect(params.get("sort")).toBe("-name"); expect(params.get("page")).toBeNull();
  await waitFor(() => expect(requests.some(request => request.get("state") === "Unavailable")).toBe(true)); expect(requests.at(-1)!.has("isActive")).toBe(false);
});

it("marks the chosen state in its list, with «Todos los estados» first and apart", async () => {
  // OE1-A (2026-11-03): el desplegable no decía cuál estaba elegido; ahora la elegida lleva su tilde.
  setup(["formcatalogs.read"]);
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json({ items: [], page: 1, pageSize: 1, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 0, manual: 0, filters: 0 } } })));
  await act(async () => { renderRouteWithProviders("/catalogos?state=Inactive"); });
  const list = await openStates("Dado de baja");
  const options = within(list).getAllByRole("option");
  expect(options.map(option => option.textContent)).toEqual(["Todos los estados", "Activo", "Dado de baja", "No se puede usar"]);
  expect(options[0]!.nextElementSibling).toHaveAttribute("role", "presentation");
  expect(within(list).getByRole("option", { name: "Dado de baja" })).toHaveAttribute("aria-selected", "true");
  expect(within(list).getByRole("option", { name: "Todos los estados" })).toHaveAttribute("aria-selected", "false");
});

it("takes the state filter out with «Todos los estados», and choosing the one it has changes nothing", async () => {
  setup(["formcatalogs.read"]);
  const row = { valueType: "Text", id: "01990000-0000-7000-8000-000000000030", name: "Clientes", description: null, origin: "Manual", optionsCount: 3, usageCount: null, state: "Active", stateReason: null, canEdit: true };
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json({ items: [row], page: 3, pageSize: 1, totalCount: 5, totalPages: 5, hasPrevious: true, hasNext: true, filterCounts: { byKind: { all: 5, manual: 5, filters: 0 } } })));
  let router!: ReturnType<typeof renderRouteWithProviders>["router"];
  await act(async () => { router = renderRouteWithProviders("/catalogos?page=3&pageSize=1&state=Active").router; });
  const search = () => new URLSearchParams(router.state.location.search);
  await chooseState("Activo", "Activo");
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  expect(search().get("page")).toBe("3");
  expect(search().get("state")).toBe("Active");
  await chooseState("Activo", "Todos los estados");
  await waitFor(() => expect(search().get("state")).toBeNull());
  expect(search().get("page")).toBeNull();
  expect(screen.getByRole("button", { name: "Estado Todos los estados" })).toBeInTheDocument();
});

it("keeps the page when choosing the origin it has, and takes the filter out with «Todos»", async () => {
  setup(["formcatalogs.read"]);
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json({ ...listRaw, page: 3, pageSize: 1, totalCount: 5, totalPages: 5, hasPrevious: true, hasNext: true })));
  let router!: ReturnType<typeof renderRouteWithProviders>["router"];
  await act(async () => { router = renderRouteWithProviders("/catalogos?page=3&pageSize=1&kind=Manual").router; });
  const search = () => new URLSearchParams(router.state.location.search);
  const origins = await openOrigins("Escritas a mano");
  expect(within(origins).getByRole("option", { name: "Escritas a mano" })).toHaveAttribute("aria-selected", "true");
  await userEvent.click(within(origins).getByRole("option", { name: "Escritas a mano" }));
  await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  expect(search().get("page")).toBe("3");
  await chooseOrigin("Todos", "Escritas a mano");
  await waitFor(() => expect(search().get("kind")).toBeNull());
  expect(search().get("page")).toBeNull();
});

// Searching, filtering, sorting or paging keeps the rows in sight, dimmed and out of reach, with the line under the header (LC2-A).
it("dims the listed catalogs while the next ones are read", async () => {
  const row = { valueType: "Text", id: "01990000-0000-7000-8000-000000000030", name: "Clientes", description: null, origin: "Manual", optionsCount: 3, usageCount: null, state: "Active", stateReason: null, canEdit: true };
  setup(["formcatalogs.read"]); let release: (() => void) | undefined;
  server.use(http.get("/api/forms/catalogs", async ({ request }) => {
    if (new URL(request.url).searchParams.get("kind") === "Filters") await new Promise<void>(resolve => { release = resolve; });
    return HttpResponse.json({ ...listRaw, items: [row], totalCount: 1, totalPages: 1, filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } } });
  }));
  await act(async () => { renderRouteWithProviders("/catalogos?pageSize=20"); });
  const table = () => screen.getByRole("table").closest('[data-slot="table-container"]');
  await screen.findByRole("link", { name: "Clientes" });
  expect(table()).not.toHaveAttribute("aria-busy");
  await chooseOrigin("De la base");
  await waitFor(() => expect(release).toBeDefined());
  expect(table()).toHaveAttribute("aria-busy", "true");
  await act(async () => { release!(); });
  await waitFor(() => expect(table()).not.toHaveAttribute("aria-busy"));
});

// Without legends (2026-10-31): the empty list has its title and its way out, without a description.
it("leaves the empty list with its title and «Nuevo catálogo», and no matches with its title and «Limpiar filtros»", async () => {
  setup(["formcatalogs.read", "formcatalogs.manage"]);
  let router!: ReturnType<typeof renderRouteWithProviders>["router"];
  await act(async () => { router = renderRouteWithProviders("/catalogos?pageSize=20").router; });
  expect(await screen.findByText("Todavía no hay catálogos.")).toBeInTheDocument();
  expect(screen.queryByText("Creá el primero para compartir sus opciones entre formularios.")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Nuevo catálogo" })).toHaveLength(2);
  await act(async () => { await router.navigate("/catalogos?pageSize=20&search=zzz"); });
  expect(await screen.findByText("No encontramos catálogos con estos filtros.")).toBeInTheDocument();
  expect(screen.queryByText("Limpiá los filtros para ver los demás catálogos.")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Limpiar filtros" })).toBeInTheDocument();
});

// CA1: the catalogs a module keeps are a choice of «De dónde salen» only when the server counts some (`byKind.external`).
it("offers the catalogs a module keeps only when the server counts some, and asks the server for them", async () => {
  const external = { valueType: "Integer" as const, id: "01990000-0000-7000-8000-000000000031", name: "Condición frente al IVA", description: null, origin: "External", optionsCount: 9, usageCount: null, state: "Active", stateReason: null, canEdit: true };
  setup(["formcatalogs.read"]); const requests: URLSearchParams[] = [];
  server.use(http.get("/api/forms/catalogs", ({ request }) => { requests.push(new URL(request.url).searchParams); return HttpResponse.json({ ...listRaw, items: [external], totalCount: 1, totalPages: 1, filterCounts: { byKind: { all: 6, manual: 1, filters: 0, external: 5 } } }); }));
  let router!: ReturnType<typeof renderRouteWithProviders>["router"];
  await act(async () => { router = renderRouteWithProviders("/catalogos?pageSize=20").router; });
  await chooseOrigin("De otro sistema");
  await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("kind")).toBe("External"));
  await waitFor(() => expect(requests.some(request => request.get("kind") === "External")).toBe(true));
  expect(screen.getByRole("cell", { name: "De otro sistema" })).toBeInTheDocument();
  server.use(http.get("/api/forms/catalogs", () => HttpResponse.json(listRaw)));
  await act(async () => { await router.navigate("/catalogos?pageSize=20&search=x"); });
  const origins = await openOrigins();
  expect(within(origins).queryByRole("option", { name: "De otro sistema" })).not.toBeInTheDocument();
});

// OT1-C (2026-11-22): every column with a datum orders in the server, by its header and by «Ordenar por», with the same `sort`.
describe("Catalog order", () => {
  const sortPage = { items: [{ valueType: "Text" as const, id: "01990000-0000-7000-8000-000000000031", name: "Clientes", description: null, origin: "Manual", optionsCount: 46, usageCount: 3, state: "Active", stateReason: null, canEdit: true }],
    page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false, filterCounts: { byKind: { all: 1, manual: 1, filters: 0 } } };
  function sortRequests() {
    setup(["formcatalogs.read", "formcatalogs.manage"]); const requests: URLSearchParams[] = [];
    server.use(http.get("/api/forms/catalogs", ({ request }) => { requests.push(new URL(request.url).searchParams); return HttpResponse.json(sortPage); }));
    return requests;
  }
  const header = (name: string) => within(screen.getByRole("table")).getByRole("columnheader", { name });

  it("orders by a header in its useful direction, back on the first page, keeping the search and the filters", async () => {
    const requests = sortRequests();
    const { router } = renderRouteWithProviders("/catalogos?page=3&pageSize=20&kind=Manual&search=cli");
    await screen.findByRole("table", {}, { timeout: 5000 });
    // Without an order chosen, the server's usual one is the name: its arrow shows, and the first touch inverts it.
    expect(requests.at(-1)?.has("sort")).toBe(false);
    expect(header("Catálogo")).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("button", { name: "Ordenar por: Catálogo, de la A a la Z" })).toBeVisible();

    // The origin is a type: it orders as the segment does (by hand, from the base, from another system).
    await userEvent.click(within(header("De dónde salen")).getByRole("button", { name: "De dónde salen" }));
    await waitFor(() => expect(requests.at(-1)?.get("sort")).toBe("kind"));
    const params = new URLSearchParams(router.state.location.search);
    expect(params.get("sort")).toBe("kind");
    expect(params.has("page")).toBe(false);
    expect(params.get("kind")).toBe("Manual");
    expect(params.get("search")).toBe("cli");
    expect(requests.at(-1)?.get("page")).toBe("1");
    expect(header("De dónde salen")).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getByRole("button", { name: "Ordenar por: De dónde salen, según el circuito" })).toBeVisible();

    await userEvent.click(within(header("Catálogo")).getByRole("button", { name: "Catálogo" }));
    await waitFor(() => expect(requests.at(-1)?.get("sort")).toBe("name"));
  });

  it.each([
    ["Catálogo", "-name"], ["De dónde salen", "kind"], ["Opciones", "-optionsCount"], ["Lo usan", "-usageCount"], ["Estado", "state"],
  ])("orders «%s» by the server field %s", async (name, sort) => {
    const requests = sortRequests();
    renderRouteWithProviders("/catalogos");
    await screen.findByRole("table", {}, { timeout: 5000 });
    await userEvent.click(within(header(name)).getByRole("button", { name }));
    await waitFor(() => expect(requests.at(-1)?.get("sort")).toBe(sort));
  });

  it("changes the order from «Ordenar por», last in the bar, and the actions do not order", async () => {
    const requests = sortRequests();
    const { router } = renderRouteWithProviders("/catalogos?sort=-usageCount&state=Active");
    await screen.findByRole("table", {}, { timeout: 5000 });
    expect(requests.at(-1)?.get("sort")).toBe("-usageCount");
    expect(within(header("Acciones")).queryByRole("button")).not.toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Ordenar por: Lo usan, de mayor a menor" });
    expect(screen.getByRole("button", { name: /^Estado / }).compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    act(() => trigger.focus());
    await userEvent.keyboard("{Enter}");
    await userEvent.click(within(await screen.findByRole("menu")).getByRole("menuitemradio", { name: "Estado" }));
    await waitFor(() => expect(requests.at(-1)?.get("sort")).toBe("state"));
    expect(new URLSearchParams(router.state.location.search).get("state")).toBe("Active");
    await userEvent.click(within(screen.getByRole("menu")).getByRole("menuitemradio", { name: "Al revés del circuito" }));
    await waitFor(() => expect(requests.at(-1)?.get("sort")).toBe("-state"));
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(header("Estado")).toHaveAttribute("aria-sort", "descending");
  });

  it("leaves out the old order by origin, which the server rejects", async () => {
    const requests = sortRequests();
    renderRouteWithProviders("/catalogos?sort=origin");
    await screen.findByRole("table", {}, { timeout: 5000 });
    expect(requests.at(-1)?.has("sort")).toBe(false);
    // The order shown is the usual one, by name: the first touch on «Catálogo» inverts it, as without an order chosen.
    expect(header("Catálogo")).toHaveAttribute("aria-sort", "ascending");
    await userEvent.click(within(header("Catálogo")).getByRole("button", { name: "Catálogo" }));
    await waitFor(() => expect(requests.at(-1)?.get("sort")).toBe("-name"));
  });
});
