import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { dashboardFixture, dashboardIds as ids } from "@/test/dashboardFixtures";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { responseFormId, responseSheetFixture } from "@/test/responseFixtures";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { FormDashboard } from "../../api/dashboard";
import { automaticDashboardCards, serializeDashboardCards, withoutDashboardCard } from "../../dashboard";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
// Each test reads the person, the sheet and the dashboard again: another test's session does not carry its permissions over.
beforeEach(() => { queryClient.clear(); });
// The phone of one test does not stay for the next one.
afterEach(() => { vi.restoreAllMocks(); });

const path = "/formularios/" + responseFormId + "/respuestas";
const noApprovals = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false };

type DashboardAnswer = FormDashboard | Response;
/** The sheet and the dashboard of the form for a person with these permissions; it keeps every dashboard body it was asked. */
function serve(permissions: string[], dashboard: (period: string, filter: Record<string, unknown>) => DashboardAnswer | Promise<DashboardAnswer> =
  period => ({ ...dashboardFixture(), period: period as FormDashboard["period"] })) {
  const asked: { filter: Record<string, unknown>; period: string }[] = [];
  const sheet = responseSheetFixture();
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/forms/approvals", () => HttpResponse.json(noApprovals)),
    http.get("/api/forms/approvals/count", () => HttpResponse.json({ count: 0 })),
    http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(sheet)),
    http.post("/api/forms/definitions/:id/dashboard/search", async ({ request }) => {
      const body = await request.json() as { filter: Record<string, unknown>; period: string };
      asked.push(body);
      const answer = await dashboard(body.period, body.filter);
      return answer instanceof Response ? answer : HttpResponse.json(answer);
    }),
  );
  return { asked, sheet };
}

const search = (router: ReturnType<typeof renderRouteWithProviders>["router"]) => new URLSearchParams(router.state.location.search);
/** A reply that waits until the test lets it go. */
function hold() {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  return { held, release };
}
/** Radix opens a menu from its button with the keyboard, as the other menu tests of the repository. */
async function openMenu(name: string | RegExp) {
  const trigger = screen.getByRole("button", { name });
  act(() => trigger.focus());
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("menu");
}
/** «Estado» of the bar is the only piece to choose with the button of the bar (DS1-A): its list opens with the keyboard, like the
 * other Radix lists, with «Todos los estados» first, and the state is chosen in it. */
async function chooseState(state: string) {
  const trigger = screen.getByRole("button", { name: "Estado Todos los estados" });
  act(() => trigger.focus());
  await userEvent.keyboard("{Enter}");
  const states = within(await screen.findByRole("listbox", { name: "Estado" }));
  expect(states.getAllByRole("option")[0]).toHaveAccessibleName("Todos los estados");
  await userEvent.click(states.getByRole("option", { name: state }));
}

describe("the tab «Tablero»", () => {
  it("goes next to «Respuestas (N)» for whoever reads responses and opens the numbers and the cards of the form", async () => {
    const { asked, sheet } = serve(["formrecords.read"]);
    const { router } = renderRouteWithProviders(path);

    const responses = await screen.findByRole("tab", { name: `Respuestas (${sheet.records.totalCount})` }, { timeout: 10_000 });
    expect(responses).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("tab", { name: "Tablero" }));

    // The first open pays for the dashboard's chunk.
    const numbers = await screen.findByRole("region", { name: "Números" }, { timeout: 10_000 });
    expect(search(router).get("view")).toBe("dashboard");
    expect(within(numbers).getByText("Respuestas").nextElementSibling).toHaveTextContent("6");
    expect(within(numbers).getByText("Total de Monto (Pesos)").nextElementSibling).toHaveTextContent("2.050");
    expect(within(numbers).getByText("Total de Monto (Dólares)").nextElementSibling).toHaveTextContent("500");
    // Amounts by currency never add up: there is no total of «Monto» across currencies.
    expect(within(numbers).queryByText("Total de Monto")).not.toBeInTheDocument();
    for (const title of ["Cuántas llegaron, por día", "Total de Monto (Pesos), por día", "Total de Monto (Dólares), por día", "Por Banco (catálogo Bancos y billeteras)",
      "Por Pagado", "Por día de Fecha de pago", "Quién cargó"])
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    // Without approval in the form there is no card of the states.
    expect(screen.queryByRole("heading", { name: "Por estado" })).not.toBeInTheDocument();
    expect(asked[0]).toEqual({ filter: { page: 1, pageSize: 20, sort: "-number", versionIds: [] }, period: "day" });
  }, 20_000);

  it("shows the tab to whoever only loads, without who loaded, and never to whoever only decides", async () => {
    serve(["formrecords.create"]);
    const own = renderRouteWithProviders(path + "?view=dashboard");
    expect(await screen.findByRole("heading", { name: "Cuántas llegaron, por día" }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Quién cargó" })).not.toBeInTheDocument();
    own.unmount();
    queryClient.clear();

    // Whoever only decides gets the page of what waits for a decision, without tabs: no dashboard is asked.
    const { asked } = serve(["formapprovals.decide"]);
    renderRouteWithProviders(path + "?view=dashboard");
    expect(await screen.findByText("No hay respuestas por aprobar.", undefined, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Tablero" })).not.toBeInTheDocument();
    expect(asked).toEqual([]);
  }, 20_000);

  it("goes after «Por aprobar (N)» and «Todas» for whoever also decides, with the states of a form with approval", async () => {
    const { sheet } = serve(["formrecords.read", "formapprovals.decide"]);
    sheet.hasApproval = true;
    renderRouteWithProviders(path + "?view=dashboard");

    expect(await screen.findByRole("heading", { name: "Por estado" }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Por aprobar (0)", "Todas", "Tablero"]);
    const states = screen.getByRole("list", { name: "Por estado" });
    expect(within(states).getAllByRole("listitem").map(item => item.firstChild?.textContent)).toEqual(["Recibida", "Por aprobar", "Aprobada"]);
  });
});

describe("the adjustments in the address", () => {
  it("groups every period card by the week chosen and asks the dashboard again", async () => {
    const { asked } = serve(["formrecords.read"]);
    const { router } = renderRouteWithProviders(path + "?view=dashboard");
    await screen.findByRole("heading", { name: "Cuántas llegaron, por día" }, { timeout: 10_000 });

    await userEvent.click(screen.getByRole("button", { name: "Semana" }));

    expect(await screen.findByRole("heading", { name: "Cuántas llegaron, por semana" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Por semana de Fecha de pago" })).toBeInTheDocument();
    expect(search(router).get("period")).toBe("week");
    expect(asked.at(-1)?.period).toBe("week");
  });

  it("names the period of the dashboard in sight while the next one arrives", async () => {
    const week = hold();
    serve(["formrecords.read"], async period => {
      if (period === "week") await week.held;
      return { ...dashboardFixture(), period: period as FormDashboard["period"] };
    });
    renderRouteWithProviders(path + "?view=dashboard");
    await screen.findByRole("heading", { name: "Cuántas llegaron, por día" }, { timeout: 10_000 });

    await userEvent.click(screen.getByRole("button", { name: "Semana" }));
    // The week is asked; the days in sight keep their own words, titles and buckets, until it arrives.
    await waitFor(() => expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true"));
    expect(screen.getByRole("heading", { name: "Cuántas llegaron, por día" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Por día de Fecha de pago" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Cuántas llegaron, por día" })).getAllByRole("listitem")[0]).toHaveTextContent("01/10/2026: 2");

    week.release();
    expect(await screen.findByRole("heading", { name: "Cuántas llegaron, por semana" })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Cuántas llegaron, por semana" })).getAllByRole("listitem")[0]).toHaveTextContent("01/10/2026 – 07/10/2026: 2");
  }, 20_000);

  it("counts the responses on a card whose currency the filters leave out, and adds it up again when they let it in", async () => {
    const euros = "0199a0c0-0000-7000-8000-000000000098";
    serve(["formrecords.read"], (period, filter) => {
      const dashboard = { ...dashboardFixture(), period: period as FormDashboard["period"] };
      if (filter.state === "Voided") dashboard.numbers = [...dashboard.numbers, { ...dashboard.numbers[1]!, currencyId: euros, currencyLabel: "Euros" }];
      return dashboard;
    });
    const token = `choice.${ids.bank}.total.${ids.amount}.${euros}`;
    const { router } = renderRouteWithProviders(path + "?view=dashboard&cards=" + encodeURIComponent(token));

    // No euros in these responses: the card stays, counting, and «Contar» says so.
    expect(await screen.findByRole("heading", { name: "Por Banco (catálogo Bancos y billeteras)" }, { timeout: 10_000 })).toBeInTheDocument();
    const menu = await openMenu("Acciones de «Por Banco (catálogo Bancos y billeteras)»");
    expect(within(menu).getByRole("menuitemradio", { name: "Cantidad" })).toHaveAttribute("aria-checked", "true");
    await userEvent.keyboard("{Escape}");
    expect(search(router).get("cards")).toBe(token);

    await chooseState("Anulada");
    expect(await screen.findByRole("heading", { name: "Total de Monto (Euros), por Banco (catálogo Bancos y billeteras)" })).toBeInTheDocument();
    expect(search(router).get("cards")).toBe(token);
  }, 20_000);

  it("counts a total of one currency, shows a card as a table and takes another away, each in the address", async () => {
    serve(["formrecords.read"]);
    const { router } = renderRouteWithProviders(path + "?view=dashboard");
    await screen.findByRole("heading", { name: "Por Banco (catálogo Bancos y billeteras)" }, { timeout: 10_000 });

    const menu = await openMenu("Acciones de «Por Banco (catálogo Bancos y billeteras)»");
    await userEvent.click(within(within(menu).getByRole("group", { name: "Contar" })).getByRole("menuitemradio", { name: "Total de Monto (Dólares)" }));
    const banks = await screen.findByRole("heading", { name: "Total de Monto (Dólares), por Banco (catálogo Bancos y billeteras)" });
    expect(search(router).get("cards")).toContain(`choice.${ids.bank}.total.${ids.amount}.${ids.dollars}`);
    // The share of the dollars is of the dollars only.
    expect(within(screen.getByRole("list", { name: banks.textContent! })).getAllByRole("listitem")[0]).toHaveTextContent(/^Banco Galicia500 · 100\s?%$/);

    await userEvent.click(within(await openMenu("Acciones de «Quién cargó»")).getByRole("menuitem", { name: "Ver como tabla" }));
    const people = await screen.findByRole("table");
    expect(within(people).getAllByRole("columnheader").map(header => header.textContent)).toEqual(["Persona", "Cantidad", "%"]);
    expect(search(router).get("cards")).toContain("actors.table");

    await userEvent.click(within(await openMenu("Acciones de «Por Pagado»")).getByRole("menuitem", { name: "Quitar del tablero" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Por Pagado" })).not.toBeInTheDocument());
    expect(search(router).get("cards")).not.toContain(ids.paid);
    // The focus goes to the card that took its place.
    await waitFor(() => expect(screen.getByRole("button", { name: "Acciones de «Por día de Fecha de pago»" })).toHaveFocus());
  }, 20_000);

  it("adds what has no card at the end and goes back to the automatic dashboard", async () => {
    serve(["formrecords.read"]);
    const automatic = automaticDashboardCards(dashboardFixture(), { actors: true, states: false });
    const cards = serializeDashboardCards(withoutDashboardCard(automatic, 3));
    const { router } = renderRouteWithProviders(path + "?view=dashboard&cards=" + encodeURIComponent(cards));
    await screen.findByRole("heading", { name: "Cuántas llegaron, por día" }, { timeout: 10_000 });
    expect(screen.queryByRole("heading", { name: "Por Banco (catálogo Bancos y billeteras)" })).not.toBeInTheDocument();

    const menu = await openMenu("Agregar gráfico");
    const questions = within(menu).getByRole("group", { name: "De una pregunta" });
    expect(within(questions).getByRole("menuitem", { name: /Banco \(catálogo Bancos y billeteras\)/ })).toHaveTextContent("Cantidad o total, por opción");
    await userEvent.click(within(questions).getByRole("menuitem", { name: /Banco/ }));

    const headings = await screen.findAllByRole("heading", { level: 2 });
    expect(headings.at(-1)).toHaveTextContent("Por Banco (catálogo Bancos y billeteras)");
    await waitFor(() => expect(screen.getByRole("button", { name: "Acciones de «Por Banco (catálogo Bancos y billeteras)»" })).toHaveFocus());

    await userEvent.click(within(await openMenu("Agregar gráfico")).getByRole("menuitem", { name: "Volver al automático" }));
    await waitFor(() => expect(search(router).has("cards")).toBe(false));
    // Everything is on the dashboard again: «Agregar gráfico» stays off, with its reason.
    const off = screen.getByRole("button", { name: "Agregar gráfico" });
    expect(off).toHaveAttribute("aria-disabled", "true");
    expect(off).toHaveAccessibleDescription("Todos los gráficos ya están en el tablero.");
    // The focus stays on «Agregar gráfico», now off.
    await waitFor(() => expect(off).toHaveFocus());
  }, 20_000);

  it("keeps the filters behind «Filtros» on the phone, the channel and the state included, shared with the sheet", async () => {
    vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null, addListener: vi.fn(),
      removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
    const { asked } = serve(["formrecords.read"]);
    const { router } = renderRouteWithProviders(path + "?view=dashboard");
    await screen.findByRole("heading", { name: "Cuántas llegaron, por día" }, { timeout: 10_000 });
    expect(screen.queryByRole("button", { name: /^Canal/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Estado/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    const filters = await screen.findByRole("dialog", { name: "Filtros" });
    await userEvent.click(within(filters).getByRole("button", { name: "Estado" }));
    // Inside «Filtros» it is the field of the only piece to choose (DS1-A), whose list takes the screen on the phone.
    await userEvent.click(within(filters).getByRole("button", { name: "Estado Todos los estados" }));
    const states = await screen.findByRole("dialog", { name: "Estado" });
    expect(within(states).getAllByRole("option")[0]).toHaveAccessibleName("Todos los estados");
    await userEvent.click(within(states).getByRole("option", { name: "Anulada" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Estado" })).not.toBeInTheDocument());
    expect(within(filters).getByRole("button", { name: "Estado Anulada" })).toBeInTheDocument();

    await waitFor(() => expect(asked.at(-1)?.filter).toMatchObject({ state: "Voided" }));
    await userEvent.click(within(filters).getByRole("button", { name: "Listo" }));
    expect(await screen.findByRole("button", { name: "Quitar filtro: Estado: Anulada" })).toBeInTheDocument();
    // The filters live in memory, shared with the sheet: never in the address.
    expect(search(router).has("state")).toBe(false);
    expect(router.state.location.search).not.toContain("Voided");
  }, 20_000);
});

describe("what the dashboard cannot show", () => {
  it("shows «—» with its reason when a total does not fit, and never breaks the card", async () => {
    serve(["formrecords.read"], period => {
      const dashboard = { ...dashboardFixture(), period: period as FormDashboard["period"] };
      dashboard.numbers[0] = { ...dashboard.numbers[0]!, total: null, average: null, overflow: true };
      dashboard.series.buckets[0]!.totals[0] = { fieldId: ids.amount, currencyId: ids.pesos, total: null, overflow: true };
      return dashboard;
    });
    renderRouteWithProviders(path + "?view=dashboard");

    const numbers = await screen.findByRole("region", { name: "Números" }, { timeout: 10_000 });
    const total = within(numbers).getByText("Total de Monto (Pesos)").parentElement!;
    expect(total).toHaveTextContent("—");
    expect(total).toHaveTextContent("Demasiado grande para calcularlo.");
    const pesos = screen.getByRole("list", { name: "Total de Monto (Pesos), por día" });
    expect(within(pesos).getAllByRole("listitem")[0]).toHaveTextContent("01/10/2026: —");
    expect(screen.getByText("Algunos totales son demasiado grandes para calcularlos y van con «—».")).toBeInTheDocument();
  });

  it("keeps «Agregar gráfico» off, without a reason, until there is something to chart", async () => {
    const first = hold();
    serve(["formrecords.read"], async period => {
      await first.held;
      return { ...dashboardFixture(), period: period as FormDashboard["period"], count: 0 };
    });
    renderRouteWithProviders(path + "?view=dashboard");

    const loading = await screen.findByRole("button", { name: "Agregar gráfico" }, { timeout: 10_000 });
    expect(loading).toBeDisabled();
    expect(loading).not.toHaveAccessibleDescription();
    first.release();
    expect(await screen.findByText("Todavía no hay respuestas")).toBeInTheDocument();
    const empty = screen.getByRole("button", { name: "Agregar gráfico" });
    expect(empty).toBeDisabled();
    expect(empty).not.toHaveAccessibleDescription();
  }, 20_000);

  it("tells a form without responses from a filter that matches none, and clears the filters", async () => {
    serve(["formrecords.read"], period => ({ ...dashboardFixture(), period: period as FormDashboard["period"], count: 0 }));
    renderRouteWithProviders(path + "?view=dashboard");
    expect(await screen.findByText("Todavía no hay respuestas", undefined, { timeout: 10_000 })).toBeInTheDocument();

    await chooseState("Anulada");
    expect(await screen.findByText("Ninguna respuesta coincide")).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Limpiar todo" }).at(-1)!);
    expect(await screen.findByText("Todavía no hay respuestas")).toBeInTheDocument();
  });

  it("says when it could not load, with «Reintentar», and reads again", async () => {
    let fail = true;
    const { asked } = serve(["formrecords.read"], period => fail
      ? HttpResponse.json({ status: 500, traceId: "dashboard-test" }, { status: 500 }) : { ...dashboardFixture(), period: period as FormDashboard["period"] });
    renderRouteWithProviders(path + "?view=dashboard");

    expect(await screen.findByText("No pudimos cargar el tablero.", undefined, { timeout: 10_000 })).toBeInTheDocument();
    const add = screen.getByRole("button", { name: "Agregar gráfico" });
    expect(add).toBeDisabled();
    expect(add).not.toHaveAccessibleDescription();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("region", { name: "Números" })).toBeInTheDocument();
    expect(asked.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps «Reintentar» off with the wait the server asked, as its reason", async () => {
    serve(["formrecords.read"], () => HttpResponse.json({ title: "Too many requests", status: 429, retryAfter: 30 }, { status: 429, headers: { "Retry-After": "30" } }));
    renderRouteWithProviders(path + "?view=dashboard");

    expect(await screen.findByText("No pudimos cargar el tablero.", undefined, { timeout: 10_000 })).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: "Reintentar" });
    expect(retry).toHaveAttribute("aria-disabled", "true");
    expect(retry).toHaveAccessibleDescription("Esperá 30 segundos para volver a intentar.");
  });

  it("takes the whole reading away when the dashboard answers that it is not allowed", async () => {
    serve(["formrecords.read"], () => HttpResponse.json({ code: "Forms.Record.Forbidden" }, { status: 403 }));
    renderRouteWithProviders(path + "?view=dashboard");

    expect(await screen.findByRole("heading", { name: /permiso/i }, { timeout: 10_000 })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Tablero" })).not.toBeInTheDocument();
    expect(screen.queryByText("No pudimos cargar el tablero.")).not.toBeInTheDocument();
  });
});
