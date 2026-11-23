import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "@/shared/i18n";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";
import { queryClient } from "@/shared/api/queryClient";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import type { FormOverview } from "../api/overview";
import { responseFormId, responseRecordId } from "@/test/responseFixtures";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

// Synthetic behavior DTO; producer qualification runs separately against the real export.
function overview(): FormOverview {
  return { forms: { items: [{ id: responseFormId, name: "Registrar visita", prefix: "VIS", deactivatedAtUtc: null,
    pendingApprovalCount: 2, responseCount: 24, lastResponse: { id: responseRecordId, number: "VIS-000024",
      submittedAtUtc: "2026-10-21T12:30:00Z", state: "PendingApproval" } }],
    page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false },
    filterCounts: { active: 4, deactivated: 3, deactivatedPending: 1 } };
}
function setup(permissions: string[], payload = overview()) {
  const requests: URL[] = [];
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/forms/overview", ({ request }) => { requests.push(new URL(request.url)); return HttpResponse.json(payload); }),
    http.get("/api/forms/approvals/count", () => HttpResponse.json({ count: 2 })));
  return { requests };
}
beforeEach(() => { queryClient.clear(); localStorage.clear(); });
// The state of the forms is the button of the bar of the only piece to choose (2026-11-22): its name says the chosen one, and its
// list has no counts. With the keyboard, for the known mismatch of userEvent with the `pointerdown` of Radix.
async function openStates(current: string) {
  const trigger = screen.getByRole("button", { name: "Estado de los formularios " + current });
  await act(async () => { trigger.focus(); });
  await userEvent.keyboard("{Enter}");
  return screen.findByRole("listbox", { name: "Estado de los formularios" });
}

const received = formatDateTimeInZone("2026-10-21T12:30:00Z", "es", currentUser.timeZoneId);

describe("MF1 form overview", () => {
  it("puts the last response in three columns: its number, when it arrived and its state (UD1)", async () => {
    setup(["formrecords.read", "formapprovals.decide"]);
    renderRouteWithProviders("/formularios");
    const table = await screen.findByRole("table");
    const row = (await within(table).findByRole("link", { name: "Registrar visita" })).closest("tr")!;
    const number = cellUnder(table, row, "Última respuesta");
    expect(within(number).getByRole("link", { name: "VIS-000024" })).toHaveAttribute("href", "/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    expect(number).toHaveTextContent(/^VIS-000024$/);
    expect(cellUnder(table, row, "Recibida")).toHaveTextContent(new RegExp("^" + received + "$"));
    expect(cellUnder(table, row, "Estado")).toHaveTextContent(/^Por aprobar$/);
    // A segment shows one state at a time: the name goes alone, without a column for the state of the form.
    expect(cellUnder(table, row, "Formulario")).toHaveTextContent(/^Registrar visita$/);
    expect(within(table).queryByRole("columnheader", { name: "Estado del formulario" })).not.toBeInTheDocument();
  });

  it("says a form without responses with a dash in each of the three columns, since its count already says 0", async () => {
    const payload = overview();
    payload.forms.items[0] = { ...payload.forms.items[0], pendingApprovalCount: 0, responseCount: 0, lastResponse: null };
    setup(["formrecords.read"], payload);
    renderRouteWithProviders("/formularios");
    const table = await screen.findByRole("table");
    const row = (await within(table).findByRole("link", { name: "Registrar visita" })).closest("tr")!;
    for (const header of ["Última respuesta", "Recibida", "Estado"]) expect(cellUnder(table, row, header)).toHaveTextContent(/^—$/);
    expect(screen.queryByText("Sin respuestas todavía")).not.toBeInTheDocument();
  });

  it("says the state in the bar's button and leaves «Con algo por aprobar» when opening inactive forms", async () => {
    const { requests } = setup(["formrecords.read", "formapprovals.decide"]);
    const { router } = renderRouteWithProviders("/formularios?publicationFilter=Pending&pageSize=20");
    await screen.findByRole("heading", { name: "Formularios", level: 1 });
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Por aprobar" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "Respuestas" })).toBeVisible();
    expect(within(table).getByRole("link", { name: "VIS-000024" })).toHaveAttribute("href", "/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    expect(screen.getByRole("button", { name: "Estado de los formularios Con algo por aprobar" })).toBeVisible();
    expect(requests.at(-1)?.searchParams.get("pendingOnly")).toBe("true");
    expect(screen.queryByRole("button", { name: "Ver dados de baja" })).not.toBeInTheDocument();
    await userEvent.click(within(await openStates("Con algo por aprobar")).getByRole("option", { name: "Activos" }));
    await waitFor(() => expect(requests.at(-1)?.searchParams.has("pendingOnly")).toBe(false));
    expect(screen.getByRole("button", { name: "Estado de los formularios Activos" })).toBeInTheDocument();
    const viewDeactivated = screen.getByRole("button", { name: "Ver dados de baja" });
    expect(viewDeactivated).toHaveTextContent(/^Ver$/);
    await userEvent.click(viewDeactivated);
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("state")).toBe("Deactivated"));
    expect(requests.at(-1)?.searchParams.has("pendingOnly")).toBe(false);
    expect(new URLSearchParams(router.state.location.search).get("publicationFilter")).toBe("Deactivated");
    // The segment and the columns already say what a deactivated form keeps: no banner explains it (2026-10-31).
    await waitFor(() => expect(screen.getByRole("button", { name: "Estado de los formularios Dados de baja" })).toBeInTheDocument());
    expect(screen.queryByText("Los formularios dados de baja conservan sus respuestas y lo que espera una decisión.")).not.toBeInTheDocument();
  });

  it("chooses the deactivated forms in the bar's button, back to page 1, and choosing the one it has changes nothing", async () => {
    const { requests } = setup(["formrecords.read", "formapprovals.decide"]);
    const { router } = renderRouteWithProviders("/formularios?publicationFilter=Deactivated&page=2&pageSize=20");
    await screen.findByRole("table");
    let states = await openStates("Dados de baja");
    expect(within(states).getByRole("option", { name: "Dados de baja" })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(within(states).getByRole("option", { name: "Dados de baja" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Estado de los formularios Dados de baja" })).toHaveFocus();
    expect(new URLSearchParams(router.state.location.search).get("page")).toBe("2");
    states = await openStates("Dados de baja");
    await userEvent.click(within(states).getByRole("option", { name: "Activos" }));
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("state")).toBe("Active"));
    expect(new URLSearchParams(router.state.location.search).has("page")).toBe(false);
    expect(new URLSearchParams(router.state.location.search).has("publicationFilter")).toBe(false);
  });

  it("aligns what waits for a decision and how many responses there are to the right, as every column of numbers", async () => {
    setup(["formrecords.read", "formapprovals.decide"]);
    renderRouteWithProviders("/formularios");
    const table = await screen.findByRole("table");
    for (const name of ["Por aprobar", "Respuestas"]) expect(within(table).getByRole("columnheader", { name })).toHaveClass("text-right");
    expect(within(table).getByRole("cell", { name: "24" })).toHaveClass("text-right");
    expect(within(table).getByRole("link", { name: "Revisar 2 respuestas de Registrar visita" }).closest("td")).toHaveClass("text-right");
    expect(within(table).getByRole("columnheader", { name: "Formulario" })).not.toHaveClass("text-right");
  });

  // While another filter reads, the previous rows stay dimmed and out of reach under a running line (board LC2-A).
  it("dims the previous rows while another filter reads", async () => {
    setup(["formrecords.read", "formapprovals.decide"]);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    server.use(http.get("/api/forms/overview", async ({ request }) => {
      if (new URL(request.url).searchParams.get("pendingOnly") === "true") await gate;
      return HttpResponse.json(overview());
    }));
    renderRouteWithProviders("/formularios");
    const name = await screen.findByRole("link", { name: "Registrar visita" });
    expect(name.closest("[inert]")).toBeNull();
    await userEvent.click(within(await openStates("Activos")).getByRole("option", { name: "Con algo por aprobar" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Registrar visita" }).closest("[inert]")).not.toBeNull());
    expect(screen.getByRole("table").closest("[aria-busy='true']")).not.toBeNull();
    await act(async () => release());
    await waitFor(() => expect(screen.getByRole("link", { name: "Registrar visita" }).closest("[inert]")).toBeNull());
  });

  it("marks inactive rows while «Con algo por aprobar» crosses both states", async () => {
    const payload = overview();
    payload.forms.items[0].deactivatedAtUtc = "2026-10-20T15:00:00Z";
    payload.forms.items.push({ ...payload.forms.items[0], id: "0199a0c0-0000-7000-8000-000000000227", name: "Control vigente", deactivatedAtUtc: null });
    setup(["formrecords.read", "formapprovals.decide"], payload);
    renderRouteWithProviders("/formularios?publicationFilter=Pending");
    const row = (await screen.findByRole("link", { name: "Registrar visita" })).closest("tr")!;
    expect(within(row).getByText("Dado de baja", { exact: true })).toBeVisible();
    // This view mixes active and deactivated forms: the state of each one goes in its own column, not next to its name (UD1).
    const table = screen.getByRole("table");
    expect(cellUnder(table, row, "Formulario")).toHaveTextContent(/^Registrar visita$/);
    expect(cellUnder(table, row, "Estado del formulario")).toHaveTextContent(/^Dado de baja$/);
    expect(cellUnder(table, screen.getByRole("link", { name: "Control vigente" }).closest("tr")!, "Estado del formulario")).toHaveTextContent(/^Activo$/);
    const states = await openStates("Con algo por aprobar");
    expect(within(states).getAllByRole("option").map(option => option.textContent)).toEqual(["Activos", "Con algo por aprobar", "Dados de baja"]);
    expect(within(states).getByRole("option", { name: "Con algo por aprobar" })).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Ver dados de baja" })).not.toBeInTheDocument();
    expect(screen.queryByText("Los formularios dados de baja conservan sus respuestas y lo que espera una decisión.")).not.toBeInTheDocument();
  });

  it.each([
    [["formrecords.read"], true, false],
    [["formapprovals.decide"], false, true],
  ] as const)("keeps the columns and filter within the permission scope %j", async (permissions, read, decide) => {
    const payload = overview();
    if (!read) { payload.forms.items[0].responseCount = null; payload.forms.items[0].lastResponse = null; }
    if (!decide) { payload.forms.items[0].pendingApprovalCount = null; payload.filterCounts.deactivatedPending = null; }
    const { requests } = setup([...permissions], payload);
    renderRouteWithProviders("/formularios?publicationFilter=Pending&pageSize=20");
    await screen.findByRole("heading", { name: "Formularios", level: 1 });
    const table = await screen.findByRole("table");
    expect(within(table).queryByRole("columnheader", { name: "Respuestas" }) !== null).toBe(read);
    expect(within(table).queryByRole("columnheader", { name: "Última respuesta" }) !== null).toBe(read);
    expect(within(table).queryByRole("columnheader", { name: "Por aprobar" }) !== null).toBe(decide);
    expect(screen.queryByRole("button", { name: /Con algo por aprobar/ })).not.toBeInTheDocument();
    expect(requests.at(-1)?.searchParams.has("pendingOnly")).toBe(false);
    expect(within(table).getByRole("link", { name: "Registrar visita" })).toHaveAttribute("href", "/formularios/" + responseFormId + "/respuestas");
  });

  it.each([
    { permissions: ["formapprovals.decide"], query: "", title: "No hay respuestas por aprobar.", hint: "Los formularios con respuestas que podés decidir van a aparecer acá." },
    { permissions: ["formapprovals.decide"], query: "publicationFilter=Deactivated", title: "No hay respuestas por aprobar.", hint: "Los formularios con respuestas que podés decidir van a aparecer acá." },
    { permissions: ["formrecords.read", "formapprovals.decide"], query: "publicationFilter=Pending", title: "No hay respuestas por aprobar.", hint: "Los formularios con respuestas que podés decidir van a aparecer acá." },
    { permissions: ["formrecords.read"], query: "publicationFilter=Deactivated", title: "No hay formularios dados de baja", hint: "Los formularios publicados que se den de baja van a aparecer acá." },
    { permissions: ["formrecords.read"], query: "search=visita", title: "Sin coincidencias", hint: "No encontramos formularios con estos filtros." },
    { permissions: ["formrecords.read"], query: "", title: "Todavía no hay formularios publicados", hint: "Los formularios publicados van a aparecer acá." },
  ])("names the empty overview with its title only for $query and $permissions", async ({ permissions, query, title, hint }) => {
    const payload = overview();
    payload.forms = { ...payload.forms, items: [], totalCount: 0, totalPages: 0 };
    payload.filterCounts = { active: 0, deactivated: 0, deactivatedPending: null };
    setup(permissions, payload);
    renderRouteWithProviders("/formularios?" + query);
    expect(await screen.findByRole("heading", { name: title })).toBeVisible();
    // An empty list does not explain how it works (decision of 2026-10-31): its title is enough.
    expect(screen.queryByText(hint, { exact: true })).not.toBeInTheDocument();
  });

  it("denies the overview without either permission and never reads its data", async () => {
    const { requests } = setup(["formcatalogs.read"]);
    renderRouteWithProviders("/formularios");
    await screen.findByRole("heading", { name: /no tenés permiso/i });
    expect(requests).toHaveLength(0);
  });

  it("purges observed private rows and counts immediately after a 403 without refetching", async () => {
    setup(["formrecords.read", "formapprovals.decide"]);
    renderRouteWithProviders("/formularios?pageSize=20");
    await screen.findByRole("link", { name: "Registrar visita" });
    let reads = 0;
    server.use(http.get("/api/forms/overview", () => { reads++; return HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 }); }));
    await act(async () => { await queryClient.invalidateQueries({ queryKey: ["form-overview"] }); });
    await screen.findByRole("heading", { name: "No tenés permiso" });
    await waitFor(() => expect(queryClient.getQueryCache().findAll({ queryKey: ["form-overview"] }).flatMap(query => query.state.data === undefined ? [] : [query.state.data])).toEqual([]));
    expect(screen.queryByRole("link", { name: "Registrar visita" })).not.toBeInTheDocument();
    expect(reads).toBe(1);
  });

  it("shows one static overview link with the global pending count without per-form links", async () => {
    setup(["formrecords.read", "formapprovals.decide"]);
    renderRouteWithProviders("/");
    await userEvent.click(await screen.findByRole("button", { name: /^gestión de formularios$/i }));
    expect(await screen.findByRole("link", { name: "Formularios (2)" })).toHaveAttribute("href", "/formularios");
    expect(screen.queryByRole("link", { name: /^por aprobar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^ver todos/i })).not.toBeInTheDocument();
  });
});

it("loads the global pending badge only after its menu opens on another screen", async () => {
  setup(["formapprovals.decide"]);
  let counts = 0;
  server.use(http.get("/api/forms/approvals/count", () => { counts++; return HttpResponse.json({ count: 3 }); }));
  renderRouteWithProviders("/perfil");
  await screen.findByRole("heading", { name: "Mi perfil" });
  expect(counts).toBe(0);
  await userEvent.click(await screen.findByRole("button", { name: "Gestión de formularios" }));
  expect(await screen.findByRole("link", { name: "Formularios (3)" })).toHaveAttribute("href", "/formularios");
  expect(counts).toBe(1);
});

// While the count loads, its loading mark takes the place of the number in the «Formularios» row: nothing is added
// under it to vanish when the count arrives and pull the rest of the panel up (2026-11-05).
it("keeps the loading mark of the pending badge inside its menu row", async () => {
  setup(["formrecords.read", "formapprovals.decide", "formtemplates.read"]);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.get("/api/forms/approvals/count", async () => { await gate; return HttpResponse.json({ count: 3 }); }));
  renderRouteWithProviders("/perfil");
  await userEvent.click(await screen.findByRole("button", { name: "Gestión de formularios" }));
  const panel = await screen.findByRole("navigation", { name: "Gestión de formularios" });
  const marks = () => [...panel.querySelectorAll<HTMLElement>('[data-slot="skeleton"]')];
  const overview = await within(panel).findByRole("link", { name: "Formularios" });
  await waitFor(() => expect(marks()).toHaveLength(1));
  expect(overview).toContainElement(marks()[0]);
  await act(async () => release());
  expect(await within(panel).findByRole("link", { name: "Formularios (3)" })).toHaveAttribute("href", "/formularios");
  expect(marks()).toHaveLength(0);
});

it("renders the inactive-form action with its visible English label", async () => {
  setup(["formrecords.read", "formapprovals.decide"]);
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, culture: "en", permissions: ["formrecords.read", "formapprovals.decide"] })));
  await i18n.changeLanguage("en");
  const { unmount } = renderRouteWithProviders("/formularios?pageSize=20");
  try {
    expect(await screen.findByRole("button", { name: "View deactivated forms" })).toHaveTextContent(/^View$/);
  } finally { unmount(); await i18n.changeLanguage("es"); }
});

it.each([
  { permissions: ["formapprovals.decide"], query: "", title: "No responses to approve.", hint: "Forms with responses you can decide on will appear here." },
  { permissions: ["formrecords.read"], query: "publicationFilter=Deactivated", title: "No deactivated forms", hint: "Published forms that are deactivated will appear here." },
])("keeps the empty overview title accurate in English for $query", async ({ permissions, query, title, hint }) => {
  const payload = overview();
  payload.forms = { ...payload.forms, items: [], totalCount: 0, totalPages: 0 };
  payload.filterCounts = { active: 0, deactivated: 0, deactivatedPending: null };
  setup(permissions, payload);
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, culture: "en", permissions })));
  await i18n.changeLanguage("en");
  const { unmount } = renderRouteWithProviders("/formularios?" + query);
  try {
    expect(await screen.findByRole("heading", { name: title })).toBeVisible();
    expect(screen.queryByText(hint, { exact: true })).not.toBeInTheDocument();
  } finally { unmount(); await i18n.changeLanguage("es"); }
});

it("shows whoever only completes forms their own entries, opens their sheet and loads from the row (CW6-C)", async () => {
  const payload = overview();
  payload.forms.items[0] = { ...payload.forms.items[0], pendingApprovalCount: null, responseCount: 12,
    lastResponse: { id: responseRecordId, number: "VIS-000024", submittedAtUtc: "2026-10-21T12:30:00Z", state: "Approved" } };
  payload.forms.items.push({ id: "0199a0c0-0000-7000-8000-000000000226", name: "Control anterior", prefix: "ANT", deactivatedAtUtc: "2026-10-20T15:00:00Z",
    pendingApprovalCount: null, responseCount: 0, lastResponse: null });
  payload.filterCounts.deactivatedPending = null;
  setup(["formrecords.create"], payload);
  const { router } = renderRouteWithProviders("/formularios");
  const table = await screen.findByRole("table");
  expect(await within(table).findByRole("link", { name: "Registrar visita" })).toHaveAttribute("href", "/formularios/" + responseFormId + "/respuestas");
  expect(within(table).getByRole("columnheader", { name: "Mis cargas" })).toBeVisible();
  expect(within(table).getByRole("columnheader", { name: "Mi última carga" })).toBeVisible();
  expect(within(table).queryByRole("columnheader", { name: "Respuestas" })).not.toBeInTheDocument();
  const own = within(table).getByRole("link", { name: "Registrar visita" }).closest("tr")!;
  expect(within(own).getByText("12", { exact: true })).toBeVisible();
  expect(within(own).getByRole("link", { name: "VIS-000024" })).toHaveAttribute("href", "/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
  // The last entry says its number and, in its own column, when; without its state (UD1).
  expect(within(own).queryByText("Aprobada", { exact: true })).not.toBeInTheDocument();
  expect(cellUnder(table, own, "Mi última carga")).toHaveTextContent(/^VIS-000024$/);
  expect(cellUnder(table, own, "Recibida")).toHaveTextContent(new RegExp("^" + received + "$"));
  const none = within(table).getByRole("link", { name: "Control anterior" }).closest("tr")!;
  for (const header of ["Mis cargas", "Mi última carga", "Recibida"]) expect(cellUnder(table, none, header)).toHaveTextContent(/^—$/);
  expect(screen.queryByText("Todavía no cargaste")).not.toBeInTheDocument();
  // Without the segment, active and deactivated forms go together: the state of each one goes in its own column.
  expect(cellUnder(table, none, "Formulario")).toHaveTextContent(/^Control anterior$/);
  expect(cellUnder(table, none, "Estado del formulario")).toHaveTextContent(/^Dado de baja$/);
  expect(cellUnder(table, own, "Estado del formulario")).toHaveTextContent(/^Activo$/);
  expect(screen.queryByRole("button", { name: /^Estado de los formularios/ })).not.toBeInTheDocument();
  expect(within(table).queryByRole("link", { name: "Cargar Control anterior" })).not.toBeInTheDocument();
  // A table row carries no text buttons: loading is an icon with its name in the tooltip, and a link, since it goes elsewhere.
  const load = within(table).getByRole("link", { name: "Cargar Registrar visita" });
  expect(load).toHaveTextContent(/^$/);
  expect(screen.getByRole("columnheader", { name: "Acciones" })).toBeInTheDocument();
  await userEvent.click(load);
  await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/" + responseFormId + "/cargar"));
});

// FU4: the old address of «Formularios» leads to the list with the same filter and search.
it.each([
  ["pendingOnly=true&search=visita", "publicationFilter=Pending&search=visita"],
  ["state=Deactivated", "publicationFilter=Deactivated"],
  ["", ""],
])("leads the old address ?%s to the list", async (old, next) => {
  setup(["formrecords.read", "formapprovals.decide"]);
  const { router } = renderRouteWithProviders("/formularios/respuestas" + (old ? "?" + old : ""));
  await screen.findByRole("heading", { name: "Formularios", level: 1 });
  expect(router.state.location.pathname).toBe("/formularios");
  const expected = new URLSearchParams(next);
  const reached = new URLSearchParams(router.state.location.search);
  for (const key of ["publicationFilter", "search", "state", "pendingOnly"]) expect(reached.get(key)).toBe(expected.get(key));
});
