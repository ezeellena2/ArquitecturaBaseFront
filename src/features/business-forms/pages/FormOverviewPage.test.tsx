import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "@/shared/i18n";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { queryClient } from "@/shared/api/queryClient";
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

describe("MF1 form overview", () => {
  it("uses authoritative facets and clears pendingOnly when opening inactive forms", async () => {
    const { requests } = setup(["formrecords.read", "formapprovals.decide"]);
    const { router } = renderRouteWithProviders("/formularios/respuestas?pendingOnly=true&pageSize=20");
    await screen.findByRole("heading", { name: "Formularios", level: 1 });
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Por aprobar" })).toBeVisible();
    expect(within(table).getByRole("columnheader", { name: "Respuestas" })).toBeVisible();
    expect(within(table).getByRole("link", { name: "VIS-000024" })).toHaveAttribute("href", "/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    expect(screen.getByRole("button", { name: "Activos (4)" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Dados de baja (3)" })).toBeVisible();
    expect(requests.at(-1)?.searchParams.get("pendingOnly")).toBe("true");
    expect(screen.queryByRole("button", { name: "Ver dados de baja" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Con algo por aprobar" }));
    await waitFor(() => expect(requests.at(-1)?.searchParams.has("pendingOnly")).toBe(false));
    expect(screen.getByRole("button", { name: "Activos (4)" })).toHaveAttribute("aria-pressed", "true");
    const viewDeactivated = screen.getByRole("button", { name: "Ver dados de baja" });
    expect(viewDeactivated).toHaveTextContent(/^Ver$/);
    await userEvent.click(viewDeactivated);
    await waitFor(() => expect(requests.at(-1)?.searchParams.get("state")).toBe("Deactivated"));
    expect(requests.at(-1)?.searchParams.has("pendingOnly")).toBe(false);
    expect(router.state.location.search).not.toContain("pendingOnly");
    expect(screen.getByRole("checkbox", { name: "Con algo por aprobar" })).not.toBeChecked();
    expect(await screen.findByText("Los formularios dados de baja conservan sus respuestas y lo que espera una decisión.")).toBeVisible();
  });

  it.each(["Active", "Deactivated"])("marks inactive rows and leaves state segments unselected while pendingOnly crosses %s", async state => {
    const payload = overview();
    payload.forms.items[0].deactivatedAtUtc = "2026-10-20T15:00:00Z";
    setup(["formrecords.read", "formapprovals.decide"], payload);
    renderRouteWithProviders("/formularios/respuestas?pendingOnly=true&state=" + state);
    const row = (await screen.findByRole("link", { name: "Registrar visita" })).closest("tr")!;
    expect(within(row).getByText("Dado de baja", { exact: true })).toBeVisible();
    const segment = screen.getByRole("group", { name: "Estado de los formularios" });
    for (const option of within(segment).getAllByRole("button")) expect(option).toHaveAttribute("aria-pressed", "false");
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
    renderRouteWithProviders("/formularios/respuestas?pendingOnly=true&pageSize=20");
    await screen.findByRole("heading", { name: "Formularios", level: 1 });
    const table = await screen.findByRole("table");
    expect(within(table).queryByRole("columnheader", { name: "Respuestas" }) !== null).toBe(read);
    expect(within(table).queryByRole("columnheader", { name: "Última respuesta" }) !== null).toBe(read);
    expect(within(table).queryByRole("columnheader", { name: "Por aprobar" }) !== null).toBe(decide);
    expect(screen.queryByRole("checkbox", { name: "Con algo por aprobar" })).not.toBeInTheDocument();
    expect(requests.at(-1)?.searchParams.has("pendingOnly")).toBe(false);
    expect(within(table).getByRole("link", { name: "Registrar visita" })).toHaveAttribute("href", "/formularios/" + responseFormId + "/respuestas");
  });

  it.each([
    { permissions: ["formapprovals.decide"], query: "", title: "No hay respuestas por aprobar.", hint: "Los formularios con respuestas que podés decidir van a aparecer acá." },
    { permissions: ["formapprovals.decide"], query: "state=Deactivated", title: "No hay respuestas por aprobar.", hint: "Los formularios con respuestas que podés decidir van a aparecer acá." },
    { permissions: ["formrecords.read", "formapprovals.decide"], query: "pendingOnly=true", title: "No hay respuestas por aprobar.", hint: "Los formularios con respuestas que podés decidir van a aparecer acá." },
    { permissions: ["formrecords.read"], query: "state=Deactivated", title: "No hay formularios dados de baja", hint: "Los formularios publicados que se den de baja van a aparecer acá." },
    { permissions: ["formrecords.read"], query: "search=visita", title: "Sin coincidencias", hint: "No encontramos formularios con estos filtros." },
    { permissions: ["formrecords.read"], query: "", title: "Todavía no hay formularios publicados", hint: "Los formularios publicados van a aparecer acá." },
  ])("describes the empty overview accurately for $query and $permissions", async ({ permissions, query, title, hint }) => {
    const payload = overview();
    payload.forms = { ...payload.forms, items: [], totalCount: 0, totalPages: 0 };
    payload.filterCounts = { active: 0, deactivated: 0, deactivatedPending: null };
    setup(permissions, payload);
    renderRouteWithProviders("/formularios/respuestas?" + query);
    expect(await screen.findByRole("heading", { name: title })).toBeVisible();
    expect(screen.getByText(hint, { exact: true })).toBeVisible();
    if (query || !permissions.includes("formrecords.read")) expect(screen.queryByText("Los formularios publicados van a aparecer acá.")).not.toBeInTheDocument();
  });

  it("denies the overview without either permission and never reads its data", async () => {
    const { requests } = setup(["formtemplates.read"]);
    renderRouteWithProviders("/formularios/respuestas");
    await screen.findByRole("heading", { name: /no tenés permiso/i });
    expect(requests).toHaveLength(0);
  });

  it("purges observed private rows and counts immediately after a 403 without refetching", async () => {
    setup(["formrecords.read", "formapprovals.decide"]);
    renderRouteWithProviders("/formularios/respuestas?pageSize=20");
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
    expect(await screen.findByRole("link", { name: "Formularios (2)" })).toHaveAttribute("href", "/formularios/respuestas");
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
  expect(await screen.findByRole("link", { name: "Formularios (3)" })).toHaveAttribute("href", "/formularios/respuestas");
  expect(counts).toBe(1);
});

it("renders the inactive-form action with its visible English label", async () => {
  setup(["formrecords.read", "formapprovals.decide"]);
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, culture: "en", permissions: ["formrecords.read", "formapprovals.decide"] })));
  await i18n.changeLanguage("en");
  const { unmount } = renderRouteWithProviders("/formularios/respuestas?pageSize=20");
  try {
    expect(await screen.findByRole("button", { name: "View deactivated forms" })).toHaveTextContent(/^View$/);
  } finally { unmount(); await i18n.changeLanguage("es"); }
});

it.each([
  { permissions: ["formapprovals.decide"], query: "", title: "No responses to approve.", hint: "Forms with responses you can decide on will appear here." },
  { permissions: ["formrecords.read"], query: "state=Deactivated", title: "No deactivated forms", hint: "Published forms that are deactivated will appear here." },
])("keeps the empty overview context accurate in English for $query", async ({ permissions, query, title, hint }) => {
  const payload = overview();
  payload.forms = { ...payload.forms, items: [], totalCount: 0, totalPages: 0 };
  payload.filterCounts = { active: 0, deactivated: 0, deactivatedPending: null };
  setup(permissions, payload);
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, culture: "en", permissions })));
  await i18n.changeLanguage("en");
  const { unmount } = renderRouteWithProviders("/formularios/respuestas?" + query);
  try {
    expect(await screen.findByRole("heading", { name: title })).toBeVisible();
    expect(screen.getByText(hint, { exact: true })).toBeVisible();
  } finally { unmount(); await i18n.changeLanguage("es"); }
});
