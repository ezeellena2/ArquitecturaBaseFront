import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { queryClient } from "@/shared/api/queryClient";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { approvalTaskFixture } from "@/test/approvalFixtures";
import { responseFormId, responseRecordId, responseSecondId, responseSheetFixture, responseDetailFixture, responseWorkflowFixture } from "@/test/responseFixtures";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),
  useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/hooks/usePrivateFormFile", async () => ({ ...await vi.importActual<typeof import("@/shared/hooks/usePrivateFormFile")>("@/shared/hooks/usePrivateFormFile"), savePrivateBlob: vi.fn() }));
const path = `/formularios/${responseFormId}/respuestas`;
const secondTaskId = "0199a0c0-0000-7000-8000-000000000071";
const priorRecordId = "0199a0c0-0000-7000-8000-000000000072";
function setup(permissions = ["formrecords.read"], pending = false) {
  const reads = { details: 0, workflow: 0, sheets: [] as Record<string, unknown>[], anchors: [] as Record<string, unknown>[], continuations: [] as string[], pendingPages: [] as string[][], decisions: 0 };
  const tasks = [approvalTaskFixture(), { ...approvalTaskFixture(), id: secondTaskId, recordId: responseSecondId, number: "TEST-000001", requestedAtUtc: "2026-10-16T13:00:00Z" }];
  const sheet = responseSheetFixture(); sheet.hasApproval = pending;
  server.use(
    http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions })),
    http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { reads.sheets.push(await request.json() as Record<string, unknown>); return HttpResponse.json(sheet); }),
    http.post("/api/forms/definitions/:id/records/:recordId/navigation", async ({ params, request }) => { reads.anchors.push(await request.json() as Record<string, unknown>); const first = params.recordId === responseRecordId; return HttpResponse.json({ recordId: params.recordId, previousId: first ? null : responseRecordId, nextId: first ? responseSecondId : null, position: first ? 1 : 2, totalCount: 2 }); }),
    http.get("/api/forms/records/:id", ({ params }) => { reads.details++; return HttpResponse.json(responseDetailFixture(String(params.id))); }),
    http.get("/api/forms/records/:id/workflow", ({ params }) => { reads.workflow++; const task = pending ? tasks.find(task => task.recordId === params.id) : undefined; return HttpResponse.json({ ...responseWorkflowFixture(String(params.id)), recordState: task ? task.state === "Open" ? "PendingApproval" : task.state : "Received", task: task ? { id: task.id, roleId: task.role.id, roleName: task.role.name, requestedAtUtc: task.requestedAtUtc, revision: task.revision, state: task.state, decidedAtUtc: task.decidedAtUtc, decidedBy: task.decidedBy, reason: task.reason } : null }); }),
    http.get("/api/forms/approvals", ({ request }) => { const url = new URL(request.url); const size = Number(url.searchParams.get("pageSize") ?? 20); const page = Number(url.searchParams.get("page") ?? 1); const open = tasks.filter(task => task.state === "Open"); reads.pendingPages.push(open.slice((page - 1) * size, page * size).map(task => task.id)); return HttpResponse.json({ items: open.slice((page - 1) * size, page * size), page, pageSize: size, totalCount: open.length, totalPages: Math.ceil(open.length / size), hasPrevious: page > 1, hasNext: page * size < open.length }); }),
    http.get("/api/forms/approvals/:id/continuation", ({ params, request }) => {
      reads.continuations.push(String(params.id));
      const url = new URL(request.url); const size = Number(url.searchParams.get("pageSize") ?? 20);
      const direction = url.searchParams.get("direction");
      const ordered = [...tasks].sort((left, right) => left.requestedAtUtc.localeCompare(right.requestedAtUtc) || left.id.localeCompare(right.id));
      const anchorIndex = ordered.findIndex(task => task.id === params.id);
      const open = ordered.filter(task => task.state === "Open");
      const candidates = open.filter(task => direction === "Previous" ? ordered.indexOf(task) < anchorIndex : ordered.indexOf(task) > anchorIndex);
      const batch = direction === "Previous" ? candidates.slice(-size) : candidates.slice(0, size);
      return HttpResponse.json({ anchorTaskId: params.id, definitionId: responseFormId, direction,
        items: batch.map(task => ({ task, position: open.indexOf(task) + 1 })), totalCount: open.length, hasMore: candidates.length > size });
    }),
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

it("continues to the pending successor after deciding on a compacted one-row page", async () => {
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
  expect(reads.continuations).toHaveLength(1);
});
it.each(["quick", "full"] as const)("does not skip the next pending task when another approver removes an earlier row (%s)", async view => {
  const { reads, tasks } = setup(["formrecords.read", "formapprovals.decide"], true);
  const thirdTask = { ...tasks[1], id: "0199a0c0-0000-7000-8000-000000000073", recordId: priorRecordId, number: "TEST-000003", requestedAtUtc: "2026-10-16T14:00:00Z" };
  const fourthTask = { ...tasks[1], id: "0199a0c0-0000-7000-8000-000000000074", recordId: "0199a0c0-0000-7000-8000-000000000075", number: "TEST-000004", requestedAtUtc: "2026-10-16T15:00:00Z" };
  tasks.push(thirdTask, fourthTask);
  let continuations = 0;
  server.use(
    http.get("/api/forms/records/:id", ({ params }) => HttpResponse.json({ ...responseDetailFixture(responseRecordId), id: String(params.id), number: tasks.find(task => task.recordId === params.id)!.number })),
    http.get("/api/forms/approvals/:id/continuation", ({ params }) => {
      continuations++;
      return HttpResponse.json({ anchorTaskId: params.id, definitionId: responseFormId, direction: "Next", items: [thirdTask, fourthTask].map((task, index) => ({ task, position: index + 2 })), totalCount: 3, hasMore: false });
    }),
  );
  const { router } = renderRouteWithProviders(path + "?approvalPageSize=2");
  await userEvent.click(await screen.findByRole("link", { name: "Revisar TEST-000001" }));
  const quick = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await within(quick).findByRole("heading", { name: "TEST-000001" });
  if (view === "full") {
    await userEvent.click(within(quick).getByRole("link", { name: "Abrir en pantalla completa" }));
    await screen.findByRole("heading", { name: "TEST-000001", level: 1 });
  }
  Object.assign(tasks[0], { state: "Approved", revision: 2, canDecide: false, cannotDecideReason: "AlreadyDecided" });
  await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(view === "full" ? router.state.location.pathname : new URLSearchParams(router.state.location.search).get("approval"))
    .toBe(view === "full" ? path + "/" + thirdTask.recordId + "/completa" : thirdTask.id));
  expect(continuations).toBe(1);
  expect(reads.anchors).toHaveLength(0);
});

it.each(["quick", "full"] as const)("continues after the resolved anchor without accepting a compacted offset page (%s)", async view => {
  const { reads, tasks } = setup(["formrecords.read", "formapprovals.decide"], true);
  const thirdTask = { ...tasks[1], id: "0199a0c0-0000-7000-8000-000000000073", recordId: priorRecordId, number: "TEST-000003", requestedAtUtc: "2026-10-16T14:00:00Z" };
  const fourthTask = { ...tasks[1], id: "0199a0c0-0000-7000-8000-000000000074", recordId: "0199a0c0-0000-7000-8000-000000000075", number: "TEST-000004", requestedAtUtc: "2026-10-16T15:00:00Z" };
  tasks.push(thirdTask, fourthTask);
  server.use(http.get("/api/forms/records/:id", ({ params }) => HttpResponse.json({ ...responseDetailFixture(responseRecordId), id: String(params.id), number: tasks.find(task => task.recordId === params.id)!.number })));
  const { router } = renderRouteWithProviders(path + "?approvalPageSize=1&approvalPage=2");
  await userEvent.click(await screen.findByRole("link", { name: "Revisar TEST-000001" }));
  const quick = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await within(quick).findByRole("heading", { name: "TEST-000001" });
  if (view === "full") {
    await userEvent.click(within(quick).getByRole("link", { name: "Abrir en pantalla completa" }));
    await screen.findByRole("heading", { name: "TEST-000001", level: 1 });
  }
  Object.assign(tasks[0], { state: "Approved", revision: 2, canDecide: false, cannotDecideReason: "AlreadyDecided" });
  await userEvent.click(await screen.findByRole("button", { name: "Aprobar" }));
  await waitFor(() => expect(reads.decisions).toBe(1));
  await waitFor(() => expect(reads.pendingPages.at(-1)).toEqual([fourthTask.id]));
  await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
  await waitFor(() => expect(view === "full" ? router.state.location.pathname : new URLSearchParams(router.state.location.search).get("approval"))
    .toBe(view === "full" ? path + "/" + thirdTask.recordId + "/completa" : thirdTask.id));
  expect(reads.continuations).toEqual([tasks[1].id]);
  expect(reads.anchors).toHaveLength(0);
});
it("keeps keyboard arrows in the pending queue without publishing its private sheet filter", async () => {
  const { reads } = setup(["formrecords.read", "formapprovals.decide"], true);
  const { router } = renderRouteWithProviders(path);
  await userEvent.type(await screen.findByRole("searchbox", { name: "Buscar en textos largos" }), "private pending keyboard");
  await waitFor(() => expect(reads.sheets.at(-1)?.search).toBe("private pending keyboard"));
  await userEvent.click(screen.getByRole("link", { name: "Revisar VIS-00001" }));
  const quick = await screen.findByRole("region", { name: "Detalle de la respuesta" });
  await userEvent.click(await within(quick).findByRole("link", { name: "Abrir en pantalla completa" }));
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  await userEvent.keyboard("{ArrowDown}");
  await screen.findByRole("heading", { name: "TEST-000001", level: 1 });
  expect(screen.getByText("2 de 2 por aprobar")).toBeVisible();
  await userEvent.keyboard("{ArrowUp}");
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  expect(screen.getByText("1 de 2 por aprobar")).toBeVisible();
  expect(reads.anchors).toHaveLength(0);
  expect(router.state.location.search).not.toContain("private");
  expect(JSON.stringify(router.state.location.state)).not.toContain("private");
  await userEvent.click(screen.getByRole("link", { name: "Volver a las respuestas" }));
  expect(await screen.findByRole("searchbox", { name: "Buscar en textos largos" })).toHaveValue("private pending keyboard");
});
it("withdraws only pending metadata when cross-page approval navigation is forbidden", async () => {
  const { reads } = setup(["formrecords.read", "formapprovals.decide"], true);
  server.use(
    http.get("/api/forms/approvals", () => HttpResponse.json({ items: [approvalTaskFixture()], page: 1, pageSize: 1, totalCount: 2, totalPages: 2, hasPrevious: false, hasNext: true })),
    http.get("/api/forms/approvals/:id/continuation", () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 })),
  );
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
  expect(reads.continuations).toHaveLength(0);
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
function setupIssuedDocuments() {
  setup();
  const documents = [0, 1].map(index => ({ id: `0199a0c0-0000-7000-8000-00000000008${index}`, runId: `0199a0c0-0000-7000-8000-00000000009${index}`,
    culture: index === 0 ? "es" as const : "en" as const, name: index === 0 ? "Primer comprobante.pdf" : "Second receipt.pdf", size: 40,
    createdAtUtc: index === 0 ? "2026-10-16T15:00:00Z" : "2026-10-16T11:00:00Z" }));
  const reads: string[] = [];
  let url = 0;
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:fixed-pdf-" + ++url) });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  server.use(
    http.get("/api/forms/records/:id/workflow", ({ params }) => HttpResponse.json({ ...responseWorkflowFixture(String(params.id)), recordState: "Approved", ruleRevision: 1,
      actions: documents.map((document, index) => ({ id: document.runId, ruleId: document.runId, kind: "GeneratePdf", event: "Approved", order: index + 1, revision: 0, state: "Completed",
        reasonCode: null, reason: null, canConsult: false, canRetry: false, recipients: [], createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: `2026-10-16T1${index + 2}:00:00Z`, completedAtUtc: `2026-10-16T1${index + 2}:00:00Z` })),
      documents: [...documents].reverse() })),
    http.get("/api/forms/records/:id/documents/:documentId/content", ({ params }) => { reads.push(String(params.documentId)); return new HttpResponse(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf", "content-language": documents.find(document => document.id === params.documentId)!.culture } }); }),
  );
  return { documents, reads };
}

it.each(["pdf", "row", "shared"] as const)("opens mobile activity only for the PDF shortcut and retires its intent (%s)", async entry => {
  mobile(); const { documents, reads } = setupIssuedDocuments();
  const sheet = responseSheetFixture(); sheet.records.items[0].hasPdf = true;
  server.use(http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(sheet)));
  const { router } = renderRouteWithProviders((entry === "shared" ? path + "/" + responseRecordId + "/completa" : path) + "?sort=-number");
  if (entry !== "shared") await userEvent.click(await screen.findByRole(entry === "pdf" ? "button" : "link", { name: entry === "pdf" ? "Ver PDF de TEST-000002" : "TEST-000002" }));
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  const activity = screen.getByRole("region", { name: "Actividad" });
  expect(router.state.location.search).toBe("?sort=-number");
  expect(router.state.location.state).toBeNull();
  if (entry === "pdf") {
    expect(within(activity).getByRole("button", { name: "Plegar actividad" })).toHaveAttribute("aria-expanded", "true");
    expect(await within(activity).findByText(documents[0].name)).toBeVisible();
    await waitFor(() => expect(reads).toHaveLength(2));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Volver a las respuestas" }));
    await userEvent.click(await screen.findByRole("link", { name: "TEST-000002" }));
    await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
    expect(screen.getByRole("button", { name: "Expandir actividad" })).toHaveAttribute("aria-expanded", "false");
    expect(reads).toHaveLength(2);
  } else {
    expect(within(activity).getByRole("button", { name: "Expandir actividad" })).toHaveAttribute("aria-expanded", "false");
    expect(reads).toEqual([]);
    expect(screen.queryByTitle("Vista previa del PDF")).not.toBeInTheDocument();
  }
});
it("opens fixed PDF copies in their exact action and reuses preview bytes after folding or enlarging", async () => {
  mobile(); const { documents, reads } = setupIssuedDocuments();
  const view = renderRouteWithProviders(path + "/" + responseRecordId + "/completa");
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  await waitFor(() => expect(screen.getByRole("button", { name: "Expandir actividad" })).toBeEnabled());
  expect(reads).toEqual([]);
  expect(screen.getByText("Recibida · Al aprobarla")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Expandir actividad" }));
  const actions = await screen.findAllByText("Armar el PDF", { exact: true });
  const first = actions[0].closest("li")!;
  const second = actions[1].closest("li")!;
  expect(within(first).getByText(documents[0].name)).toBeVisible();
  expect(within(second).getByText(documents[1].name)).toBeVisible();
  const preview = await within(first).findByTitle("Vista previa del PDF");
  await waitFor(() => expect(reads).toHaveLength(2));
  const src = preview.getAttribute("src");
  await userEvent.click(within(first).getByRole("button", { name: "Ver PDF" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByTitle("Vista previa del PDF")).toHaveAttribute("src", src);
  expect(reads).toHaveLength(2);
  await userEvent.click(within(dialog).getAllByRole("button", { name: "Cerrar" })[0]);
  await userEvent.click(screen.getByRole("button", { name: "Plegar actividad" }));
  await userEvent.click(screen.getByRole("button", { name: "Expandir actividad" }));
  expect(reads).toHaveLength(2);
  expect(within(first).getByTitle("Vista previa del PDF")).toHaveAttribute("src", src);
  expect(within(first).queryByText("Se lo mandó Ana")).not.toBeInTheDocument();
  expect(screen.getByText("Se lo mandó Ana")).toBeVisible();
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith(src);
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
});

it("offers uploaded documents in the full download menu and reads bytes only after selection", async () => {
  mobile(); setupIssuedDocuments();
  const fileId = "0199a0c0-0000-7000-8000-000000000089";
  let files = 0;
  server.use(http.get("/api/forms/records/:id", ({ params }) => { const record = responseDetailFixture(String(params.id));
    record.values.push({ fieldId: fileId, key: "remito", type: "document", label: "Remito", value: [{ fileId, name: "remito.pdf", contentType: "application/pdf", size: 40, hasThumbnail: false }] });
    return HttpResponse.json(record); }),
    http.get("/api/forms/records/:id/files/:fileId/content", () => { files++; return new HttpResponse(new Uint8Array([37, 80, 68, 70]), { headers: { "content-type": "application/pdf" } }); }));
  renderRouteWithProviders(path + "/" + responseRecordId + "/completa");
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  await act(async () => screen.getByRole("button", { name: "Descargar", expanded: false }).focus());
  await userEvent.keyboard("{Enter}");
  const item = await screen.findByRole("menuitem", { name: "remito.pdf" });
  expect(files).toBe(0);
  await userEvent.click(item);
  await waitFor(() => expect(files).toBe(1));
  await waitFor(() => expect(savePrivateBlob).toHaveBeenCalledWith(expect.anything(), "remito.pdf"));
});

it("withdraws the full response when its inline issued PDF read is forbidden", async () => {
  mobile(); setupIssuedDocuments();
  server.use(http.get("/api/forms/records/:id/documents/:documentId/content", () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 })));
  renderRouteWithProviders(path + "/" + responseRecordId + "/completa");
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  await userEvent.click(screen.getByRole("button", { name: "Expandir actividad" }));
  await waitFor(() => expect(screen.queryByRole("heading", { name: "TEST-000002", level: 1 })).not.toBeInTheDocument());
  expect(screen.queryByTitle("Vista previa del PDF")).not.toBeInTheDocument();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
it("keeps the loaded PDF identity when anchoring changes only the return page", async () => {
  const { reads } = setupIssuedDocuments();
  let position = 1;
  server.use(http.post("/api/forms/definitions/:id/records/:recordId/navigation", ({ params }) => HttpResponse.json({ recordId: params.recordId,
    previousId: position === 1 ? null : priorRecordId, nextId: responseSecondId, position, totalCount: 43 })));
  renderRouteWithProviders(path + "/" + responseRecordId + "/completa");
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  await waitFor(() => expect(screen.getAllByTitle("Vista previa del PDF")).toHaveLength(2));
  expect(reads).toHaveLength(2);
  const urls = screen.getAllByTitle("Vista previa del PDF").map(preview => preview.getAttribute("src"));
  position = 21;
  await act(async () => { await queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === "form-responses" && query.queryKey[2] === "record-navigation" }); });
  expect(await screen.findByText("21 de 43")).toBeVisible();
  await waitFor(() => expect(screen.getAllByTitle("Vista previa del PDF")).toHaveLength(2));
  expect(reads).toHaveLength(2);
  expect(screen.getAllByTitle("Vista previa del PDF").map(preview => preview.getAttribute("src"))).toEqual(urls);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
});
it("supplies the confirmed form parent and response number to full-page breadcrumbs", async () => {
  setup();
  renderRouteWithProviders(path + "/" + responseRecordId + "/completa");
  await screen.findByRole("heading", { name: "TEST-000002", level: 1 });
  const trail = within(screen.getByRole("navigation", { name: "Migas de pan" }));
  expect(trail.getAllByRole("listitem").map(item => item.textContent)).toEqual(["Inicio", "Gestión de formularios", "Formularios", "Formulario publicado", "TEST-000002"]);
  expect(trail.getByRole("link", { name: "Formulario publicado" })).toHaveAttribute("href", path);
  expect(trail.queryByRole("link", { name: "Diseñar formularios" })).not.toBeInTheDocument();
});
