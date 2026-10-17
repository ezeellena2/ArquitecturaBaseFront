import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { responseDetailFixture, responseSheetFixture, responseWorkflowFixture, responseFormId, responseRecordId, responseSecondId } from "@/test/responseFixtures";
import { approvalTaskFixture } from "@/test/approvalFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
beforeEach(() => { queryClient.clear(); vi.clearAllMocks(); });
function setup(permissions = ["formrecords.read", "formrules.manage"], approval = false, pdf = false) {
  const reads = { values: 0, workflow: 0, files: 0, decisions: 0, searches: [] as Record<string, unknown>[] };
  const tasks = [approvalTaskFixture(), { ...approvalTaskFixture(), id: "0199a0c0-0000-7000-8000-000000000071", recordId: responseSecondId, number: "TEST-000001" }];
  tasks[0].number = "TEST-000002";
  const sheet = responseSheetFixture(); sheet.hasApproval = approval;
  if (pdf) sheet.records.items[0].hasPdf = true;
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.get("/api/forms/navigation", () => HttpResponse.json({ items: [], page: 1, pageSize: 4, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })),
    http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { reads.searches.push(await request.json() as Record<string, unknown>); return HttpResponse.json(sheet); }),
    http.get("/api/forms/records/:id", ({ params }) => { reads.values++; return HttpResponse.json(responseDetailFixture(String(params.id))); }),
    http.get("/api/forms/records/:id/workflow", ({ params }) => {
      reads.workflow++;
      const task = approval ? tasks.find(task => task.recordId === params.id) : undefined;
      return HttpResponse.json({ ...responseWorkflowFixture(String(params.id)), recordState: task ? task.state === "Open" ? "PendingApproval" : task.state : "Received", task: task ? { id: task.id, roleId: task.role.id, roleName: task.role.name, requestedAtUtc: task.requestedAtUtc, revision: task.revision, state: task.state, decidedAtUtc: task.decidedAtUtc, decidedBy: task.decidedBy, reason: task.reason } : null,
        documents: pdf ? [{ id: "0199a0c0-0000-7000-8000-000000000080", culture: "es", name: "Visita.pdf", size: 4, createdAtUtc: "2026-10-17T12:00:00Z" }] : [] });
    }),
    http.get("/api/forms/approvals", () => HttpResponse.json({ items: tasks.filter(task => task.state === "Open"), page: 1, pageSize: 20, totalCount: tasks.filter(task => task.state === "Open").length, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.get("/api/forms/approvals/options", () => HttpResponse.json({ forms: [{ id: responseFormId, name: "Visita" }] })),
    http.get("/api/forms/approvals/count", () => HttpResponse.json({ count: tasks.filter(task => task.state === "Open").length })),
    http.get("/api/forms/approvals/:id", ({ params }) => HttpResponse.json(tasks.find(task => task.id === params.id))),
    http.post("/api/forms/approvals/:id/decisions", async ({ params, request }) => {
      const body = await request.json() as { decision: "Approved" | "Rejected"; reason?: string };
      const task = tasks.find(task => task.id === params.id)!; reads.decisions++;
      Object.assign(task, { state: body.decision, canDecide: false, cannotDecideReason: "AlreadyDecided", revision: 2, reason: body.reason ?? null, decidedAtUtc: "2026-10-17T13:00:00Z", decidedBy: { userId: currentUser.id, displayName: "Luz" } });
      return HttpResponse.json({ taskId: task.id, recordId: task.recordId, revision: task.revision, state: task.state, decidedAtUtc: task.decidedAtUtc, decidedBy: task.decidedBy, reason: task.reason });
    }),
    http.get("/api/forms/records/:id/documents/:documentId/content", () => { reads.files++; return new HttpResponse(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf", "content-language": "es" } }); }),
  );
  return { reads, tasks, sheet };
}
const path = `/formularios/${responseFormId}/respuestas`;
it("keeps the mounted sheet and private filter when a response opens and closes by URL", async () => {
  const { reads } = setup(); const { router } = renderRouteWithProviders(path);
  const table = await screen.findByRole("table");
  await userEvent.type(screen.getByRole("searchbox", { name: "Buscar en textos largos" }), "private visit");
  await waitFor(() => expect(reads.searches.at(-1)).toMatchObject({ search: "private visit" }));
  const row = screen.getByRole("link", { name: "TEST-000002" }); await userEvent.click(row);
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  expect(table).toBeInTheDocument();
  expect(within(panel).getByRole("tab", { name: "Respuesta" })).toHaveAttribute("aria-selected", "true");
  expect(within(panel).getByRole("tab", { name: /Fotos/ })).toBeInTheDocument();
  expect(within(panel).getByRole("tab", { name: "Actividad" })).toBeInTheDocument();
  expect(within(panel).queryByRole("tab", { name: "PDF" })).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe(path + "/" + responseRecordId);
  await userEvent.click(within(panel).getByRole("button", { name: "Cerrar" }));
  await waitFor(() => expect(router.state.location.pathname).toBe(path));
  expect(screen.getByRole("table")).toBe(table);
  expect(screen.getByRole("searchbox", { name: "Buscar en textos largos" })).toHaveValue("private visit");
  await waitFor(() => expect(row).toHaveFocus());
});
it("opens a directly linked panel and navigates by arrows without intercepting tab controls or composition", async () => {
  setup(); const { router } = renderRouteWithProviders(path + "/" + responseRecordId + "?columns=none&sort=actor&pageSize=20");
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  expect(await screen.findByRole("table")).toBeInTheDocument();
  const tab = within(panel).getByRole("tab", { name: "Respuesta" }); await act(async () => tab.focus());
  fireEvent.keyDown(tab, { key: "ArrowDown" });
  expect(router.state.location.pathname).toBe(path + "/" + responseRecordId);
  fireEvent.keyDown(panel, { key: "ArrowDown", isComposing: true });
  expect(router.state.location.pathname).toBe(path + "/" + responseRecordId);
  fireEvent.keyDown(panel, { key: "ArrowDown" });
  await screen.findByRole("heading", { name: "TEST-000001" });
  expect(router.state.location.pathname).toBe(path + "/" + responseSecondId);
  expect(router.state.location.search).toContain("columns=none");
  fireEvent.keyDown(screen.getByRole("region", { name: "Detalle de la respuesta" }), { key: "Escape" });
  await waitFor(() => expect(router.state.location.pathname).toBe(path));
  expect(router.state.location.search).toContain("sort=actor");
});
it("propagates the static state filter to the settled sheet and its count", async () => {
  const { reads } = setup(undefined, true);
  server.use(http.post("/api/forms/definitions/:id/records/filter-counts/search", () => HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })));
  renderRouteWithProviders(path); await screen.findByRole("table");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Estado" }), "Approved");
  await waitFor(() => expect(reads.searches.at(-1)).toMatchObject({ state: "Approved" }));
  await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
  await waitFor(() => expect(reads.searches.some(body => body.pageSize === 1 && body.state === "Approved")).toBe(true));
});
it("opens only a fixed PDF tab from the row marker and loads no bytes before explicit viewing", async () => {
  const { reads } = setup(undefined, true, true); renderRouteWithProviders(path);
  await screen.findByRole("table");
  await userEvent.click(screen.getByRole("button", { name: "Ver PDF de TEST-000002" }));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await waitFor(() => expect(within(panel).getByRole("tab", { name: "PDF" })).toHaveAttribute("aria-selected", "true"));
  expect(reads.files).toBe(0);
  expect(within(panel).getByText("Visita.pdf")).toBeInTheDocument();
});
it("keeps a metadata-only approval panel after deciding without reading values, workflow or PDF", async () => {
  const { reads } = setup(["formapprovals.decide"], true); const { router } = renderRouteWithProviders("/formularios/por-aprobar?view=all&pageSize=20");
  await userEvent.click(await screen.findByRole("link", { name: "TEST-000002" }));
  await waitFor(() => expect(router.state.location.pathname).toContain("/formularios/por-aprobar/"));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await userEvent.click(await within(panel).findByRole("button", { name: "Aprobar" }));
  await within(panel).findByText(/Luz/);
  expect(reads).toMatchObject({ values: 0, workflow: 0, files: 0, decisions: 1 });
  expect(within(panel).queryByRole("tab", { name: "PDF" })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("link", { name: "TEST-000002" })).not.toBeInTheDocument());
  await userEvent.click(within(panel).getByRole("button", { name: "Cerrar" }));
  await waitFor(() => expect(screen.getByRole("link", { name: "TEST-000001" })).toHaveFocus());
});
it("uses the inbox order for its panel instead of the response sheet order", async () => {
  const { tasks } = setup(["formapprovals.decide", "formrecords.read"], true);
  tasks.reverse(); const { router } = renderRouteWithProviders("/formularios/por-aprobar?view=all&pageSize=20");
  await userEvent.click(await screen.findByRole("link", { name: "TEST-000001" }));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await userEvent.click(within(panel).getByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/por-aprobar/" + tasks[1].id));
  await screen.findByRole("heading", { name: "TEST-000002" });
});
it("lets Escape dismiss a rejection before the panel and preserves the active response", async () => {
  setup(["formapprovals.decide", "formrecords.read"], true);
  const { router } = renderRouteWithProviders(path + "/" + responseRecordId);
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await userEvent.click(await within(panel).findByRole("button", { name: "Rechazar" }));
  const reject = await screen.findByRole("dialog", { name: "Rechazar TEST-000002" });
  const reason = within(reject).getByRole("textbox", { name: /Motivo/ });
  await userEvent.type(reason, "Keep this reason");
  fireEvent.keyDown(reason, { key: "ArrowDown" });
  expect(router.state.location.pathname).toBe(path + "/" + responseRecordId);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(panel).toBeInTheDocument();
  expect(router.state.location.pathname).toBe(path + "/" + responseRecordId);
});

it("closes the inbox panel before changing its list scope", async () => {
  setup(["formapprovals.decide", "formrecords.read"], true);
  const { router } = renderRouteWithProviders("/formularios/por-aprobar?view=all&pageSize=20");
  await userEvent.click(await screen.findByRole("link", { name: "TEST-000002" }));
  await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await userEvent.click(screen.getByRole("button", { name: /Para mí/ }));
  await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/por-aprobar"));
  expect(screen.queryByRole("region", { name: "Detalle de la respuesta" })).not.toBeInTheDocument();
});
it("retries the failed next-page navigation instead of reloading the current sheet", async () => {
  const { sheet } = setup();
  const first = { ...sheet, records: { ...sheet.records, items: [sheet.records.items[0]], hasNext: true, totalPages: 2, pageSize: 1 } };
  const second = { ...sheet, records: { ...sheet.records, items: [sheet.records.items[1]], page: 2, hasPrevious: true, hasNext: false, totalPages: 2, pageSize: 1 } };
  let nextCalls = 0;
  let releaseNext: (() => void) | undefined;
  const nextGate = new Promise<void>(resolve => { releaseNext = resolve; });
  server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => {
    const query = await request.json() as { page: number };
    if (query.page === 2) { nextCalls++; if (nextCalls === 1) return HttpResponse.json({ code: "Test.Page", traceId: "navigation-test" }, { status: 500 }); await nextGate; return HttpResponse.json(second); }
    return HttpResponse.json(first);
  }));
  const { router } = renderRouteWithProviders(path + "/" + responseRecordId);
  await screen.findByRole("heading", { name: "TEST-000002" });
  const nextButton = await screen.findByRole("button", { name: "Siguiente" });
  await waitFor(() => expect(nextButton).toBeEnabled());
  await userEvent.click(nextButton);
  await waitFor(() => expect(nextCalls).toBe(1));
  await userEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
  await waitFor(() => expect(nextCalls).toBe(2));
  await act(async () => releaseNext?.());
  await waitFor(() => expect(router.state.location.pathname).toBe(path + "/" + responseSecondId));
});

it("shows observed recipient failures in the summary even when the role run completed", async () => {
  setup();
  server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json({ ...responseWorkflowFixture(), actions: [{ id: "0199a0c0-0000-7000-8000-000000000090", ruleId: "0199a0c0-0000-7000-8000-000000000091", kind: "NotifyRole", event: "Received", order: 0, revision: 1, state: "Completed", reasonCode: null, reason: null, canConsult: false, canRetry: false, createdAtUtc: "2026-10-17T12:00:00Z", updatedAtUtc: "2026-10-17T12:01:00Z", completedAtUtc: "2026-10-17T12:01:00Z", recipients: [{ user: { userId: currentUser.id, displayName: "Ana" }, channelId: null, state: "Failed", reasonCode: "ChannelUnavailable", reason: "Sin canal", canReview: false, deliveredAtUtc: null, readAtUtc: null, review: null }] }] })));
  renderRouteWithProviders(path + "/" + responseRecordId);
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await within(panel).findByRole("button", { name: "1 de 1 hecha" });
  expect(within(panel).getByText("Hay fallas o envíos sin confirmar.")).toBeVisible();
  expect(within(panel).getByRole("tab", { name: "Respuesta" })).toHaveAttribute("aria-selected", "true");
});

it("retains the previous answer while disabling its decision during navigation to another record", async () => {
  const { reads } = setup(["formrecords.read", "formapprovals.decide"], true);
  let release: (() => void) | undefined;
  let requested = false;
  const gate = new Promise<void>(resolve => { release = resolve; });
  server.use(http.get("/api/forms/records/:id", async ({ params }) => {
    if (params.id === responseSecondId) { requested = true; await gate; }
    return HttpResponse.json(responseDetailFixture(String(params.id)));
  }), http.get("/api/forms/records/" + responseSecondId + "/workflow", async () => { await gate; return HttpResponse.json(responseWorkflowFixture(responseSecondId)); }));
  renderRouteWithProviders(path + "/" + responseRecordId);
  await screen.findByRole("button", { name: "Aprobar" });
  const next = screen.getByRole("button", { name: "Siguiente" });
  await userEvent.click(next);
  await waitFor(() => expect(requested).toBe(true));
  const panel = screen.getByRole("region", { name: "Detalle de la respuesta" });
  expect(within(panel).getByRole("heading", { name: "TEST-000002" })).toBeInTheDocument();
  expect(panel).toHaveAttribute("aria-busy", "true");
  expect(next).toHaveFocus();
  const approve = within(panel).getByRole("button", { name: "Aprobar" });
  expect(approve).toBeDisabled();
  fireEvent.click(approve);
  expect(reads.decisions).toBe(0);
  await act(async () => release?.());
  await screen.findByRole("heading", { name: "TEST-000001" });
  expect(screen.getByRole("region", { name: "Detalle de la respuesta" })).toHaveFocus();
});

it.each(["close", "filter"] as const)("does not apply a pending next page after a %s changes its selection context", async change => {
  const { sheet } = setup();
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  let changedFilter = false;
  const first = { ...sheet, records: { ...sheet.records, items: [sheet.records.items[0]], hasNext: true, totalPages: 2, pageSize: 1 } };
  const second = { ...sheet, records: { ...sheet.records, items: [sheet.records.items[1]], page: 2, hasPrevious: true, hasNext: false, totalPages: 2, pageSize: 1 } };
  server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => {
    const query = await request.json() as { page: number; search?: string };
    if (query.search === "new filter") changedFilter = true;
    if (query.page === 2) { requested = true; await gate; return HttpResponse.json(second); }
    return HttpResponse.json(first);
  }));
  const { router } = renderRouteWithProviders(path + "/" + responseRecordId);
  const next = await screen.findByRole("button", { name: "Siguiente" });
  await waitFor(() => expect(next).toBeEnabled());
  await userEvent.click(next);
  await waitFor(() => expect(requested).toBe(true));
  if (change === "close") await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
  else { await userEvent.type(screen.getByRole("searchbox", { name: "Buscar en textos largos" }), "new filter"); await waitFor(() => expect(changedFilter).toBe(true)); }
  await act(async () => release?.());
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(router.state.location.pathname).toBe(change === "close" ? path : path + "/" + responseRecordId);
  expect(router.state.location.search).not.toContain("new filter");
});

it("withdraws denied task metadata in the inbox while preserving independently readable response values", async () => {
  const { reads } = setup(["formrecords.read", "formapprovals.decide"], true);
  server.use(http.post("/api/forms/approvals/:id/decisions", () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 })));
  renderRouteWithProviders("/formularios/por-aprobar?view=all&pageSize=20");
  await userEvent.click(await screen.findByRole("link", { name: "TEST-000002" }));
  const panel = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
  await userEvent.click(await panel.findByRole("button", { name: "Aprobar" }));
  await panel.findByText("Ya no tenés permiso para decidir esta aprobación.");
  expect(panel.getByText("Texto completo para revisar")).toBeVisible();
  expect(panel.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
  expect(reads.values).toBeGreaterThan(0);
  await waitFor(() => expect(queryClient.getQueryCache().findAll({ predicate: query => query.queryKey[0] === "form-approvals" && query.queryKey[2] === "task" })).toHaveLength(0));
});
