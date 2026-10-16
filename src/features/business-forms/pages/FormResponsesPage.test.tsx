import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { currentUser } from "@/test/mocks/handlers";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import {
  responseDetailFixture,
  responseWorkflowFixture,
  responseFormId,
  responseRecordId,
  responseSheetFixture,
} from "@/test/responseFixtures";
import { notify } from "@/shared/ui/notifications";
vi.mock("react-oidc-context", async () => ({
  ...(await vi.importActual<typeof import("react-oidc-context")>(
    "react-oidc-context",
  )),
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    user: { access_token: "test" },
  }),
}));
vi.mock("@/shared/ui/notifications", async () => ({
  ...(await vi.importActual<typeof import("@/shared/ui/notifications")>(
    "@/shared/ui/notifications",
  )),
  notify: vi.fn(),
}));
function setup(
  permissions = ["formrecords.read", "formrecords.export", "whatsapp.read"],
) {
  server.use(
    http.get("/api/me", () =>
      HttpResponse.json({ ...currentUser, permissions }),
    ),
    http.get("/api/forms/navigation", () =>
      HttpResponse.json({
        items: [
          {
            id: responseFormId,
            name: "Formulario publicado",
            prefix: "TEST",
            versionNumber: 2,
          },
        ],
        page: 1,
        pageSize: 4,
        totalCount: 1,
        totalPages: 1,
        hasPrevious: false,
        hasNext: false,
      }),
    ),
    http.post("/api/forms/definitions/:id/records/search", () =>
      HttpResponse.json(responseSheetFixture()),
    ),
    http.get("/api/forms/records/:id/workflow", ({ params }) => HttpResponse.json(responseWorkflowFixture(String(params.id)))),
    http.get("/api/forms/records/:id", ({ params }) =>
      HttpResponse.json(responseDetailFixture(String(params.id))),
    ),
    http.post(
      "/api/forms/definitions/:id/records/filter-counts/search",
      async ({ request }) => {
        const body = (await request.json()) as {
          dimension: string;
          fieldId?: string;
        };
        const sheet = responseSheetFixture();
        const field = sheet.columns.find(
          (column) => column.fieldId === body.fieldId,
        );
        const items =
          body.dimension === "version"
            ? sheet.versions.map((version) => ({
                id: version.id,
                label: String(version.number),
                count: 1,
              }))
            : body.dimension === "actor"
              ? [
                  {
                    id: sheet.records.items[0].actor.userId,
                    label: "Ana",
                    count: 2,
                  },
                ]
              : body.dimension === "presence"
                ? ["answered", "unanswered", "notAsked"].map((id, index) => ({
                    id,
                    label: id,
                    count:
                      field?.type === "shortText"
                        ? index === 0
                          ? 0
                          : 1
                        : index === 0
                          ? 2
                          : 0,
                  }))
                : field?.type === "choice"
                  ? field.options.map((option) => ({
                      id: option.id,
                      label: option.label,
                      count: 2,
                    }))
                  : [
                      { id: "true", label: "true", count: 0 },
                      { id: "false", label: "false", count: 2 },
                    ];
        return HttpResponse.json({
          items,
          page: 1,
          pageSize: 20,
          totalCount: items.length,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false,
        });
      },
    ),
  );
}
beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
});
describe("response sheet", () => {
  it("shows response states only when the form has approval rules",async()=>{setup();const payload=responseSheetFixture();payload.hasApproval=true;payload.records.items[0].state="PendingApproval";server.use(http.post("/api/forms/definitions/:id/records/search",()=>HttpResponse.json(payload)));renderRouteWithProviders("/formularios/"+responseFormId+"/respuestas");await screen.findByRole("columnheader",{name:"Estado"});expect(screen.getByText("Pendiente")).toBeInTheDocument();});
  it("keeps response values readable when approval permission is revoked",async()=>{setup(["formrecords.read","formapprovals.decide"]);const taskId=crypto.randomUUID();server.use(http.get("/api/forms/approvals/count",()=>HttpResponse.json({count:1})),http.get("/api/forms/records/:id/workflow",()=>HttpResponse.json({...responseWorkflowFixture(),recordState:"PendingApproval",task:{id:taskId,roleId:taskId,roleName:"Supervisión",revision:1,state:"Open",decidedAtUtc:null,decidedBy:null,reason:null}})),http.get("/api/forms/approvals/:id",()=>HttpResponse.json({id:taskId,definitionId:responseFormId,recordId:responseRecordId,number:"TEST-000002",formName:"Visita",author:{userId:taskId,displayName:"Ana"},role:{id:taskId,name:"Supervisión"},requestedAtUtc:"2026-10-16T12:00:00Z",revision:1,state:"Open",canDecide:true,cannotDecideReason:null,decidedAtUtc:null,decidedBy:null,reason:null})),http.post("/api/forms/approvals/:id/decisions",()=>HttpResponse.json({code:"Authorization.Forbidden"},{status:403})));renderRouteWithProviders("/formularios/"+responseFormId+"/respuestas/"+responseRecordId);await userEvent.click(await screen.findByRole("button",{name:"Aprobar"}));await screen.findByText("Ya no tenés permiso para decidir esta aprobación.");expect(screen.getByText("Texto completo para revisar")).toBeInTheDocument();});
  it("shows the historic decision to a reader without approval permission",async()=>{setup(["formrecords.read"]);const taskId=crypto.randomUUID();let metadataReads=0;server.use(http.get("/api/forms/records/:id/workflow",()=>HttpResponse.json({...responseWorkflowFixture(),recordState:"Rejected",task:{id:taskId,roleId:taskId,roleName:"Supervisión histórica",revision:2,state:"Rejected",decidedAtUtc:"2026-10-16T13:00:00Z",decidedBy:{userId:taskId,displayName:"Luz"},reason:"Falta la firma"}})),http.get("/api/forms/approvals/:id",()=>{metadataReads++;return HttpResponse.json({});}));renderRouteWithProviders("/formularios/"+responseFormId+"/respuestas/"+responseRecordId);await screen.findByText("Falta la firma");expect(screen.getByText(/Luz/)).toBeInTheDocument();expect(metadataReads).toBe(0);expect(screen.queryByRole("button",{name:"Aprobar"})).not.toBeInTheDocument();});

  it("withdraws response values and workflow reasons when the follow-up read is forbidden", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    let revoked = false;
    const privateReason = "private workflow reason";
    server.use(http.get("/api/forms/records/:id/workflow", () => revoked ? HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 }) : HttpResponse.json({ ...responseWorkflowFixture(), ruleRevision: 1, actions: [{ id: runId, ruleId: crypto.randomUUID(), kind: "NotifyAuthor", event: "Received", order: 1, state: "Uncertain", reasonCode: null, reason: privateReason, canConsult: true, canRetry: false, createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:00Z", completedAtUtc: null }] })),
      http.post("/api/forms/records/:id/actions/:runId/consult", () => { revoked = true; return HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 }); }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    await screen.findByText(privateReason);
    await userEvent.click(screen.getByRole("button", { name: "Consultar" }));
    await screen.findByRole("heading", { name: /permiso/i });
    expect(screen.queryByText("Texto completo para revisar")).not.toBeInTheDocument();
    expect(screen.queryByText(privateReason)).not.toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryCache().getAll().some(query => JSON.stringify(query.state.data)?.includes(privateReason))).toBe(false));
  });

  it("preserves the readable response when workflow recovery permission is revoked", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    const payload = { ...responseWorkflowFixture(), ruleRevision: 1, actions: [{ id: runId, ruleId: crypto.randomUUID(), kind: "NotifyAuthor", event: "Received", order: 1, state: "Uncertain", reasonCode: null, reason: null, canConsult: true, canRetry: false, createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:00Z", completedAtUtc: null }] };
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(payload)),
      http.post("/api/forms/records/:id/actions/:runId/consult", () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 })));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    await userEvent.click(await screen.findByRole("button", { name: "Consultar" }));
    await screen.findByText("Ya no tenés permiso para recuperar acciones.");
    expect(screen.getByRole("heading", { name: "TEST-000002" })).toBeInTheDocument();
    expect(screen.getByText("Texto completo para revisar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Consultar" })).not.toBeInTheDocument();
    expect(notify).not.toHaveBeenCalled();
  });

  it("consults an uncertain workflow action first and retries only the unconfirmed failure", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = "0199a0c0-0000-7000-8000-000000000090";
    let state = "Uncertain";
    const consulted = vi.fn();
    const retried = vi.fn();
    const payload = () => ({ ...responseWorkflowFixture(), ruleRevision: 3, actions: [{ id: runId, ruleId: "0199a0c0-0000-7000-8000-000000000091", kind: "NotifyAuthor", event: "Approved", order: 1, state, reasonCode: state === "Completed" ? null : "Test.Delivery", reason: state === "Completed" ? null : "Revisá la entrega.", canConsult: state === "Uncertain", canRetry: state === "Failed", createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:00Z", completedAtUtc: state === "Completed" ? "2026-10-16T12:01:00Z" : null }] });
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(payload())),
      http.post("/api/forms/records/:id/actions/:runId/consult", () => { consulted(); state = "Failed"; return HttpResponse.json(payload()); }),
      http.post("/api/forms/records/:id/actions/:runId/retry", () => { retried(); state = "Completed"; return HttpResponse.json(payload()); }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    await screen.findByRole("heading", { name: "TEST-000002" });
    const history = within(await screen.findByRole("region", { name: "Qué pasó después" }));
    expect(await history.findByText("Sin confirmar")).toBeInTheDocument();
    expect(history.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    await userEvent.click(history.getByRole("button", { name: "Consultar" }));
    await history.findByText("No se pudo");
    expect(consulted).toHaveBeenCalledTimes(1);
    expect(retried).not.toHaveBeenCalled();
    await userEvent.click(history.getByRole("button", { name: "Reintentar" }));
    await history.findByText("Hecho");
    expect(retried).toHaveBeenCalledTimes(1);
    expect(history.queryByRole("button", { name: "Consultar" })).not.toBeInTheDocument();
    expect(history.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });
  it("shows action states without recovery controls to a reader without RulesManage", async () => {
    setup(["formrecords.read"]);
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json({ ...responseWorkflowFixture(), ruleRevision: 1, actions: [{ id: crypto.randomUUID(), ruleId: crypto.randomUUID(), kind: "NotifyAuthor", event: "Received", order: 1, state: "Uncertain", reasonCode: null, reason: null, canConsult: true, canRetry: true, createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:00Z", completedAtUtc: null }] })));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const history = within(await screen.findByRole("region", { name: "Qué pasó después" }));
    await history.findByText("Sin confirmar");
    expect(history.queryByRole("button", { name: "Consultar" })).not.toBeInTheDocument();
    expect(history.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });

  it("uses the confirmed detail name in breadcrumbs even when navigation has a different name", async () => {
    setup();
    server.use(http.get("/api/forms/navigation", () => HttpResponse.json({ items: [{ id: responseFormId, name: "Nombre del menú", prefix: "TEST", versionNumber: 2 }], page: 1, pageSize: 4, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false })));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    await screen.findByRole("heading", { name: "TEST-000002" });
    const crumbs = within(screen.getByRole("navigation", { name: "Migas de pan" }));
    expect(crumbs.getByRole("link", { name: "Formulario publicado" })).toHaveAttribute("href", "/formularios/" + responseFormId + "/respuestas");
    expect(crumbs.queryByText("Nombre del menú")).not.toBeInTheDocument();
  });

  it("moves Next and Previous across response pages with the same order", async () => {
    setup();
    const rows = Array.from({ length: 21 }, (_, index) => ({ ...responseSheetFixture().records.items[0], id: "0199a0c0-0000-7000-8000-" + String(200 + index).padStart(12, "0"), number: "TEST-" + String(21 - index).padStart(6, "0") }));
    const requested = vi.fn();
    const fieldId = responseSheetFixture().columns[0].fieldId;
    server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => {
      const body = await request.json() as { page: number };
      requested(body);
      const page = body.page ?? 1;
      const sheet = responseSheetFixture();
      sheet.records = { items: rows.slice((page - 1) * 20, page * 20), page, pageSize: 20, totalCount: 21, totalPages: 2, hasPrevious: page > 1, hasNext: page < 2 };
      return HttpResponse.json(sheet);
    }), http.get("/api/forms/records/:id", ({ params }) => {
      const row = rows.find(item => item.id === params.id)!;
      return HttpResponse.json({ ...responseDetailFixture(), id: row.id, number: row.number });
    }));
    const { router } = renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + rows[19].id + "?sort=field&sortFieldId=" + fieldId + "");
    await screen.findByRole("heading", { name: "TEST-000002" });
    await waitFor(() => expect(screen.getByText("20 de 21")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByRole("heading", { name: "TEST-000001" });
    await waitFor(() => expect(screen.getByText("21 de 21")).toBeInTheDocument());
    expect(router.state.location.search).toContain("page=2");
    expect(requested).toHaveBeenCalledWith(expect.objectContaining({ page: 2, sort: "field", sortFieldId: fieldId }));
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByRole("heading", { name: "TEST-000002" });
    await waitFor(() => expect(screen.getByText("20 de 21")).toBeInTheDocument());
    expect(router.state.location.search).not.toContain("page=2");
    expect(requested).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sort: "field", sortFieldId: fieldId }));
  });
  it("clears private response filters when leaving the workspace", async () => {
    setup();
    const requested = vi.fn();
    server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { requested(await request.json()); return HttpResponse.json(responseSheetFixture()); }));
    const { router } = renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas");
    await screen.findByRole("table");
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar en textos largos" }), "private visit");
    await waitFor(() => expect(requested).toHaveBeenLastCalledWith(expect.objectContaining({ search: "private visit" })));
    await act(async () => { await router.navigate("/perfil"); });
    await screen.findByRole("heading", { name: "Mi perfil" });
    await waitFor(() => expect(queryClient.getQueryCache().getAll().some(query => JSON.stringify(query.queryKey).includes("private visit"))).toBe(false));
    requested.mockClear();
    await act(async () => { await router.navigate("/formularios/" + responseFormId + "/respuestas"); });
    await screen.findByRole("table");
    expect(screen.getByRole("searchbox", { name: "Buscar en textos largos" })).toHaveValue("");
    expect(requested).toHaveBeenLastCalledWith(expect.not.objectContaining({ search: "private visit" }));
  });
  it("orders a question in both directions using only its identity in the URL", async () => {
    setup();
    const requested = vi.fn();
    server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { requested(await request.json()); return HttpResponse.json(responseSheetFixture()); }));
    const { router } = renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas");
    await screen.findByRole("table");
    const header = within(screen.getByRole("table")).getByRole("columnheader", { name: /Importe/ });
    await userEvent.click(within(header).getByRole("button"));
    await waitFor(() => expect(requested).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "field", sortFieldId: responseSheetFixture().columns[0].fieldId })));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(router.state.location.search).not.toContain("Importe");
    await userEvent.click(within(header).getByRole("button"));
    await waitFor(() => expect(requested).toHaveBeenLastCalledWith(expect.objectContaining({ sort: "-field", sortFieldId: responseSheetFixture().columns[0].fieldId })));
    expect(header).toHaveAttribute("aria-sort", "descending");
  });
  it("keeps response detail readable without offering conversation access when whatsapp.read is absent", async () => {
    setup(["formrecords.read"]);
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    await screen.findByRole("heading", { name: "TEST-000002" });
    expect(screen.getByText("Texto completo para revisar")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir conversación" })).not.toBeInTheDocument();
  });

  it("shows zero, false, unanswered and a missing question without requiring template permission", async () => {
    setup();
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    expect(
      await screen.findByRole("link", { name: "TEST-000002" }),
    ).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("0")).toHaveLength(2);
    expect(within(table).getAllByText("No")).toHaveLength(2);
    expect(within(table).getByText("Sin respuesta")).toBeInTheDocument();
    expect(within(table).getByText("—")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Diseñar formularios" }),
    ).not.toBeInTheDocument();
  });
  it("sends private search in POST and retains rows when that search fails", async () => {
    setup();
    let captured: unknown;
    server.use(
      http.post(
        "/api/forms/definitions/:id/records/search",
        async ({ request }) => {
          const body = (await request.json()) as { search?: string };
          captured = body;
          return body.search
            ? HttpResponse.json(
                { detail: "Temporary failure", code: "Test.Failure" },
                { status: 500 },
              )
            : HttpResponse.json(responseSheetFixture());
        },
      ),
    );
    const { router } = renderRouteWithProviders(
      `/formularios/${responseFormId}/respuestas`,
    );
    await screen.findByRole("link", { name: "TEST-000002" });
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Buscar en textos largos" }),
      "private notes",
    );
    await waitFor(() =>
      expect(captured).toMatchObject({ search: "private notes" }),
    );
    expect(router.state.location.search).not.toContain("private");
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "error",
          action: undefined,
        }),
      ),
    );

    expect(
      await screen.findByRole("link", { name: "TEST-000002" }),
    ).toBeInTheDocument();
  });
  it("stores only selected question IDs in the URL and keeps fixed columns", async () => {
    setup();
    const { router } = renderRouteWithProviders(
      `/formularios/${responseFormId}/respuestas`,
    );
    await screen.findByRole("table");
    const trigger = screen.getByRole("button", { name: "Columnas" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(
      await screen.findByRole("menuitemcheckbox", { name: "Observaciones" }),
    );
    await userEvent.keyboard("{Escape}");
    expect(
      within(screen.getByRole("table")).queryByRole("columnheader", {
        name: /Observaciones/,
      }),
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("table")).getByRole("columnheader", {
        name: /N°/,
      }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toContain("columns=");
    expect(router.state.location.search).not.toContain("Observaciones");
  });
  it("loads response navigation only when the forms panel opens and preserves the shell", async () => {
    setup();
    const requested = vi.fn();
    server.use(http.get("/api/forms/navigation", () => { requested(); return HttpResponse.json({ items: [{ id: responseFormId, name: "Published form", prefix: "TEST", versionNumber: 2 }], page: 1, pageSize: 4, totalCount: 12, totalPages: 3, hasPrevious: false, hasNext: true }); }));
    renderRouteWithProviders("/perfil");
    await screen.findByRole("heading", { name: "Mi perfil" });
    const shell = screen.getByRole("navigation", { name: "Navegación principal" });
    const trigger = await screen.findByRole("button", { name: "Formularios" });
    expect(requested).not.toHaveBeenCalled();
    await userEvent.click(trigger);
    await screen.findByRole("link", { name: "Published form" });
    expect(screen.getByRole("link", { name: "Ver todos (12)" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "Published form" }));
    await screen.findByRole("table");
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBe(shell);
  });
  it("reports one detail failure when detail and its sheet both fail", async () => {
    setup();
    server.use(http.get("/api/forms/records/:id", () => HttpResponse.json({ detail: "Failed", code: "Test.Failure" }, { status: 500 })), http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json({ detail: "Failed", code: "Test.Failure" }, { status: 500 })));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas/${responseRecordId}`);
    await screen.findByRole("heading", { name: "No pudimos cargar las respuestas." });
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(vi.mocked(notify).mock.calls[0][0].action).toBeUndefined();
  });
  it("keeps a navigation failure local to the forms panel on another screen", async () => {
    setup();
    server.use(http.get("/api/forms/navigation", () => HttpResponse.json({ code: "Test.Failure" }, { status: 500 })));
    renderRouteWithProviders("/perfil");
    await screen.findByRole("heading", { name: "Mi perfil" });
    expect(notify).not.toHaveBeenCalled();
  });
  it("opens the historical detail and moves within the same sheet", async () => {
    setup();
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await userEvent.click(
      await screen.findByRole("link", { name: "TEST-000002" }),
    );
    await screen.findByRole("heading", { name: "TEST-000002" });
    expect(screen.getByText("Texto completo para revisar")).toBeInTheDocument();
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir conversación" }),
    ).toHaveAttribute("href", expect.stringContaining("conversacion="));
    await userEvent.click(
      await screen.findByRole("button", { name: "Siguiente" }),
    );
    await screen.findByRole("heading", { name: "TEST-000001" });
  });
  it("keeps the previous detail and focused Next button while the next answer loads", async () => {
    setup();
    let release: (() => void) | undefined;
    const requested = vi.fn();
    server.use(http.get("/api/forms/records/:id", async ({ params }) => {
      if (String(params.id) !== responseRecordId) { requested(); await new Promise<void>(resolve => { release = resolve; }); }
      return HttpResponse.json(responseDetailFixture(String(params.id)));
    }));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas/${responseRecordId}`);
    await screen.findByRole("heading", { name: "TEST-000002" });
    const button = screen.getByRole("button", { name: "Siguiente" });
    await userEvent.click(button);
    await waitFor(() => expect(requested).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "TEST-000002" })).toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(screen.getByRole("region", { name: "Detalle de la respuesta" })).toHaveAttribute("aria-busy", "true");
    await act(async () => release?.());
    await screen.findByRole("heading", { name: "TEST-000001" });
    expect(button).toHaveFocus();
  });
  it("shows every filter section and applies the server count for the received date draft", async () => {
    setup();
    const captured = vi.fn();
    server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { const body = await request.json() as { receivedFromUtc?: string }; captured(body); const sheet = responseSheetFixture(); if (body.receivedFromUtc) sheet.records.totalCount = 9; return HttpResponse.json(sheet); }));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Importe" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Observaciones" })).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Cargó" })).toBeInTheDocument();
    const input = within(dialog).getByLabelText("Recibida desde");
    await userEvent.type(input, "2026-10-16");
    await within(dialog).findByRole("button", { name: "Ver 9 respuestas" });
    expect(captured).toHaveBeenCalledWith(expect.objectContaining({ receivedFromUtc: expect.stringContaining("2026-10-16"), pageSize: 1 }));
  });
  it("counts only a settled valid decimal draft and applies that normalized value", async () => {
    setup();
    const captured: { dimension?: string; fieldId?: string; filter: { conditions?: { values: string[] }[] } }[] = [];
    server.use(http.post("/api/forms/definitions/:id/records/filter-counts/search", async ({ request }) => {
      captured.push(await request.json() as typeof captured[number]);
      return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false });
    }));
    let applied: unknown;
    server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => {
      applied = await request.json();
      return HttpResponse.json(responseSheetFixture());
    }));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(captured.length).toBeGreaterThan(1));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
    const initialCount = captured.length;
    const input = within(dialog).getByRole("textbox", { name: "Desde" });
    await userEvent.type(input, "-");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(captured).toHaveLength(initialCount);
    expect(within(dialog).getByRole("button", { name: /Ver .* respuestas|Aplicar filtros/ })).toBeDisabled();
    await userEvent.clear(input);
    await userEvent.type(input, "12,");
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 350)); });
    expect(captured).toHaveLength(initialCount);
    await userEvent.type(input, "5");
    expect(captured).toHaveLength(initialCount);
    await waitFor(() => expect(captured.some(item => item.filter.conditions?.some(condition => condition.values?.includes("12.5")))).toBe(true));
    expect(captured.filter(item => item.dimension === "presence" && item.fieldId === responseSheetFixture().columns[0].fieldId)).toHaveLength(1);
    await userEvent.click(within(dialog).getByRole("button", { name: /Ver .* respuestas|Aplicar filtros/ }));
    await waitFor(() => expect(applied).toMatchObject({ conditions: [expect.objectContaining({ operator: "gte", values: ["12.5"] })] }));
    expect(notify).not.toHaveBeenCalled();
  });
  it.each([400, 429])("does not offer an immediate retry after a facet HTTP %s", async status => {
    setup();
    const requested = vi.fn();
    server.use(http.post("/api/forms/definitions/:id/records/filter-counts/search", () => {
      requested();
      return HttpResponse.json({ detail: "Review the filter", code: "Test.Filter", retryAfter: 60 }, { status });
    }));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(vi.mocked(notify).mock.calls[0][0].action).toBeUndefined();
    if (status === 429) {
      const actor = within(dialog).getByRole("region", { name: "Cargó" });
      expect(within(actor).getByRole("button", { name: "Reintentar" })).toBeDisabled();
      expect(within(actor).getByRole("status")).toHaveTextContent("60");
    } else expect(within(dialog).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(requested).toHaveBeenCalled();
  });
  it("names an account without a display name in the person filter", async () => {
    setup();
    const sheet = responseSheetFixture();
    server.use(
      http.post("/api/forms/definitions/:id/records/filter-counts/search", () =>
        HttpResponse.json({
          items: [
            { id: sheet.records.items[0].actor.userId, label: "", count: 2 },
          ],
          page: 1,
          pageSize: 20,
          totalCount: 1,
          totalPages: 1,
          hasPrevious: false,
          hasNext: false,
        }),
      ),
    );
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByRole("checkbox", {
        name: "Persona sin información",
      }),
    ).toBeInTheDocument();
  });
  it("offers yes and no directly without a text search for a boolean question", async () => {
    setup();
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      await within(dialog).findByRole("checkbox", { name: "No" }),
    ).toBeEnabled();
    expect(
      within(within(dialog).getByRole("region", { name: "Confirmado" })).queryByRole("searchbox", { name: "Buscar opciones" }),
    ).not.toBeInTheDocument();
  });
  it("withdraws all values and counts after a denied filter count", async () => {
    setup();
    server.use(
      http.post("/api/forms/definitions/:id/records/filter-counts/search", () =>
        HttpResponse.json({ code: "Forms.Record.Forbidden" }, { status: 403 }),
      ),
    );
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    await screen.findByRole("heading", { name: /permiso/i });
    expect(screen.queryByText("TEST-000002")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
  it("hides export without its permission and exports the visible IDs with filters when allowed", async () => {
    setup(["formrecords.read"]);
    const rendered = renderRouteWithProviders(
      `/formularios/${responseFormId}/respuestas`,
    );
    await screen.findByRole("table");
    expect(
      screen.queryByRole("button", { name: "Exportar a Excel" }),
    ).not.toBeInTheDocument();
    rendered.unmount();
    queryClient.clear();
    setup();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:export"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    let sent: unknown;
    server.use(
      http.post(
        "/api/forms/definitions/:id/records/export",
        async ({ request }) => {
          sent = await request.json();
          return new HttpResponse(new Uint8Array([80, 75]), {
            headers: {
              "content-type":
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "content-disposition": "attachment; filename*=UTF-8''TEST.xlsx",
            },
          });
        },
      ),
    );
    renderRouteWithProviders(
      `/formularios/${responseFormId}/respuestas?columns=none`,
    );
    await screen.findByRole("table");
    await userEvent.click(
      screen.getByRole("button", { name: "Exportar a Excel" }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("radio", { name: /Solo las visibles/ }),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Exportar a Excel" }),
    );
    await waitFor(() =>
      expect(sent).toMatchObject({
        columns: [],
        filter: { page: 1, pageSize: 20 },
      }),
    );
    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "success" }),
      ),
    );
  });
  it("disables export while the visible total belongs to the previous filters", async () => {
    setup();
    let release: (() => void) | undefined;
    const requested = vi.fn();
    server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => {
      const body = await request.json() as { search?: string };
      if (body.search) { requested(); await new Promise<void>(resolve => { release = resolve; }); }
      return HttpResponse.json(responseSheetFixture());
    }));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar en textos largos" }), "new");
    await waitFor(() => expect(requested).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "Exportar a Excel" })).toBeDisabled();
    await act(async () => release?.());
    await waitFor(() => expect(screen.getByRole("button", { name: "Exportar a Excel" })).toBeEnabled());
  });
  it("retains the export wait after closing and reopening the dialog", async () => {
    setup();
    server.use(http.post("/api/forms/definitions/:id/records/export", () => HttpResponse.json({ code: "Test.Wait", retryAfter: 60 }, { status: 429 })));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Exportar a Excel" }));
    let dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Exportar a Excel" }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Exportar a Excel" })).toBeDisabled());
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await userEvent.click(screen.getByRole("button", { name: "Exportar a Excel" }));
    dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Exportar a Excel" })).toBeDisabled();
    expect(within(dialog).getByText(/Esperá .* segundos/)).toBeInTheDocument();
  });
  it("closes a denied export and preserves the readable sheet", async () => {
    setup();
    server.use(http.post("/api/forms/definitions/:id/records/export", () => HttpResponse.json({ code: "Forms.Record.Forbidden" }, { status: 403 })));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Exportar a Excel" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Exportar a Excel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "TEST-000002" })).toBeInTheDocument();
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ message: "Ya no tenés permiso para exportar respuestas." }));
  });
  it("does not request responses without read permission", async () => {
    setup([]);
    const requested = vi.fn();
    server.use(
      http.post("/api/forms/definitions/:id/records/search", () => {
        requested();
        return HttpResponse.json(responseSheetFixture());
      }),
    );
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("heading", { name: /permiso/i });
    expect(requested).not.toHaveBeenCalled();
  });
  it("treats a missing response as unavailable without an operational notification", async () => {
    setup();
    server.use(
      http.get("/api/forms/records/:id", () =>
        HttpResponse.json({ code: "Forms.Record.NotFound" }, { status: 404 }),
      ),
    );
    renderRouteWithProviders(
      `/formularios/${responseFormId}/respuestas/${responseRecordId}`,
    );
    await screen.findByRole("heading", {
      name: "No encontramos esa respuesta o no está disponible",
    });
    expect(notify).not.toHaveBeenCalled();
  });
});
