import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { cellUnder } from "@/test/utils/tableCells";
import { approvalTaskFixture } from "@/test/approvalFixtures";
import { responseDetailFixture, responseFormId, responseRecordId, responseSecondId, responseSheetFixture, responseWorkflowFixture } from "@/test/responseFixtures";
import type { ResponseSheet } from "../api/responses";
import type { ResponseWorkflow } from "../api/workflow";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
beforeEach(async () => { queryClient.clear(); await i18n.changeLanguage("es"); });
afterEach(async () => { await i18n.changeLanguage("es"); });

// F2 (option B of «Acciones por resolver»): the responses with an action that failed or is uncertain have their own tab, for whoever
// manages rules and sees every response, with the same sheet filtered; a «Reglas» column marks them.
const manager = ["formrecords.read", "formrules.manage"];
const empty = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false };
type Sheet = ResponseSheet & { unresolvedActionCount?: number };
function sheetWith(count: number | undefined, marked: readonly number[] = [0]): Sheet {
  const sheet = responseSheetFixture();
  return { ...sheet, ...count === undefined ? {} : { unresolvedActionCount: count },
    records: { ...sheet.records, items: sheet.records.items.map((row, index) => marked.includes(index) ? { ...row, hasUnresolvedActions: true as const } : row) } };
}
function setup({ permissions = manager, sheet = (_body: Record<string, unknown>): Sheet => sheetWith(1), approvals = empty }: {
  permissions?: readonly string[]; sheet?: (body: Record<string, unknown>) => Sheet; approvals?: typeof empty | { items: unknown[]; page: number; pageSize: number; totalCount: number; totalPages: number; hasPrevious: boolean; hasNext: boolean };
} = {}) {
  const searches: Record<string, unknown>[] = [];
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/forms/approvals", () => HttpResponse.json(approvals)),
    http.get("/api/forms/approvals/count", () => HttpResponse.json({ count: approvals.totalCount })),
    http.post("/api/forms/definitions/:id/records/search", async ({ request }) => {
      const body = await request.json() as Record<string, unknown>;
      searches.push(body);
      return HttpResponse.json(sheet(body));
    }),
    http.get("/api/forms/records/:id/workflow", ({ params }) => HttpResponse.json(responseWorkflowFixture(String(params.id)))),
    http.get("/api/forms/records/:id", ({ params }) => HttpResponse.json(responseDetailFixture(String(params.id)))));
  return { searches };
}
const tabNames = () => within(screen.getByRole("tablist")).getAllByRole("tab").map(tab => tab.textContent);

it.each([[undefined], [0]])("leaves the tab out when the count is %s", async count => {
  setup({ sheet: () => sheetWith(count, []) });
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas");
  // The first render pays the lazy page: with the machine loaded it takes more than a second.
  await screen.findByRole("tab", { name: "Respuestas (2)" }, { timeout: 10_000 });
  expect(tabNames()).toEqual(["Respuestas (2)", "Tablero"]);
  expect(screen.queryByRole("columnheader", { name: "Reglas" })).not.toBeInTheDocument();
}, 20_000);

it("shows «Por resolver (N)» after «Por aprobar», and the sheet still opens in «Por aprobar» when there is something to decide", async () => {
  const task = approvalTaskFixture();
  setup({ permissions: [...manager, "formapprovals.decide"], sheet: () => sheetWith(3),
    approvals: { items: [task], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false } });
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas");
  await screen.findByRole("tab", { name: "Por resolver (3)" }, { timeout: 10_000 });
  await waitFor(() => expect(screen.getByRole("tab", { name: "Por aprobar (1)" })).toHaveAttribute("aria-selected", "true"));
  expect(tabNames()).toEqual(["Por aprobar (1)", "Por resolver (3)", "Todas", "Tablero"]);
}, 20_000);

it("asks only for the responses to resolve from its tab, keeps the tab in the address and goes back to every response", async () => {
  const onlyFirst = (): Sheet => { const sheet = sheetWith(1, [0]); return { ...sheet, records: { ...sheet.records, items: sheet.records.items.slice(0, 1), totalCount: 1 } }; };
  const { searches } = setup({ sheet: body => body.unresolvedActions ? onlyFirst() : sheetWith(1, [0]) });
  const { router } = renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas?page=2");
  await userEvent.click(await screen.findByRole("tab", { name: "Por resolver (1)" }, { timeout: 10_000 }));
  await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("view")).toBe("unresolved"));
  // Its own list starts on its first page.
  expect(new URLSearchParams(router.state.location.search).get("page")).toBeNull();
  await waitFor(() => expect(searches.at(-1)).toMatchObject({ unresolvedActions: true, page: 1 }));
  expect(searches[0]).not.toHaveProperty("unresolvedActions");
  await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2));
  expect(screen.getByRole("tab", { name: "Por resolver (1)" })).toHaveAttribute("aria-selected", "true");
  // «Respuestas (N)» keeps counting every response, not the ones in sight.
  expect(screen.getByRole("tab", { name: "Respuestas (2)" })).toBeInTheDocument();
  // The same sheet: its bar and its columns.
  expect(screen.getByRole("button", { name: /^Filtros/ })).toBeInTheDocument();
  expect(await screen.findByRole("columnheader", { name: "Importe" })).toBeInTheDocument();

  await userEvent.click(screen.getByRole("tab", { name: "Respuestas (2)" }));
  await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("view")).toBeNull());
  await waitFor(() => expect(searches.at(-1)).not.toHaveProperty("unresolvedActions"));
}, 20_000);

it("marks the responses to resolve in «Reglas», after «Estado», with a dash in the others", async () => {
  setup({ sheet: () => ({ ...sheetWith(1, [0]), hasApproval: true }) });
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas");
  await screen.findByRole("columnheader", { name: "Reglas" }, { timeout: 10_000 });
  const table = screen.getByRole("table");
  const headers = within(table).getAllByRole("columnheader").map(header => header.textContent);
  expect(headers.indexOf("Reglas")).toBe(headers.indexOf("Estado") + 1);
  const [first, second] = within(table).getAllByRole("row").slice(1);
  const badge = within(cellUnder(table, first!, "Reglas")).getByText("Por resolver");
  expect(badge).toHaveAttribute("data-slot", "badge");
  expect(badge).toHaveAttribute("data-variant", "warning");
  expect(cellUnder(table, second!, "Reglas")).toHaveTextContent("—");
}, 20_000);

it("keeps its tab with the empty state of its own when nothing is left to resolve", async () => {
  setup({ permissions: [...manager, "formrecords.create"], sheet: () => ({ ...sheetWith(0, []), records: { ...sheetWith(0, []).records, items: [], totalCount: 0, totalPages: 0 } }) });
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas?view=unresolved");
  expect(await screen.findByRole("heading", { name: "Ninguna respuesta tiene acciones por resolver" }, { timeout: 10_000 })).toBeVisible();
  expect(screen.getByRole("tab", { name: "Por resolver (0)" })).toHaveAttribute("aria-selected", "true");
  // Adding a response does not resolve anything: the empty state offers only its title; the header keeps its button.
  expect(screen.getAllByRole("button", { name: "Agregar respuesta" })).toHaveLength(1);
}, 20_000);

it("reads the sheet and its count again after resolving an action from the response beside it", async () => {
  const runId = "0199a0c0-0000-7000-8000-000000000090";
  let state: "Failed" | "Completed" = "Failed";
  const workflow = (): ResponseWorkflow => ({ ...responseWorkflowFixture(), actions: [{ id: runId, ruleId: runId, kind: "NotifyAuthor", event: "Received", order: 0, revision: 0, state,
    reasonCode: state === "Completed" ? null : "Test.Delivery", reason: state === "Completed" ? null : "Revisá la entrega.", canConsult: false, canRetry: state === "Failed", recipients: [],
    createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:00Z", completedAtUtc: state === "Completed" ? "2026-10-16T12:01:00Z" : null }] });
  const { searches } = setup({ sheet: () => state === "Failed" ? sheetWith(1, [0]) : sheetWith(0, []) });
  server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(workflow())),
    http.post("/api/forms/records/:id/actions/:runId/retry", () => { state = "Completed"; return HttpResponse.json(workflow()); }));
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId + "?view=unresolved");
  const panel = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }, { timeout: 10_000 }));
  await userEvent.click(await panel.findByRole("tab", { name: "Actividad" }));
  const reads = searches.length;
  await userEvent.click(await panel.findByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(searches.length).toBeGreaterThan(reads));
  expect(searches.at(-1)).toMatchObject({ unresolvedActions: true });
  expect(await screen.findByRole("tab", { name: "Por resolver (0)" })).toBeInTheDocument();
}, 20_000);

it("reads the sheet again when a retried action stops waiting and fails again, so the tab gets its number back", async () => {
  const runId = "0199a0c0-0000-7000-8000-000000000091";
  let state: "Failed" | "Waiting" = "Failed";
  const workflow = (): ResponseWorkflow => ({ ...responseWorkflowFixture(), actions: [{ id: runId, ruleId: runId, kind: "NotifyAuthor", event: "Received", order: 0, revision: 0, state,
    reasonCode: state === "Failed" ? "Test.Delivery" : null, reason: state === "Failed" ? "Revisá la entrega." : null, canConsult: false, canRetry: state === "Failed", recipients: [],
    createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:00Z", completedAtUtc: null }] });
  // Waiting does not count: while the worker has it, the server leaves it out of «Por resolver».
  const { searches } = setup({ sheet: () => state === "Failed" ? sheetWith(1, [0]) : sheetWith(0, []) });
  server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(workflow())),
    http.post("/api/forms/records/:id/actions/:runId/retry", () => { state = "Waiting"; return HttpResponse.json(workflow()); }));
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId + "?view=unresolved");
  const panel = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }, { timeout: 10_000 }));
  await userEvent.click(await panel.findByRole("tab", { name: "Actividad" }));
  await userEvent.click(await panel.findByRole("button", { name: "Reintentar" }));
  expect(await screen.findByRole("tab", { name: "Por resolver (0)" })).toBeInTheDocument();
  // The worker fails again: the flow, read again while it waits, stops waiting, and the sheet beside it is read again too.
  const reads = searches.length;
  state = "Failed";
  expect(await screen.findByRole("tab", { name: "Por resolver (1)" }, { timeout: 6_000 })).toBeInTheDocument();
  expect(searches.length).toBeGreaterThan(reads);
  expect(searches.at(-1)).toMatchObject({ unresolvedActions: true });
}, 20_000);

it.each([["Siguiente", responseSecondId], ["Anterior", "0199a0c0-0000-7000-8000-0000000000a1"]])("moves with «%s» from the place of a response that left «Por resolver» when resolved", async (arrow, target) => {
  const firstId = "0199a0c0-0000-7000-8000-0000000000a1";
  const runId = "0199a0c0-0000-7000-8000-000000000092";
  let state: "Failed" | "Completed" = "Failed";
  const workflow = (): ResponseWorkflow => ({ ...responseWorkflowFixture(), actions: [{ id: runId, ruleId: runId, kind: "NotifyAuthor", event: "Received", order: 0, revision: 0, state,
    reasonCode: state === "Completed" ? null : "Test.Delivery", reason: state === "Completed" ? null : "Revisá la entrega.", canConsult: false, canRetry: state === "Failed", recipients: [],
    createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:00Z", completedAtUtc: state === "Completed" ? "2026-10-16T12:01:00Z" : null }] });
  // Three responses to resolve, the one in the middle open: resolving it takes it out of the list beside it.
  const sheet = (): Sheet => {
    const base = sheetWith(3, [0, 1]);
    const [open, second] = base.records.items;
    const items = [{ ...open!, id: firstId, number: "TEST-000003" }, ...state === "Failed" ? [open!] : [], second!];
    return { ...base, unresolvedActionCount: items.length, records: { ...base.records, items, totalCount: items.length } };
  };
  setup({ sheet });
  server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(workflow())),
    http.post("/api/forms/records/:id/actions/:runId/retry", () => { state = "Completed"; return HttpResponse.json(workflow()); }));
  const { router } = renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId + "?view=unresolved");
  const panel = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }, { timeout: 10_000 }));
  await userEvent.click(await panel.findByRole("tab", { name: "Actividad" }));
  await userEvent.click(await panel.findByRole("button", { name: "Reintentar" }));
  await screen.findByRole("tab", { name: "Por resolver (2)" });
  await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3));
  // ↓ goes to the one that now takes its place and ↑ to the one before it.
  await waitFor(() => expect(panel.getByRole("button", { name: arrow })).toBeEnabled());
  await userEvent.click(panel.getByRole("button", { name: arrow }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/" + responseFormId + "/respuestas/" + target));
  expect(new URLSearchParams(router.state.location.search).get("view")).toBe("unresolved");
}, 20_000);

it("shows «Reglas» on a marked row without the tab when the count does not come", async () => {
  setup({ sheet: () => sheetWith(undefined, [0]) });
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas");
  const table = await screen.findByRole("table", {}, { timeout: 10_000 });
  await within(table).findByRole("columnheader", { name: "Reglas" });
  const [first] = within(table).getAllByRole("row").slice(1);
  expect(cellUnder(table, first!, "Reglas")).toHaveTextContent("Por resolver");
  expect(tabNames()).toEqual(["Respuestas (2)", "Tablero"]);
}, 20_000);

it("shares the bar with «Todas», but a search typed in «Por resolver» goes back without asking only for those", async () => {
  const { searches } = setup();
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas?view=unresolved");
  await userEvent.type(await screen.findByRole("searchbox", { name: "Buscar en textos largos" }, { timeout: 10_000 }), "visita");
  await waitFor(() => expect(searches.at(-1)).toMatchObject({ search: "visita", unresolvedActions: true }));
  await userEvent.click(screen.getByRole("tab", { name: /^Respuestas/ }));
  await waitFor(() => expect(searches.at(-1)).toMatchObject({ search: "visita" }));
  expect(searches.at(-1)).not.toHaveProperty("unresolvedActions");
  expect(screen.getByRole("searchbox", { name: "Buscar en textos largos" })).toHaveValue("visita");
}, 20_000);

it("asks for the next page of ↓ with only the responses to resolve", async () => {
  const { searches } = setup({ sheet: body => { const sheet = sheetWith(1, [0, 1]); return { ...sheet, records: { ...sheet.records, page: Number(body.page), totalCount: 4, totalPages: 2, hasPrevious: body.page === 2, hasNext: body.page === 1 } }; } });
  const { router } = renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseSecondId + "?view=unresolved");
  const panel = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }, { timeout: 10_000 }));
  await waitFor(() => expect(panel.getByRole("button", { name: "Siguiente" })).toBeEnabled());
  await userEvent.click(panel.getByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(searches.some(body => body.page === 2)).toBe(true));
  expect(searches.find(body => body.page === 2)).toMatchObject({ unresolvedActions: true });
  await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/" + responseFormId + "/respuestas/" + responseRecordId));
}, 20_000);

it("anchors the full page in the responses to resolve when it opens from their tab, and goes back to it", async () => {
  setup();
  const anchors: Record<string, unknown>[] = [];
  server.use(http.post("/api/forms/definitions/:id/records/:recordId/navigation", async ({ params, request }) => {
    anchors.push(await request.json() as Record<string, unknown>);
    return HttpResponse.json({ recordId: params.recordId, previousId: null, nextId: responseSecondId, position: 1, totalCount: 2 });
  }));
  const { router } = renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas?view=unresolved");
  await userEvent.click(await screen.findByRole("link", { name: "TEST-000002" }, { timeout: 10_000 }));
  const quick = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await userEvent.click(await within(quick).findByRole("link", { name: "Abrir en pantalla completa" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/" + responseFormId + "/respuestas/" + responseRecordId + "/completa"));
  await waitFor(() => expect(anchors.length).toBeGreaterThan(0));
  expect(anchors.at(-1)).toMatchObject({ unresolvedActions: true });
  expect(new URLSearchParams(router.state.location.search).get("view")).toBe("unresolved");
  await userEvent.click(await screen.findByRole("link", { name: "Volver a las respuestas" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/" + responseFormId + "/respuestas"));
  expect(new URLSearchParams(router.state.location.search).get("view")).toBe("unresolved");
}, 20_000);

it("exports from its tab only the responses to resolve, and the dialog says so", async () => {
  setup({ permissions: [...manager, "formrecords.export"] });
  let sent: Record<string, unknown> | undefined;
  server.use(http.post("/api/forms/definitions/:id/records/export", async ({ request }) => {
    sent = await request.json() as Record<string, unknown>;
    return new HttpResponse(new Uint8Array([80, 75]), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=test.xlsx" } });
  }));
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas?view=unresolved");
  await screen.findByRole("tab", { name: "Por resolver (1)" }, { timeout: 10_000 });
  const open = screen.getByRole("button", { name: "Exportar a Excel" });
  await waitFor(() => expect(open).toBeEnabled());
  await userEvent.click(open);
  const dialog = within(await screen.findByRole("dialog", { name: "Exportar respuestas a Excel" }));
  expect(dialog.getByText("Por resolver")).toBeInTheDocument();
  expect(dialog.queryByRole("checkbox", { name: "Incluir las anuladas" })).not.toBeInTheDocument();
  await userEvent.click(dialog.getByRole("button", { name: "Exportar a Excel" }));
  await waitFor(() => expect(sent).toMatchObject({ filter: { unresolvedActions: true } }));
}, 20_000);

it("reads in English", async () => {
  setup({ sheet: () => sheetWith(2, [0]) });
  // The person's language wins over the menu's once the session is read.
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, culture: "en", permissions: manager })));
  await i18n.changeLanguage("en");
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas?view=unresolved");
  await screen.findByRole("tab", { name: "To resolve (2)" }, { timeout: 10_000 });
  const table = screen.getByRole("table");
  const [first] = within(table).getAllByRole("row").slice(1);
  expect(cellUnder(table, first!, "Rules")).toHaveTextContent("To resolve");
}, 20_000);
