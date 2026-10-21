import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { responseDetailFixture, responseSheetFixture, responseWorkflowFixture, responseFormId, responseRecordId, responseSecondId } from "@/test/responseFixtures";
import { approvalTaskFixture } from "@/test/approvalFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
beforeEach(() => { queryClient.clear(); vi.clearAllMocks(); });
afterEach(() => vi.restoreAllMocks());
function setup(permissions = ["formrecords.read", "formrules.manage"], approval = false, pdf = false) {
  const reads = { tasks: 0, values: 0, workflow: 0, files: 0, decisions: 0, searches: [] as Record<string, unknown>[] };
  const tasks = [approvalTaskFixture(), { ...approvalTaskFixture(), id: "0199a0c0-0000-7000-8000-000000000071", recordId: responseSecondId, number: "TEST-000001" }];
  tasks[0].number = "TEST-000002";
  const sheet = responseSheetFixture(); sheet.hasApproval = approval;
  if (pdf) sheet.records.items[0].hasPdf = true;
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { reads.searches.push(await request.json() as Record<string, unknown>); return HttpResponse.json(sheet); }),
    http.get("/api/forms/records/:id", ({ params }) => { reads.values++; return HttpResponse.json(responseDetailFixture(String(params.id))); }),
    http.get("/api/forms/records/:id/workflow", ({ params }) => {
      reads.workflow++;
      const task = approval ? tasks.find(task => task.recordId === params.id) : undefined;
      return HttpResponse.json({ ...responseWorkflowFixture(String(params.id)), recordState: task ? task.state === "Open" ? "PendingApproval" : task.state : "Received", task: task ? { id: task.id, roleId: task.role.id, roleName: task.role.name, requestedAtUtc: task.requestedAtUtc, revision: task.revision, state: task.state, decidedAtUtc: task.decidedAtUtc, decidedBy: task.decidedBy, reason: task.reason } : null,
        documents: pdf ? [{ id: "0199a0c0-0000-7000-8000-000000000080", runId: "0199a0c0-0000-7000-8000-000000000090", culture: "es", name: "Visita.pdf", size: 4, createdAtUtc: "2026-10-17T12:00:00Z" }] : [] });
    }),
    http.get("/api/forms/approvals", () => HttpResponse.json({ items: tasks.filter(task => task.state === "Open"), page: 1, pageSize: 20, totalCount: tasks.filter(task => task.state === "Open").length, totalPages: 1, hasPrevious: false, hasNext: false })),
    http.get("/api/forms/approvals/count", () => HttpResponse.json({ count: tasks.filter(task => task.state === "Open").length })),
    http.get("/api/forms/approvals/:id", ({ params }) => { reads.tasks++; return HttpResponse.json(tasks.find(task => task.id === params.id)); }),
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
const rowName = (source: string, number: string) => (source === "pending" ? "Revisar " : "") + number;
it("contains mobile focus and preserves navigation in the decision-only metadata panel", async () => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: (_type: string, listener: unknown) => { if (query === "(width < 640px)") listeners.add(listener as (event: MediaQueryListEvent) => void); }, removeEventListener: (_type: string, listener: unknown) => { listeners.delete(listener as (event: MediaQueryListEvent) => void); }, dispatchEvent: vi.fn() }));
  setup(["formapprovals.decide"], true);
  const origin = path;
  const { router } = renderRouteWithProviders(origin + "?approvalPageSize=20");
  const row = await screen.findByRole("link", { name: "Revisar TEST-000002" });
  const table = row.closest("table")!;
  await userEvent.click(row);
  const panel = await screen.findByRole("dialog", { name: "Detalle de la respuesta" });
  await within(panel).findByRole("heading", { name: "TEST-000002" });
  expect(panel).toHaveAttribute("aria-modal", "true");
  expect(table.closest('[aria-hidden="true"]')).not.toBeNull();
  expect(within(panel).getByText("1 de 2 por aprobar")).toBeInTheDocument();
  await act(async () => row.focus());
  await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
  for (let index = 0; index < 15; index++) { await userEvent.tab(); expect(panel.contains(document.activeElement)).toBe(true); }
  await userEvent.click(await within(panel).findByRole("button", { name: "Rechazar" }));
  await screen.findByRole("dialog", { name: "Rechazar TEST-000002" });
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Rechazar TEST-000002" })).not.toBeInTheDocument());
  expect(panel).toBeInTheDocument();
  await act(async () => panel.focus());
  await userEvent.keyboard("{ArrowDown}");
  await within(panel).findByRole("heading", { name: "TEST-000001" });
  expect(within(panel).getByText("2 de 2 por aprobar")).toBeInTheDocument();
  await act(async () => { for (const listener of listeners) listener({ matches: false } as MediaQueryListEvent); });
  const desktop = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  expect(desktop).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(router.state.location.pathname).toBe(origin));
  await waitFor(() => expect(table.closest('[aria-hidden="true"]')).toBeNull());
  await waitFor(() => expect(screen.getByRole("link", { name: "Revisar TEST-000001" })).toHaveFocus());
});
it("keeps the per-form pending total confirmed with the navigation context after a decision", async () => {
  const { tasks } = setup(["formapprovals.decide"], true);
  server.use(http.get("/api/forms/approvals", () => {
    const open = tasks.filter(task => task.state === "Open");
    return HttpResponse.json({ items: open.slice(0, 1), page: 1, pageSize: 1, totalCount: open.length, totalPages: open.length, hasPrevious: false, hasNext: open.length > 1 });
  }));
  renderRouteWithProviders(path + "?approvalPageSize=1");
  await userEvent.click(await screen.findByRole("link", { name: "Revisar TEST-000002" }));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  expect(within(panel).getByText("1 de 2 por aprobar")).toBeInTheDocument();
  await userEvent.click(await within(panel).findByRole("button", { name: "Aprobar" }));
  await within(panel).findByText(/Luz/);
  await waitFor(() => expect(screen.queryByRole("link", { name: "Revisar TEST-000002" })).not.toBeInTheDocument());
  expect(within(panel).getByText("1 de 2 por aprobar")).toBeInTheDocument();
});
it("keeps the mounted sheet and private filter when a response opens and closes by URL", async () => {
  const { reads } = setup(); const { router } = renderRouteWithProviders(path);
  const table = await screen.findByRole("table");
  await userEvent.type(screen.getByRole("searchbox", { name: "Buscar en textos largos" }), "private visit");
  await waitFor(() => expect(reads.searches.at(-1)).toMatchObject({ search: "private visit" }));
  const row = screen.getByRole("link", { name: "TEST-000002" }); await userEvent.click(row);
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  expect(table).toBeInTheDocument();
  expect(within(panel).getByRole("tab", { name: "Respuesta" })).toHaveAttribute("aria-selected", "true");
  expect(within(panel).queryByRole("tab", { name: /Fotos/ })).not.toBeInTheDocument();
  expect(within(panel).getByRole("tab", { name: "Actividad" })).toBeInTheDocument();
  expect(within(panel).queryByRole("tab", { name: "PDF" })).not.toBeInTheDocument();
  expect(router.state.location.pathname).toBe(path + "/" + responseRecordId);
  await userEvent.click(within(panel).getByRole("button", { name: "Cerrar" }));
  await waitFor(() => expect(router.state.location.pathname).toBe(path));
  expect(screen.getByRole("table")).toBe(table);
  expect(screen.getByRole("searchbox", { name: "Buscar en textos largos" })).toHaveValue("private visit");
  await waitFor(() => expect(row).toHaveFocus());
});
it("closes from the focused Activity tab on Escape and restores the same filtered row", async () => {
  const { reads } = setup(); const { router } = renderRouteWithProviders(path);
  await screen.findByRole("table");
  await userEvent.type(screen.getByRole("searchbox", { name: "Buscar en textos largos" }), "private tab visit");
  await waitFor(() => expect(reads.searches.at(-1)).toMatchObject({ search: "private tab visit" }));
  const row = screen.getByRole("link", { name: "TEST-000002" });
  await userEvent.click(row);
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  const activity = within(panel).getByRole("tab", { name: "Actividad" });
  await userEvent.click(activity);
  expect(activity).toHaveFocus();
  expect(activity).toHaveAttribute("aria-selected", "true");
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(router.state.location.pathname).toBe(path));
  expect(screen.queryByRole("region", { name: "Detalle de la respuesta" })).not.toBeInTheDocument();
  expect(screen.getByRole("searchbox", { name: "Buscar en textos largos" })).toHaveValue("private tab visit");
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
it("clears the PDF tab only after the next response is confirmed without a document", async () => {
  setup(undefined, true, true);
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  server.use(http.get("/api/forms/records/" + responseSecondId + "/workflow", async () => { requested = true; await gate; return HttpResponse.json(responseWorkflowFixture(responseSecondId)); }));
  const { router } = renderRouteWithProviders(path);
  await userEvent.click(await screen.findByRole("button", { name: "Ver PDF de TEST-000002" }));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await within(panel).findByText("Visita.pdf");
  await userEvent.click(within(panel).getByRole("button", { name: "Siguiente" }));
  await within(panel).findByRole("heading", { name: "TEST-000001" });
  await waitFor(() => expect(requested).toBe(true));
  expect(new URLSearchParams(router.state.location.search).get("tab")).toBe("pdf");
  await act(async () => release?.());
  await waitFor(() => expect(new URLSearchParams(router.state.location.search).has("tab")).toBe(false));
  expect(within(panel).queryByRole("tab", { name: "PDF" })).not.toBeInTheDocument();
  expect(within(panel).getByRole("tab", { name: "Respuesta" })).toHaveAttribute("aria-selected", "true");
});
it("keeps a valid PDF tab when the destination also has a PDF", async () => {
  setup(undefined, true, true);
  const { router } = renderRouteWithProviders(path + "/" + responseRecordId + "?tab=pdf");
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await within(panel).findByText("Visita.pdf");
  await userEvent.click(within(panel).getByRole("button", { name: "Siguiente" }));
  await within(panel).findByRole("heading", { name: "TEST-000001" });
  await within(panel).findByText("Visita.pdf");
  expect(new URLSearchParams(router.state.location.search).get("tab")).toBe("pdf");
  expect(within(panel).getByRole("tab", { name: "PDF" })).toHaveAttribute("aria-selected", "true");
});
it.each(["sheet", "pending"])("shows unavailable for a confirmed response belonging to another form in the %s", async source => {
  const { tasks } = setup(["formrecords.read", "formapprovals.decide"], true);
  server.use(http.get("/api/forms/records/:id", () => HttpResponse.json({ ...responseDetailFixture(), definitionId: "0199a0c0-0000-7000-8000-000000000098" })));
  renderRouteWithProviders(source === "sheet" ? path + "/" + responseRecordId : path + "?approval=" + tasks[0].id);
  await screen.findByText("No encontramos esa respuesta o no está disponible");
  const panel = screen.getByRole("region", { name: "Detalle de la respuesta" });
  expect(within(panel).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
});
it.each(["sheet", "pending"])("pushes opening %s and replaces arrow navigation in browser history", async source => {
  setup(["formrecords.read", "formapprovals.decide"], true);
  const origin = path;
  const { router } = renderRouteWithProviders(origin + (source === "pending" ? "?approvalPageSize=20&pageSize=20" : "?pageSize=20"));
  await userEvent.click(await screen.findByRole("link", { name: rowName(source, "TEST-000002") }));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  expect(router.state.historyAction).toBe("PUSH");
  await userEvent.click(within(panel).getByRole("button", { name: "Siguiente" }));
  await within(panel).findByRole("heading", { name: "TEST-000001" });
  expect(router.state.historyAction).toBe("REPLACE");
  await act(async () => { await router.navigate(-1); });
  expect(router.state.location.pathname).toBe(origin);
  expect(new URLSearchParams(router.state.location.search).has("approval")).toBe(false);
});
it.each(["sheet", "pending"])("returns keyboard focus to the %s panel after clicking another row", async source => {
  setup(["formrecords.read", "formapprovals.decide"], true);
  const origin = path;
  const { router } = renderRouteWithProviders(origin);
  await userEvent.click(await screen.findByRole("link", { name: rowName(source, "TEST-000002") }));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await within(panel).findByRole("heading", { name: "TEST-000002" });
  await userEvent.click(screen.getByRole("link", { name: rowName(source, "TEST-000001") }));
  await within(panel).findByRole("heading", { name: "TEST-000001" });
  expect(panel).toHaveFocus();
  await userEvent.keyboard("{ArrowUp}");
  await within(panel).findByRole("heading", { name: "TEST-000002" });
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(router.state.location.pathname).toBe(origin));
  expect(new URLSearchParams(router.state.location.search).has("approval")).toBe(false);
  await waitFor(() => expect(screen.getByRole("link", { name: rowName(source, "TEST-000002") })).toHaveFocus());
});
it.each([
  ["sheet", "link"], ["sheet", "cell"],
  ["pending", "link"], ["pending", "cell"],
] as const)("returns focus to the same %s panel after reselecting its %s", async (source, control) => {
  setup(["formrecords.read", "formapprovals.decide"], true);
  const origin = path;
  const { router } = renderRouteWithProviders(origin);
  const link = await screen.findByRole("link", { name: rowName(source, "TEST-000002") });
  await userEvent.click(link);
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await within(panel).findByRole("heading", { name: "TEST-000002" });
  if (control === "link") await userEvent.click(link);
  else {
    await act(async () => link.focus());
    await userEvent.click(within(link.closest("tr")!).getByText("Ana"));
  }
  expect(screen.getByRole("region", { name: "Detalle de la respuesta" })).toBe(panel);
  expect(panel).toHaveFocus();
  await userEvent.keyboard("{ArrowDown}");
  await within(panel).findByRole("heading", { name: "TEST-000001" });
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(router.state.location.pathname).toBe(origin));
  expect(new URLSearchParams(router.state.location.search).has("approval")).toBe(false);
  await waitFor(() => expect(screen.getByRole("link", { name: rowName(source, "TEST-000001") })).toHaveFocus());
});
it("keeps focus on an external sort control while the response panel remains open", async () => {
  setup();
  const { router } = renderRouteWithProviders(path);
  await userEvent.click(await screen.findByRole("link", { name: "TEST-000002" }));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await within(panel).findByRole("heading", { name: "TEST-000002" });
  const sort = within(screen.getByRole("table")).getByRole("button", { name: "Cargó" });
  await userEvent.click(sort);
  await waitFor(() => expect(router.state.location.search).toContain("sort=actor"));
  expect(router.state.location.pathname).toBe(path + "/" + responseRecordId);
  expect(screen.getByRole("region", { name: "Detalle de la respuesta" })).toBe(panel);
  expect(sort).toHaveFocus();
});
it.each(["sheet", "pending"])("lets Escape close the %s panel immediately after selecting a delayed response", async source => {
  setup(["formrecords.read", "formapprovals.decide"], true);
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  server.use(http.get("/api/forms/records/" + responseSecondId, async () => { requested = true; await gate; return HttpResponse.json(responseDetailFixture(responseSecondId)); }));
  const origin = path;
  const { router } = renderRouteWithProviders(origin);
  await userEvent.click(await screen.findByRole("link", { name: rowName(source, "TEST-000002") }));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await within(panel).findByRole("heading", { name: "TEST-000002" });
  await userEvent.click(screen.getByRole("link", { name: rowName(source, "TEST-000001") }));
  await waitFor(() => expect(requested).toBe(true));
  expect(panel).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  expect(router.state.location.pathname).toBe(origin);
  expect(new URLSearchParams(router.state.location.search).has("approval")).toBe(false);
  await waitFor(() => expect(screen.getByRole("link", { name: rowName(source, "TEST-000001") })).toHaveFocus());
  await act(async () => release?.());
  expect(screen.queryByRole("region", { name: "Detalle de la respuesta" })).not.toBeInTheDocument();
});
it("keeps a metadata-only approval panel after deciding without reading values, workflow or PDF", async () => {
  const { reads, tasks } = setup(["formapprovals.decide"], true); const { router } = renderRouteWithProviders(path + "?approvalPageSize=20");
  await userEvent.click(await screen.findByRole("link", { name: "Revisar TEST-000002" }));
  await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("approval")).toBe(tasks[0].id));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await userEvent.click(await within(panel).findByRole("button", { name: "Aprobar" }));
  await within(panel).findByText(/Luz/);
  expect(reads).toMatchObject({ values: 0, workflow: 0, files: 0, decisions: 1 });
  expect(within(panel).queryByRole("tab", { name: "PDF" })).not.toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("link", { name: "Revisar TEST-000002" })).not.toBeInTheDocument());
  await userEvent.click(within(panel).getByRole("button", { name: "Cerrar" }));
  await waitFor(() => expect(screen.getByRole("region", { name: "Por aprobar · 1" }).parentElement).toHaveFocus());
});
it("uses the per-form pending order for its panel instead of the response sheet order", async () => {
  const { tasks } = setup(["formapprovals.decide", "formrecords.read"], true);
  tasks.reverse(); const { router } = renderRouteWithProviders(path + "?approvalPageSize=20");
  await userEvent.click(await screen.findByRole("link", { name: "Revisar TEST-000001" }));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await userEvent.click(within(panel).getByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(new URLSearchParams(router.state.location.search).get("approval")).toBe(tasks[1].id));
  await screen.findByRole("heading", { name: "TEST-000002" });
});
it("retains the pending panel, focus and cached photos while the next task and response load in the same form", async () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:visit-photo");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const { tasks, reads } = setup(["formapprovals.decide", "formrecords.read"], true);
  let releaseTask: (() => void) | undefined;
  let releaseRecord: (() => void) | undefined;
  const taskGate = new Promise<void>(resolve => { releaseTask = resolve; });
  const recordGate = new Promise<void>(resolve => { releaseRecord = resolve; });
  let taskRequested = false;
  let recordRequested = false;
  const thumbnails: string[] = [];
  server.use(
    http.get("/api/forms/approvals/:id", async ({ params }) => {
      if (params.id === tasks[1].id) { taskRequested = true; await taskGate; }
      return HttpResponse.json(tasks.find(task => task.id === params.id));
    }),
    http.get("/api/forms/records/:id", async ({ params }) => {
      if (params.id === responseSecondId) { recordRequested = true; await recordGate; }
      const detail = responseDetailFixture(String(params.id));
      detail.values.push({ fieldId: "0199a0c0-0000-7000-8000-000000000099", key: "photo", type: "photo", label: "Foto de la visita", value: [{ fileId: String(params.id), name: "Visita.jpg", contentType: "image/jpeg", size: 4, hasThumbnail: true }] });
      return HttpResponse.json(detail);
    }),
    http.get("/api/forms/records/:recordId/files/:fileId/thumbnail", ({ params }) => { thumbnails.push(String(params.recordId)); return new HttpResponse(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/jpeg" } }); }),
  );
  renderRouteWithProviders(path + "?approvalPageSize=20");
  await userEvent.click(await screen.findByRole("link", { name: "Revisar TEST-000002" }));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  const approve = await within(panel).findByRole("button", { name: "Aprobar" });
  await waitFor(() => expect(thumbnails).toEqual([responseRecordId]));
  await userEvent.click(within(panel).getByRole("tab", { name: "Fotos (1)" }));
  await waitFor(() => expect(panel.querySelector("img")).not.toBeNull());
  const image = panel.querySelector("img")!;
  const next = within(panel).getByRole("button", { name: "Siguiente" });
  await userEvent.click(next);
  await waitFor(() => expect(taskRequested).toBe(true));
  expect(screen.getByRole("region", { name: "Detalle de la respuesta" })).toBe(panel);
  expect(panel).toHaveAttribute("aria-busy", "true");
  expect(next).toHaveFocus();
  expect(approve).toBeDisabled();
  expect(panel.querySelector("img")).toBe(image);
  expect(within(panel).getByRole("tab", { name: "Fotos (1)" })).toHaveAttribute("aria-selected", "true");
  fireEvent.click(approve); expect(reads.decisions).toBe(0);
  await act(async () => releaseTask?.());
  await waitFor(() => expect(recordRequested).toBe(true));
  expect(screen.getByRole("region", { name: "Detalle de la respuesta" })).toBe(panel);
  expect(panel.querySelector("img")).toBe(image);
  expect(panel).toHaveAttribute("aria-busy", "true");
  expect(within(panel).getByRole("button", { name: "Aprobar" })).toBeDisabled();
  expect(within(panel).getByRole("heading", { name: "TEST-000002" })).toBeInTheDocument();
  await act(async () => releaseRecord?.());
  await within(panel).findByRole("heading", { name: "TEST-000001" });
  expect(within(panel).getByRole("tab", { name: "Fotos (1)" })).toHaveAttribute("aria-selected", "true");
  expect(panel).toHaveFocus();
  await userEvent.click(within(panel).getByRole("button", { name: "Anterior" }));
  await within(panel).findByRole("heading", { name: "TEST-000002" });
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(thumbnails.filter(id => id === responseRecordId)).toHaveLength(1);
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
  const moment = within(panel).getByRole("button", { name: "1 de 1 hecha" }).closest("li")!;
  expect(moment).toHaveAttribute("data-moment-state", "failed");
  expect(moment.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
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

it("withdraws denied task metadata in the per-form pending while preserving independently readable response values", async () => {
  const { reads } = setup(["formrecords.read", "formapprovals.decide"], true);
  server.use(http.post("/api/forms/approvals/:id/decisions", () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 })));
  renderRouteWithProviders(path + "?approvalPageSize=20");
  await userEvent.click(await screen.findByRole("link", { name: "Revisar TEST-000002" }));
  let panel = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
  await userEvent.click(await panel.findByRole("button", { name: "Aprobar" }));
  await screen.findByText("Ya no tenés permiso para decidir esta aprobación.");
  panel = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
  expect(panel.getByText("Texto completo para revisar")).toBeVisible();
  expect(panel.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
  expect(panel.getByRole("heading", { name: "Por aprobar", level: 3 })).toBeInTheDocument();
  expect(reads.values).toBeGreaterThan(0);
  const readsAfterDenial = reads.tasks;
  await waitFor(() => {
    for (const query of queryClient.getQueryCache().findAll({ predicate: query => query.queryKey[0] === "form-approvals" && query.queryKey[2] === "task" })) expect(query.state.data).toBeUndefined();
  });
  await userEvent.click(panel.getByRole("tab", { name: "Actividad" }));
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(reads.tasks).toBe(readsAfterDenial);
});
