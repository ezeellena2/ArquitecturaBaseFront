import realPublishedList from "@/test/fixtures/forms-http/published/list-es.json";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";
import { createFormFixtureStore } from "@/test/visual/formFixtures";

// FU2-A and FU4 (2026-11-23): «Formularios» is the list of the forms with «Cargar», «Por aprobar» and the number of responses that
// opens the sheet; «Con algo por aprobar» is one more state of its filter.
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

const visit = "0199a0c0-0000-7000-8000-0000000002a1";
const fuel = "0199a0c0-0000-7000-8000-0000000002a2";
const base = realPublishedList.items[0];
const published = { ...base, id: visit, name: { es: "Registrar visita", en: "Visit" }, lifecycle: { ...base.lifecycle, responseCount: 6 }, pendingDecisionCount: 2 };
const draft = { ...base, id: fuel, name: { es: "Carga de combustible", en: "Fuel" }, activeVersionNumber: null, displayState: "Draft",
  lifecycle: { ...base.lifecycle, responseCount: 0, canDeactivate: false } };

function setup(permissions: string[], items: unknown[] = [published, draft], deactivatedPending = 0) {
  const store = createFormFixtureStore("es", "");
  const lists: URL[] = [];
  // The specific handlers go in a later `use`: MSW tries the latest first.
  server.use(http.all("/api/forms/*", ({ request }) => store.handle(request)));
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/forms/definitions", ({ request }) => {
      lists.push(new URL(request.url));
      return HttpResponse.json({ ...realPublishedList, items, totalCount: items.length, totalPages: items.length ? 1 : 0 });
    }),
    http.get("/api/forms/approvals/count", () => HttpResponse.json({ count: 2 })),
    http.get("/api/forms/overview", () => HttpResponse.json({ forms: { items: [], page: 1, pageSize: 1, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false },
      filterCounts: { active: 0, deactivated: 0, deactivatedPending } })));
  return { lists };
}
beforeEach(() => { queryClient.clear(); });
async function openStates(current = "Activos") {
  const trigger = await screen.findByRole("button", { name: `Estado ${current}` });
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "Estado" });
}
const rowOf = async (name: string) => (await screen.findByRole("link", { name })).closest("tr")!;

it("puts «Cargar» first in a published row, not in a draft, and comes back to the list with its filter", async () => {
  setup(["formtemplates.read", "formtemplates.manage", "formrecords.create"]);
  const { router } = renderRouteWithProviders("/formularios?search=visita");
  const table = await screen.findByRole("table");
  const actions = cellUnder(table, await rowOf("Registrar visita"), "Acciones");
  const load = within(actions).getByRole("link", { name: "Cargar Registrar visita" });
  expect(load).toHaveAttribute("href", "/formularios/" + visit + "/cargar");
  expect(within(actions).getAllByRole("link").concat(within(actions).queryAllByRole("button"))[0]).toBe(load);
  expect(load).toHaveTextContent(/^$/);
  expect(within(cellUnder(table, await rowOf("Carga de combustible"), "Acciones")).queryByRole("link", { name: /^Cargar/ })).not.toBeInTheDocument();
  await userEvent.click(load);
  await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/" + visit + "/cargar"));
  expect((router.state.location.state as { list?: string }).list).toMatch(/^\/formularios\?.*search=visita/);
});

it("does not offer «Cargar» to whoever cannot load", async () => {
  setup(["formtemplates.read", "formtemplates.manage"]);
  renderRouteWithProviders("/formularios");
  await rowOf("Registrar visita");
  expect(screen.queryByRole("link", { name: "Cargar Registrar visita" })).not.toBeInTheDocument();
});

it("shows «Por aprobar» to whoever decides, and both numbers open the sheet of the form", async () => {
  setup(["formtemplates.read", "formapprovals.decide", "formrecords.read"]);
  renderRouteWithProviders("/formularios");
  const table = await screen.findByRole("table");
  const row = await rowOf("Registrar visita");
  const headers = within(table).getAllByRole("columnheader").map(header => header.textContent);
  expect(headers.indexOf("Por aprobar")).toBe(headers.indexOf("Versión activa") + 1);
  expect(headers.indexOf("Respuestas")).toBe(headers.indexOf("Por aprobar") + 1);
  expect(within(cellUnder(table, row, "Por aprobar")).getByRole("link", { name: "Revisar 2 respuestas de Registrar visita" })).toHaveAttribute("href", "/formularios/" + visit + "/respuestas");
  expect(within(cellUnder(table, row, "Respuestas")).getByRole("link", { name: "Ver las respuestas de Registrar visita" })).toHaveAttribute("href", "/formularios/" + visit + "/respuestas");
  const never = await rowOf("Carga de combustible");
  expect(cellUnder(table, never, "Por aprobar")).toHaveTextContent(/^—$/);
  expect(cellUnder(table, never, "Respuestas")).toHaveTextContent(/^0$/);
  expect(within(cellUnder(table, never, "Respuestas")).queryByRole("link")).not.toBeInTheDocument();
});

it("hides «Por aprobar» and its filter from whoever does not decide, even from the address", async () => {
  const { lists } = setup(["formtemplates.read"], [{ ...published, pendingDecisionCount: undefined }, draft]);
  renderRouteWithProviders("/formularios?publicationFilter=Pending");
  const table = await screen.findByRole("table");
  expect(within(table).queryByRole("columnheader", { name: "Por aprobar" })).not.toBeInTheDocument();
  expect(lists.at(-1)?.searchParams.get("publicationFilter")).toBe("Active");
  const states = await openStates();
  expect(within(states).getAllByRole("option").map(option => option.textContent)).toEqual(["Activos", "Publicados", "Borradores", "Dados de baja"]);
});

it("filters «Con algo por aprobar» on the server and says so when nothing waits", async () => {
  const { lists } = setup(["formtemplates.read", "formapprovals.decide"], []);
  const { router } = renderRouteWithProviders("/formularios");
  await screen.findByRole("heading", { name: "Todavía no hay formularios" });
  const states = await openStates();
  expect(within(states).getAllByRole("option").map(option => option.textContent)).toEqual(["Activos", "Publicados", "Borradores", "Con algo por aprobar", "Dados de baja"]);
  await userEvent.click(within(states).getByRole("option", { name: "Con algo por aprobar" }));
  await waitFor(() => expect(lists.at(-1)?.searchParams.get("publicationFilter")).toBe("Pending"));
  expect(new URLSearchParams(router.state.location.search).get("publicationFilter")).toBe("Pending");
  expect(await screen.findByRole("heading", { name: "No hay respuestas por aprobar." })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Limpiar filtros" })).not.toBeInTheDocument();
});

it("still warns whoever decides about deactivated forms with something to approve", async () => {
  setup(["formtemplates.read", "formapprovals.decide"], [published], 1);
  const { router } = renderRouteWithProviders("/formularios");
  expect(await screen.findByText("Hay 1 formulario dado de baja con algo por aprobar.")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Ver dados de baja" }));
  await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("publicationFilter")).toBe("Deactivated"));
  await waitFor(() => expect(screen.queryByText("Hay 1 formulario dado de baja con algo por aprobar.")).not.toBeInTheDocument());
});
