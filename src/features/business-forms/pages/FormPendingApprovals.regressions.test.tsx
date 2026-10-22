import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { approvalTaskFixture } from "@/test/approvalFixtures";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { responseDetailFixture, responseFormId, responseSecondId, responseSheetFixture, responseWorkflowFixture } from "@/test/responseFixtures";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import type { ApprovalTask } from "../api/approvals";
import * as workspaceHooks from "../hooks/useResponseWorkspace";
import type { ResponseNavigationContext } from "../hooks/useResponseWorkspace";
import type { ApprovalDecisionBody } from "../approvals";

vi.mock("react-oidc-context", async () => ({
  ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }),
}));
vi.mock("@/shared/ui/notifications", async () => ({
  ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"),
  notify: vi.fn(), dismissNotification: vi.fn(),
}));

const secondTaskId = "0199a0c0-0000-7000-8000-000000000071";
const path = "/formularios/" + responseFormId + "/respuestas";

function setup(read = false) {
  const tasks: ApprovalTask[] = [approvalTaskFixture(), {
    ...approvalTaskFixture(), id: secondTaskId, recordId: responseSecondId, number: "VIS-00002",
    requestedAtUtc: "2026-10-16T13:00:00Z",
  }];
  const decisions: ApprovalDecisionBody[] = [];
  const reads = { values: 0, workflow: 0, lists: [] as URL[] };
  const access = { denied: false };
  const denied = () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 });
  const sheet = responseSheetFixture();
  sheet.hasApproval = true;
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["formapprovals.decide", ...(read ? ["formrecords.read"] : [])] })),
    http.get("/api/forms/approvals/count", () => HttpResponse.json({ count: tasks.filter(task => task.state === "Open").length })),
    http.get("/api/forms/approvals", ({ request }) => {
      const url = new URL(request.url);
      reads.lists.push(url);
      if (access.denied) return denied();
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      const open = tasks.filter(task => task.state === "Open");
      const totalPages = Math.ceil(open.length / pageSize);
      return HttpResponse.json({ items: open.slice((page - 1) * pageSize, page * pageSize), page, pageSize,
        totalCount: open.length, totalPages, hasPrevious: page > 1, hasNext: page < totalPages });
    }),
    http.get("/api/forms/approvals/:id/continuation", ({ params, request }) => {
      if (access.denied) return denied();
      const url = new URL(request.url); const direction = url.searchParams.get("direction")!;
      const anchor = tasks.findIndex(task => task.id === params.id); const open = tasks.filter(task => task.state === "Open");
      const candidates = open.filter(task => direction === "Next" ? tasks.indexOf(task) > anchor : tasks.indexOf(task) < anchor);
      const size = Number(url.searchParams.get("pageSize"));
      const items = direction === "Next" ? candidates.slice(0, size) : candidates.slice(-size);
      return HttpResponse.json({ anchorTaskId: params.id, definitionId: responseFormId, direction,
        items: items.map(task => ({ task, position: open.indexOf(task) + 1 })), totalCount: open.length, hasMore: candidates.length > items.length });
    }),
    http.get("/api/forms/approvals/:id", ({ params }) => {
      if (access.denied) return denied();
      const task = tasks.find(item => item.id === params.id);
      return task ? HttpResponse.json(task) : HttpResponse.json({ code: "BusinessForms.Task.NotFound" }, { status: 404 });
    }),
    http.post("/api/forms/approvals/:id/decisions", async ({ params, request }) => {
      const body = await request.json() as ApprovalDecisionBody;
      decisions.push(body);
      const task = tasks.find(item => item.id === params.id)!;
      Object.assign(task, { state: body.decision, revision: 2, canDecide: false, cannotDecideReason: "AlreadyDecided",
        decidedAtUtc: "2026-10-16T14:00:00Z", decidedBy: { userId: currentUser.id, displayName: "Supervisora" }, reason: body.reason ?? null });
      return HttpResponse.json({ taskId: task.id, recordId: task.recordId, revision: task.revision, state: task.state,
        decidedAtUtc: task.decidedAtUtc, decidedBy: task.decidedBy, reason: task.reason });
    }),
    http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(sheet)),
    http.get("/api/forms/records/:id", ({ params }) => {
      reads.values++;
      return HttpResponse.json(responseDetailFixture(String(params.id)));
    }),
    http.get("/api/forms/records/:id/workflow", ({ params }) => {
      reads.workflow++;
      const task = tasks.find(item => item.recordId === params.id);
      return HttpResponse.json({ ...responseWorkflowFixture(String(params.id)),
        recordState: task?.state === "Open" ? "PendingApproval" : task?.state ?? "Received",
        task: task ? { id: task.id, roleId: task.role.id, roleName: task.role.name, requestedAtUtc: task.requestedAtUtc,
          revision: task.revision, state: task.state, decidedAtUtc: task.decidedAtUtc, decidedBy: task.decidedBy, reason: task.reason } : null });
    }),
  );
  return { tasks, decisions, reads, access };
}

async function openFirst() {
  const pending = await screen.findByRole("region", { name: "Por aprobar · 2" });
  await userEvent.click(within(pending).getByRole("link", { name: "Revisar VIS-00001" }));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await within(panel).findByRole("button", { name: "Aprobar" });
  return panel;
}

beforeEach(() => { queryClient.clear(); vi.clearAllMocks(); });

it("requires a nonblank rejection reason and sends its trimmed value once from the per-form queue", async () => {
  const fixture = setup();
  renderRouteWithProviders(path);
  const panel = await openFirst();
  await userEvent.click(within(panel).getByRole("button", { name: "Rechazar" }));
  const reject = within(screen.getByRole("dialog", { name: "Rechazar VIS-00001" }));
  const submit = reject.getByRole("button", { name: "Rechazar" });
  expect(submit).toBeDisabled();
  await userEvent.type(reject.getByRole("textbox", { name: /Motivo/ }), "   ");
  expect(submit).toBeDisabled();
  await userEvent.type(reject.getByRole("textbox", { name: /Motivo/ }), "Revisá la visita  ");
  await userEvent.click(submit);
  await waitFor(() => expect(fixture.decisions).toEqual([{ expectedRevision: 1, decision: "Rejected", reason: "Revisá la visita" }]));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Rechazar VIS-00001" })).not.toBeInTheDocument());
  expect(await within(panel).findByText("Revisá la visita")).toBeVisible();
  expect(fixture.reads.values).toBe(0);
  expect(fixture.reads.workflow).toBe(0);
});

it("keeps a failed rejection reason and announces the cause once without repeating it in either surface", async () => {
  setup();
  server.use(http.post("/api/forms/approvals/:id/decisions", () => HttpResponse.json({ code: "Test.Decision", detail: "No pudimos registrar este rechazo." }, { status: 400 })));
  const view = renderRouteWithProviders(path);
  const panel = await openFirst();
  await userEvent.click(within(panel).getByRole("button", { name: "Rechazar" }));
  const reject = within(screen.getByRole("dialog", { name: "Rechazar VIS-00001" }));
  await userEvent.type(reject.getByRole("textbox", { name: /Motivo/ }), "Conservar este motivo");
  await userEvent.click(reject.getByRole("button", { name: "Rechazar" }));
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  const notice = vi.mocked(notify).mock.calls[0][0];
  expect(notice).toMatchObject({ kind: "error", message: "No pudimos registrar este rechazo." });
  expect(screen.queryByText(notice.message)).not.toBeInTheDocument();
  expect(reject.getByRole("textbox", { name: /Motivo/ })).toHaveValue("Conservar este motivo");
  view.unmount();
  expect(dismissNotification).toHaveBeenCalledWith(notice.id);
});

it("keeps rejection field feedback beside the reason without a general notification", async () => {
  setup();
  server.use(http.post("/api/forms/approvals/:id/decisions", () => HttpResponse.json({ code: "Validation.Failed", errors: { reason: ["Revisá el motivo del rechazo."] } }, { status: 400 })));
  renderRouteWithProviders(path);
  const panel = await openFirst();
  await userEvent.click(within(panel).getByRole("button", { name: "Rechazar" }));
  const reject = within(screen.getByRole("dialog", { name: "Rechazar VIS-00001" }));
  await userEvent.type(reject.getByRole("textbox", { name: /Motivo/ }), "Motivo válido");
  await userEvent.click(reject.getByRole("button", { name: "Rechazar" }));
  expect(await reject.findByText("Revisá el motivo del rechazo.")).toBeVisible();
  expect(reject.getByRole("textbox", { name: /Motivo/ })).toHaveAttribute("aria-invalid", "true");
  expect(notify).not.toHaveBeenCalled();
});

it("observes a competing decision after 409 without submitting a second decision", async () => {
  const fixture = setup();
  let writes = 0;
  server.use(http.post("/api/forms/approvals/:id/decisions", () => {
    writes++;
    Object.assign(fixture.tasks[0], { state: "Approved", revision: 2, canDecide: false, cannotDecideReason: "AlreadyDecided",
      decidedAtUtc: "2026-10-16T14:00:00Z", decidedBy: { userId: secondTaskId, displayName: "Otra supervisora" } });
    return HttpResponse.json({ code: "BusinessForms.Task.RevisionConflict" }, { status: 409 });
  }));
  renderRouteWithProviders(path);
  const panel = await openFirst();
  await userEvent.click(within(panel).getByRole("button", { name: "Aprobar" }));
  expect(await within(panel).findByText(/Otra supervisora/)).toBeVisible();
  expect(writes).toBe(1);
  expect(within(panel).queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
  expect(within(panel).queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
});

it.each(["post", "get"] as const)("withdraws approval metadata after %s 403 while preserving legitimate record reads", async source => {
  const fixture = setup(true);
  if (source === "post") server.use(http.post("/api/forms/approvals/:id/decisions", () => {
    fixture.access.denied = true;
    return HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 });
  }));
  const { router } = renderRouteWithProviders(path);
  const panel = await openFirst();
  expect(await screen.findByRole("columnheader", { name: "Importe" })).toBeVisible();
  if (source === "post") await userEvent.click(within(panel).getByRole("button", { name: "Aprobar" }));
  else {
    fixture.access.denied = true;
    await act(async () => { await queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === "form-approvals" }); });
  }
  await screen.findByText("Ya no tenés permiso para decidir esta aprobación.");
  expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "Importe" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Revisar VIS-00001" })).not.toBeInTheDocument();
  await waitFor(() => {
    for (const query of queryClient.getQueryCache().findAll({ predicate: query => query.queryKey[0] === "form-approvals" && query.queryKey[2] === "task" }))
      expect(query.state.data).toBeUndefined();
  });
  expect(fixture.reads.values).toBeGreaterThan(0);
  await userEvent.click(within(screen.getByRole("region", { name: "Detalle de la respuesta" })).getByRole("button", { name: "Cerrar" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Detalle de la respuesta" })).not.toBeInTheDocument());
  expect(screen.getByRole("columnheader", { name: "Importe" })).toBeVisible();
  const valueReadsAfterClosing = fixture.reads.values;
  await act(async () => { await router.navigate(path + "?approval=" + fixture.tasks[0].id); });
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  expect(screen.queryByRole("region", { name: "Detalle de la respuesta" })).not.toBeInTheDocument();
  expect(screen.getByRole("columnheader", { name: "Importe" })).toBeVisible();
  expect(fixture.reads.values).toBe(valueReadsAfterClosing);
});

it("retains the confirmed queue after a decision and visits the next pending item when the open list compacts", async () => {
  const fixture = setup();
  const { router } = renderRouteWithProviders(path + "?approvalPageSize=1");
  const panel = await openFirst();
  expect(within(panel).getByText("1 de 2 por aprobar")).toBeVisible();
  await userEvent.click(within(panel).getByRole("button", { name: "Aprobar" }));
  await within(panel).findByText(/Supervisora/);
  await waitFor(() => expect(screen.queryByRole("link", { name: "Revisar VIS-00001" })).not.toBeInTheDocument());
  expect(within(panel).getByText("1 de 2 por aprobar")).toBeVisible();
  await userEvent.click(within(panel).getByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(router.state.location.search).toContain("approval=" + secondTaskId));
  expect(await within(panel).findByRole("heading", { name: "VIS-00002" })).toBeVisible();
  expect(fixture.decisions).toHaveLength(1);
});

it("crosses pending pages by arrows and returns focus to the selected review link on Escape", async () => {
  const fixture = setup();
  const { router } = renderRouteWithProviders(path + "?approvalPageSize=1");
  let panel = await openFirst();
  await act(async () => panel.focus());
  await userEvent.keyboard("{ArrowDown}");
  await waitFor(() => expect(router.state.location.search).toContain("approval=" + secondTaskId));
  await waitFor(() => expect(router.state.location.search).toContain("approvalPage=2"));
  panel = screen.getByRole("region", { name: "Detalle de la respuesta" });
  expect(await within(panel).findByRole("heading", { name: "VIS-00002" })).toBeVisible();
  expect(within(panel).getByText("2 de 2 por aprobar")).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("region", { name: "Detalle de la respuesta" })).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole("link", { name: "Revisar VIS-00002" })).toHaveFocus());
  expect(router.state.location.search).toContain("approvalPage=2");
  expect(fixture.reads.lists.some(url => url.searchParams.get("page") === "2")).toBe(true);
  expect(fixture.reads.values).toBe(0);
});

it("returns focus to the existing decision panel when its selected pending row is activated again", async () => {
  setup();
  renderRouteWithProviders(path);
  const panel = await openFirst();
  await userEvent.click(screen.getByRole("link", { name: "Revisar VIS-00001" }));
  expect(screen.getByRole("region", { name: "Detalle de la respuesta" })).toBe(panel);
  await waitFor(() => expect(panel).toHaveFocus());
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.getByRole("link", { name: "Revisar VIS-00001" })).toHaveFocus());
});

it("withdraws pending metadata when loading the next page is forbidden while retaining the readable sheet", async () => {
  setup(true);
  renderRouteWithProviders(path + "?approvalPageSize=1");
  const panel = await openFirst();
  server.use(http.get("/api/forms/approvals/:id/continuation", () => HttpResponse.json({code:"Authorization.Forbidden"},{status:403})));
  await userEvent.click(within(panel).getByRole("button", {name:"Siguiente"}));
  await screen.findByText("Ya no tenés permiso para decidir esta aprobación.");
  expect(screen.getByRole("columnheader", {name:"Importe"})).toBeVisible();
  expect(screen.queryByRole("link", {name:"Revisar VIS-00001"})).not.toBeInTheDocument();
  await waitFor(() => {
    for (const query of queryClient.getQueryCache().findAll({predicate: query => query.queryKey[0] === "form-approvals" && ["task","list","continuation"].includes(String(query.queryKey[2]))}))
      expect(query.state.data).toBeUndefined();
  });
});

it("cancels selected metadata without data when a form list is denied before that task completes", async () => {
  setup(true);
  let startTask!: () => void;
  const started = new Promise<void>(resolve => { startTask = resolve; });
  let releaseTask!: () => void;
  const released = new Promise<void>(resolve => { releaseTask = resolve; });
  server.use(http.get("/api/forms/approvals", async () => { await started; return HttpResponse.json({code:"Authorization.Forbidden"},{status:403}); }),
    http.get("/api/forms/approvals/:id", async () => { startTask(); await released; return HttpResponse.json(approvalTaskFixture()); }));
  renderRouteWithProviders(path + "?approval=" + approvalTaskFixture().id);
  await screen.findByText("Ya no tenés permiso para decidir esta aprobación.");
  await act(async () => { releaseTask(); await released; });
  expect(screen.getByRole("columnheader", {name:"Importe"})).toBeVisible();
  await waitFor(() => {
    for (const query of queryClient.getQueryCache().findAll({predicate: query => query.queryKey[0] === "form-approvals" && query.queryKey[2] === "task"}))
      expect(query.state.data).toBeUndefined();
  });
});

it.each(["sheet", "values"])("keeps decision metadata available when %s reading is forbidden", async source => {
  const fixture = setup(true);
  const denied = () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 });
  server.use(source === "sheet" ? http.post("/api/forms/definitions/:id/records/search", denied) : http.get("/api/forms/records/:id", denied));
  renderRouteWithProviders(path + "?approval=" + fixture.tasks[0].id);
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Detalle de la respuesta" })).getByRole("button", { name: "Aprobar" })).toBeVisible());
  const panel = screen.getByRole("region", { name: "Detalle de la respuesta" });
  await waitFor(() => expect(screen.queryByRole("columnheader", { name: "Importe" })).not.toBeInTheDocument());
  expect(within(panel).queryByText("Importe")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Revisar VIS-00001" })).toBeVisible();
  await userEvent.click(within(panel).getByRole("button", { name: "Aprobar" }));
  await waitFor(() => expect(fixture.decisions).toEqual([{ expectedRevision: 1, decision: "Approved" }]));
  expect(await within(screen.getByRole("region", { name: "Detalle de la respuesta" })).findByText(/Supervisora/)).toBeVisible();
  await waitFor(() => {
    for (const query of queryClient.getQueryCache().findAll({ predicate: query => query.queryKey[0] === "form-responses" }))
      expect(query.state.data).toBeUndefined();
  });
});

it("shares only captured and anchored pending references with full-detail navigation", async () => {
  const fixture = setup();
  const useWorkspace = workspaceHooks.useResponseWorkspace;
  const observed: { snapshot: ResponseNavigationContext | null } = { snapshot: null };
  const observe = vi.spyOn(workspaceHooks, "useResponseWorkspace").mockImplementation(function useObservedWorkspace(formId) {
    const value = useWorkspace(formId);
    if (formId === responseFormId) observed.snapshot = value.navigation;
    return value;
  });
  try {
    renderRouteWithProviders(path + "?approvalPageSize=1");
    const panel = await openFirst();
    await userEvent.click(within(panel).getByRole("button", { name: "Aprobar" }));
    await within(panel).findByText(/Supervisora/);
    await waitFor(() => expect(screen.getByRole("link", { name: "Revisar VIS-00002" })).toBeVisible());
    expect(observed.snapshot?.pending?.tasks).toEqual([{ id: fixture.tasks[0].id, recordId: fixture.tasks[0].recordId, requestedAtUtc: fixture.tasks[0].requestedAtUtc }]);
    expect(observed.snapshot?.selection).toEqual({ taskId: fixture.tasks[0].id, recordId: fixture.tasks[0].recordId });
    expect(observed.snapshot?.search).toContain("approval=" + fixture.tasks[0].id);
    expect(observed.snapshot?.pending).toMatchObject({ page: 1, pageSize: 1, totalCount: 2 });
    await userEvent.click(within(panel).getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(observed.snapshot?.selection.taskId).toBe(fixture.tasks[1].id));
    expect(observed.snapshot?.pending?.tasks).toEqual(fixture.tasks.map((task, index) => ({ id: task.id, recordId: task.recordId, requestedAtUtc: task.requestedAtUtc, ...(index ? { position: 1 } : {}) })));
    expect(observed.snapshot?.pending?.totalCount).toBe(2);
  } finally { observe.mockRestore(); }
});

it.each(["list", "task"])("announces a failed per-form %s read once and retries only that read", async target => {
  const fixture = setup();
  let attempts = 0;
  let recovered = false;
  const failure = () => HttpResponse.json({ code: "Test.Read", detail: "Falló esta lectura de aprobaciones." }, { status: 400 });
  server.use(target === "list" ? http.get("/api/forms/approvals", () => {
    attempts++; return !recovered ? failure() : HttpResponse.json({ items: fixture.tasks, page: 1, pageSize: 20, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false });
  }) : http.get("/api/forms/approvals/" + fixture.tasks[0].id, () => { attempts++; return !recovered ? failure() : HttpResponse.json(fixture.tasks[0]); }));
  renderRouteWithProviders(path + (target === "task" ? "?approval=" + fixture.tasks[0].id : ""));
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  expect(vi.mocked(notify).mock.calls[0][0]).toMatchObject({ kind: "error", message: "Falló esta lectura de aprobaciones." });
  expect(screen.queryByText("Falló esta lectura de aprobaciones.")).not.toBeInTheDocument();
  const owner = target === "task" ? within(screen.getByRole("region", { name: "Detalle de la respuesta" })) : screen;
  const beforeRetry = attempts; recovered = true;
  await userEvent.click(owner.getByRole("button", { name: "Reintentar" }));
  if (target === "task") expect(await owner.findByRole("button", { name: "Aprobar" })).toBeVisible();
  else expect(await owner.findByRole("link", { name: "Revisar VIS-00001" })).toBeVisible();
  expect(attempts).toBe(beforeRetry + 1);
  expect(fixture.decisions).toEqual([]);
});

it.each(["available", "missing"])("returns from an %s response to the same per-form pending page and private sheet filter", async availability => {
  setup(true);
  if (availability === "missing") server.use(http.get("/api/forms/records/" + responseSecondId, () => HttpResponse.json({ code: "Forms.Record.NotFound" }, { status: 404 })));
  const { router } = renderRouteWithProviders(path + "?approvalPage=2&approvalPageSize=1&pageSize=20&columns=none");
  const search = await screen.findByRole("searchbox", { name: "Buscar en textos largos" });
  await userEvent.type(search, "filtro privado");
  await waitFor(() => expect(search).toHaveValue("filtro privado"));
  await userEvent.click(await screen.findByRole("link", { name: "Revisar VIS-00002" }));
  const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await within(panel).findByRole("heading", { name: availability === "missing" ? "No encontramos esa respuesta o no está disponible" : "TEST-000001" });
  await userEvent.click(within(panel).getByRole("button", { name: "Cerrar" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Detalle de la respuesta" })).not.toBeInTheDocument());
  expect(router.state.location.pathname).toBe(path);
  expect(new URLSearchParams(router.state.location.search).get("approvalPage")).toBe("2");
  expect(new URLSearchParams(router.state.location.search).get("approvalPageSize")).toBe("1");
  expect(new URLSearchParams(router.state.location.search).get("columns")).toBe("none");
  expect(screen.getByRole("searchbox", { name: "Buscar en textos largos" })).toHaveValue("filtro privado");
  await waitFor(() => expect(screen.getByRole("link", { name: "Revisar VIS-00002" })).toHaveFocus());
});
