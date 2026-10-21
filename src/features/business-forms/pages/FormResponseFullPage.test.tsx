import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { queryClient } from "@/shared/api/queryClient";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { approvalTaskFixture } from "@/test/approvalFixtures";
import { responseFormId, responseRecordId, responseSecondId, responseSheetFixture, responseDetailFixture, responseWorkflowFixture } from "@/test/responseFixtures";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
const path = `/formularios/${responseFormId}/respuestas`;
const secondTaskId = "0199a0c0-0000-7000-8000-000000000071";
const priorRecordId = "0199a0c0-0000-7000-8000-000000000072";
function setup(permissions = ["formrecords.read"], pending = false) {
  const reads = { details: 0, workflow: 0, sheets: [] as Record<string, unknown>[], anchors: [] as Record<string, unknown>[], decisions: 0 };
  const tasks = [approvalTaskFixture(), { ...approvalTaskFixture(), id: secondTaskId, recordId: responseSecondId, number: "TEST-000001", requestedAtUtc: "2026-10-16T13:00:00Z" }];
  const sheet = responseSheetFixture(); sheet.hasApproval = pending;
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { reads.sheets.push(await request.json() as Record<string, unknown>); return HttpResponse.json(sheet); }),
    http.post("/api/forms/definitions/:id/records/:recordId/navigation", async ({ params, request }) => { reads.anchors.push(await request.json() as Record<string, unknown>); const first = params.recordId === responseRecordId; return HttpResponse.json({ recordId: params.recordId, previousId: first ? null : responseRecordId, nextId: first ? responseSecondId : null, position: first ? 1 : 2, totalCount: 2 }); }),
    http.get("/api/forms/records/:id", ({ params }) => { reads.details++; return HttpResponse.json(responseDetailFixture(String(params.id))); }),
    http.get("/api/forms/records/:id/workflow", ({ params }) => { reads.workflow++; const task = pending ? tasks.find(task => task.recordId === params.id) : undefined; return HttpResponse.json({ ...responseWorkflowFixture(String(params.id)), recordState: task ? task.state === "Open" ? "PendingApproval" : task.state : "Received", task: task ? { id: task.id, roleId: task.role.id, roleName: task.role.name, requestedAtUtc: task.requestedAtUtc, revision: task.revision, state: task.state, decidedAtUtc: task.decidedAtUtc, decidedBy: task.decidedBy, reason: task.reason } : null }); }),
    http.get("/api/forms/approvals", ({ request }) => { const url = new URL(request.url); const size = Number(url.searchParams.get("pageSize") ?? 20); const page = Number(url.searchParams.get("page") ?? 1); const open = tasks.filter(task => task.state === "Open"); return HttpResponse.json({ items: open.slice((page - 1) * size, page * size), page, pageSize: size, totalCount: open.length, totalPages: Math.ceil(open.length / size), hasPrevious: page > 1, hasNext: page * size < open.length }); }),
    http.get("/api/forms/approvals/:id", ({ params }) => HttpResponse.json(tasks.find(task => task.id === params.id))),
    http.post("/api/forms/approvals/:id/decisions", async ({ params, request }) => { const body = await request.json() as { decision: "Approved" }; const task = tasks.find(task => task.id === params.id)!; reads.decisions++; Object.assign(task, { state: body.decision, revision: 2, canDecide: false, cannotDecideReason: "AlreadyDecided", decidedAtUtc: "2026-10-17T13:00:00Z", decidedBy: { userId: currentUser.id, displayName: "Luz" } }); return HttpResponse.json({ taskId: task.id, recordId: task.recordId, state: task.state, revision: task.revision, decidedAtUtc: task.decidedAtUtc, decidedBy: task.decidedBy, reason: null }); }),
  );
  return { reads, tasks };
}
function mobile() {
  vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)", media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
}
beforeEach(() => queryClient.clear());
afterEach(() => vi.restoreAllMocks());

it("opens full from the quick view and returns to the same selected row and private filters", async () => {
  const { reads } = setup();
  const { router } = renderRouteWithProviders(path + "?sort=-number&columns=none&pageSize=20");
  const search = await screen.findByRole("searchbox", { name: "Buscar en textos largos" });
  await userEvent.type(search, "private observation");
  await waitFor(() => expect(reads.sheets.at(-1)?.search).toBe("private observation"));
  await userEvent.click(screen.getByRole("link", { name: "TEST-000002" }));
  const quick = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await userEvent.click(await within(quick).findByRole("link", { name: "Abrir en pantalla completa" }));
  await waitFor(() => expect(router.state.location.pathname).toBe(path + "/" + responseRecordId + "/completa"));
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  expect(router.state.location.search).toBe("?sort=-number");
  expect(JSON.stringify(router.state.location.state)).not.toContain("private");
  expect(reads.anchors.at(-1)).toMatchObject({ search: "private observation", sort: "-number" });
  await userEvent.click(screen.getByRole("link", { name: "Volver a las respuestas" }));
  const row = await screen.findByRole("link", { name: "TEST-000002" });
  expect(screen.getByRole("searchbox", { name: "Buscar en textos largos" })).toHaveValue("private observation");
  await waitFor(() => expect(row).toHaveFocus());
  expect(row.closest("tr")).toHaveAttribute("aria-selected", "true");
  expect(router.state.location.search).toContain("columns=none");
  expect(screen.queryByRole("region", { name: "Detalle de la respuesta" })).not.toBeInTheDocument();
});

it("anchors a shared direct link beyond page one using only public order and versions", async () => {
  const { reads } = setup();
  server.use(http.post("/api/forms/definitions/:id/records/:recordId/navigation", async ({ params, request }) => { reads.anchors.push(await request.json() as Record<string, unknown>); return HttpResponse.json({ recordId: params.recordId, previousId: priorRecordId, nextId: responseSecondId, position: 21, totalCount: 43 }); }));
  const versionId = responseSheetFixture().versions[0].id;
  const { router } = renderRouteWithProviders(path + "/" + responseRecordId + "/completa?sort=-number&versionIds=" + versionId + "&search=private&actorIds=private");
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  expect(await screen.findByText("21 de 43")).toBeVisible();
  expect(reads.anchors).toHaveLength(1);
  expect(reads.anchors[0]).toMatchObject({ sort: "-number", versionIds: [versionId] });
  expect(reads.anchors[0]).not.toHaveProperty("search");
  expect(reads.anchors[0]).not.toHaveProperty("actorIds");
  expect(reads.sheets).toHaveLength(0);
  expect(router.state.location.search).not.toContain("private");
  expect(screen.getByRole("heading", { name: "TEST-000002", level: 1 }).closest('[tabindex="-1"]')).toHaveFocus();
  await userEvent.keyboard("{ArrowDown}");
  await waitFor(() => expect(router.state.location.pathname).toBe(path + "/" + responseSecondId + "/completa"));
});

it.each(["row", "direct"])("opens the full page on mobile through the %s entry", async entry => {
  mobile(); setup();
  const { router } = renderRouteWithProviders(entry === "row" ? path : path + "/" + responseRecordId);
  if (entry === "row") await userEvent.click(await screen.findByRole("link", { name: "TEST-000002" }));
  await waitFor(() => expect(router.state.location.pathname).toBe(path + "/" + responseRecordId + "/completa"));
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  expect(screen.queryByRole("dialog", { name: "Detalle de la respuesta" })).not.toBeInTheDocument();
});

it("keeps decision-only users in the metadata quick view and refuses the full route", async () => {
  const { reads } = setup(["formapprovals.decide"], true);
  const { router } = renderRouteWithProviders(path + "/" + responseRecordId + "/completa");
  await waitFor(() => expect(router.state.location.pathname).toBe("/sin-permiso"));
  expect(reads.details).toBe(0); expect(reads.workflow).toBe(0); expect(reads.anchors).toHaveLength(0);
});

it("keeps the captured pending successor after deciding on a compacted one-row page", async () => {
  const { reads } = setup(["formrecords.read", "formapprovals.decide"], true);
  const { router } = renderRouteWithProviders(path + "?approvalPageSize=1");
  await userEvent.click(await screen.findByRole("link", { name: "Revisar VIS-00001" }));
  const quick = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await userEvent.click(await within(quick).findByRole("link", { name: "Abrir en pantalla completa" }));
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  await userEvent.click(await screen.findByRole("button", { name: "Aprobar" }));
  await waitFor(() => expect(reads.decisions).toBe(1));
  const next = screen.getByRole("button", { name: "Siguiente" });
  await waitFor(() => expect(next).toBeEnabled());
  await userEvent.click(next);
  await waitFor(() => expect(router.state.location.pathname).toBe(path + "/" + responseSecondId + "/completa"));
  await screen.findByRole("heading", { name: "TEST-000001", level: 1 });
  expect(reads.anchors).toHaveLength(0);
  expect(await screen.findByText("2 de 2 por aprobar")).toBeVisible();
});
it("withdraws only pending metadata when cross-page approval navigation is forbidden", async () => {
  const { reads } = setup(["formrecords.read", "formapprovals.decide"], true);
  server.use(http.get("/api/forms/approvals", ({ request }) => {
    const page = Number(new URL(request.url).searchParams.get("page") ?? 1);
    return page === 2 ? HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 }) :
      HttpResponse.json({ items: [approvalTaskFixture()], page: 1, pageSize: 1, totalCount: 2, totalPages: 2, hasPrevious: false, hasNext: true });
  }));
  renderRouteWithProviders(path + "?approvalPageSize=1");
  await userEvent.click(await screen.findByRole("link", { name: "Revisar VIS-00001" }));
  const quick = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await userEvent.click(await within(quick).findByRole("link", { name: "Abrir en pantalla completa" }));
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  await userEvent.click(await screen.findByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument());
  expect(screen.getByRole("heading", { name: "TEST-000002", level: 1 })).toBeVisible();
  expect(screen.getByText("Texto completo para revisar")).toBeVisible();
  expect(screen.queryByText("No tenés permiso")).not.toBeInTheDocument();
  expect(screen.queryByText("1 de 2 por aprobar")).not.toBeInTheDocument();
  expect(reads.decisions).toBe(0);
});
it("preserves the open desktop context when resizing its quick view to mobile", async () => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  let isMobile = false;
  vi.spyOn(globalThis, "matchMedia").mockImplementation(query => ({ matches: query === "(width < 640px)" && isMobile, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), addEventListener: (_type: string, listener: unknown) => { if (query === "(width < 640px)") listeners.add(listener as (event: MediaQueryListEvent) => void); },
    removeEventListener: (_type: string, listener: unknown) => { listeners.delete(listener as (event: MediaQueryListEvent) => void); }, dispatchEvent: vi.fn() }));
  const { reads } = setup();
  renderRouteWithProviders(path);
  await userEvent.type(await screen.findByRole("searchbox", { name: "Buscar en textos largos" }), "private resize");
  await waitFor(() => expect(reads.sheets.at(-1)?.search).toBe("private resize"));
  await userEvent.click(screen.getByRole("link", { name: "TEST-000002" }));
  await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await act(async () => { isMobile = true; for (const listener of listeners) listener({ matches: true } as MediaQueryListEvent); });
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  await waitFor(() => expect(reads.anchors.at(-1)?.search).toBe("private resize"));
  await userEvent.click(screen.getByRole("link", { name: "Volver a las respuestas" }));
  expect(await screen.findByRole("searchbox", { name: "Buscar en textos largos" })).toHaveValue("private resize");
});
it("clears private memory for a shared link entered from the same form without an internal intent", async () => {
  const { reads } = setup();
  const { router } = renderRouteWithProviders(path);
  await userEvent.type(await screen.findByRole("searchbox", { name: "Buscar en textos largos" }), "private previous visit");
  await waitFor(() => expect(reads.sheets.at(-1)?.search).toBe("private previous visit"));
  await act(async () => { await router.navigate(path + "/" + responseRecordId + "/completa?sort=-number"); });
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  await waitFor(() => expect(reads.anchors).toHaveLength(1));
  expect(reads.anchors[0]).not.toHaveProperty("search");
  await userEvent.click(screen.getByRole("link", { name: "Volver a las respuestas" }));
  expect(await screen.findByRole("searchbox", { name: "Buscar en textos largos" })).toHaveValue("");
});
it.each([false, true])("keeps the observed pending order when a cold approval link opens full (mobile: %s)", async isMobile => {
  if (isMobile) mobile();
  const { reads, tasks } = setup(["formrecords.read", "formapprovals.decide"], true);
  renderRouteWithProviders(path + "?approval=" + tasks[0].id);
  if (!isMobile) {
    await screen.findByRole("heading", { name: "TEST-000002", level: 2 });
    const quick = await screen.findByRole("region", { name: "Detalle de la respuesta" });
    await userEvent.click(await within(quick).findByRole("link", { name: "Abrir en pantalla completa" }));
  }
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  expect(await screen.findByText("1 de 2 por aprobar")).toBeVisible();
  expect(reads.anchors).toHaveLength(0);
  await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await screen.findByRole("heading", { name: "TEST-000001", level: 1 });
  expect(await screen.findByText("2 de 2 por aprobar")).toBeVisible();
  expect(reads.anchors).toHaveLength(0);
});
it.each(["document", "pdf"])("preserves the sheet context from its mobile %s shortcut", async shortcut => {
  mobile(); const { reads } = setup();
  const sheet = responseSheetFixture();
  sheet.records.items[0].hasPdf = true;
  const fieldId = "0199a0c0-0000-7000-8000-000000000088";
  sheet.columns.push({ fieldId, type: "document", label: "Archivo", introducedInVersion: 1, options: [] });
  sheet.records.items[0].cells.push({ fieldId, type: "document", state: "Answered", value: [{ fileId: "0199a0c0-0000-7000-8000-000000000089", name: "remito.pdf", contentType: "application/pdf", size: 40, hasThumbnail: false }] });
  sheet.records.items[1].cells.push({ fieldId, type: "document", state: "Unanswered", value: null });
  server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { reads.sheets.push(await request.json() as Record<string, unknown>); return HttpResponse.json(sheet); }));
  renderRouteWithProviders(path);
  await userEvent.type(await screen.findByRole("searchbox", { name: "Buscar en textos largos" }), "private shortcut");
  await waitFor(() => expect(reads.sheets.at(-1)?.search).toBe("private shortcut"));
  await userEvent.click(shortcut === "document" ? screen.getByRole("link", { name: /1 documento/ }) : screen.getByRole("button", { name: "Ver PDF de TEST-000002" }));
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  await waitFor(() => expect(reads.anchors.at(-1)?.search).toBe("private shortcut"));
  await userEvent.click(screen.getByRole("link", { name: "Volver a las respuestas" }));
  expect(await screen.findByRole("searchbox", { name: "Buscar en textos largos" })).toHaveValue("private shortcut");
});
it("keeps the previous answer visible and busy until the next full response is confirmed", async () => {
  setup();
  let release: (() => void) | undefined;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  server.use(http.get("/api/forms/records/" + responseSecondId, async () => {
    requested = true; await gate; return HttpResponse.json(responseDetailFixture(responseSecondId));
  }));
  renderRouteWithProviders(path + "/" + responseRecordId + "/completa");
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  await waitFor(() => expect(screen.getByRole("button", { name: "Siguiente" })).toBeEnabled());
  await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(requested).toBe(true));
  try {
    const previous = screen.getByRole("heading", { name: "TEST-000002", level: 1 });
    expect(previous).toBeVisible();
    expect(previous.closest('[tabindex="-1"]')).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  } finally { await act(async () => release?.()); }
  await screen.findByRole("heading", { name: "TEST-000001", level: 1 });
});