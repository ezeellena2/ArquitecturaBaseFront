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
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { approvalTaskFixture, approvalTaskId } from "@/test/approvalFixtures";
import type { ApprovalPage, ApprovalTask } from "../api/approvals";
import type { ResponseAction, ResponseRecipient, ResponseWorkflow } from "../api/workflow";
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
  const emptyApprovals: ApprovalPage = { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false };
  server.use(
    http.get("/api/forms/approvals", () => HttpResponse.json(emptyApprovals)),
    http.get("/api/me", () =>
      HttpResponse.json({ ...currentUser, permissions }),
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
const recipientUserId = "0199a0c0-0000-7000-8000-000000000092";
function recipientFixture(overrides: Partial<ResponseRecipient> = {}): ResponseRecipient {
  return { user: { userId: recipientUserId, displayName: "Juan" }, channelId: "WhatsApp", state: "Uncertain", reasonCode: null, reason: null, canReview: true, deliveredAtUtc: null, readAtUtc: null, review: null, ...overrides };
}
function roleWorkflow(runId: string, recipients: readonly ResponseRecipient[], state: ResponseAction["state"] = "Uncertain"): ResponseWorkflow {
  return { ...responseWorkflowFixture(), actions: [{ id: runId, ruleId: runId, kind: "NotifyRole", event: "Received", order: 0, revision: 3, state, reasonCode: null, reason: null, canConsult: state === "Uncertain", canRetry: false, recipients: [...recipients], createdAtUtc: "2026-10-17T12:00:00Z", updatedAtUtc: "2026-10-17T12:00:00Z", completedAtUtc: state === "Completed" ? "2026-10-17T13:00:00Z" : null }] };
}
function setupDetailDecision() {
  setup(["formrecords.read", "formapprovals.decide"]);
  const fixture: { task: ApprovalTask; workflowReads: number; writes: unknown[] } = { task: { ...approvalTaskFixture(), number: "TEST-000002" }, workflowReads: 0, writes: [] as unknown[] };
  const complete = (decision: "Approved" | "Rejected", name = "Luz", reason: string | null = null) => {
    fixture.task = { ...fixture.task, state: decision, revision: 2, canDecide: false, cannotDecideReason: "AlreadyDecided", decidedAtUtc: "2026-10-17T13:00:00Z", decidedBy: { userId: currentUser.id, displayName: name }, reason };
  };
  const workflow = (): ResponseWorkflow => ({ ...responseWorkflowFixture(), recordState: fixture.task.state === "Open" ? "PendingApproval" : fixture.task.state, task: { id: fixture.task.id, roleId: fixture.task.role.id, roleName: fixture.task.role.name, requestedAtUtc: fixture.task.requestedAtUtc, revision: fixture.task.revision, state: fixture.task.state, decidedAtUtc: fixture.task.decidedAtUtc, decidedBy: fixture.task.decidedBy, reason: fixture.task.reason } });
  server.use(http.get("/api/forms/approvals/count", () => HttpResponse.json({ count: 1 })),
    http.get("/api/forms/approvals/" + approvalTaskId, () => HttpResponse.json(fixture.task)),
    http.get("/api/forms/records/:id/workflow", () => { fixture.workflowReads++; return HttpResponse.json(workflow()); }),
    http.post("/api/forms/approvals/:id/decisions", async ({ request }) => {
      const body = await request.json() as { decision: "Approved" | "Rejected"; reason?: string };
      fixture.writes.push(body); complete(body.decision, "Luz", body.reason ?? null);
      const task = fixture.task;
      return HttpResponse.json({ taskId: task.id, recordId: task.recordId, revision: task.revision, state: task.state, decidedAtUtc: task.decidedAtUtc, decidedBy: task.decidedBy, reason: task.reason });
    }));
  return { fixture, complete };
}
function uncertainWorkflow(runId: string): ResponseWorkflow {
  return { ...responseWorkflowFixture(), actions: [{ id: runId, ruleId: runId, kind: "NotifyAuthor", event: "Received", order: 0, revision: 0, state: "Uncertain", reasonCode: null, reason: null, canConsult: true, canRetry: false, recipients: [recipientFixture()], createdAtUtc: "2026-10-17T12:00:00Z", updatedAtUtc: "2026-10-17T12:00:00Z", completedAtUtc: null }] };
}

async function openResponseTab(name: "Respuesta" | "Actividad" | "PDF") {
  const panel = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
  await userEvent.click(await panel.findByRole("tab", { name }));
  return within(await panel.findByRole("tabpanel", { name }));
}
async function openResponseActivity() {
  const tab = await openResponseTab("Actividad");
  return within(tab.getByRole("region", { name: "Actividad" }));
}

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
});
describe("response sheet", () => {
  it.each([
    ["Received", "Recibida", "outline"],
    ["PendingApproval", "Por aprobar", "warning"],
    ["Approved", "Aprobada", "success"],
    ["Rejected", "Rechazada", "danger"],
  ] as const)("shows the semantic response state badge for %s", async (state, label, variant) => {
    setup();
    const payload = responseSheetFixture();
    payload.hasApproval = true;
    payload.records.items = [{ ...payload.records.items[0], state }];
    payload.records.totalCount = 1;
    server.use(http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(payload)));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas");
    await screen.findByRole("columnheader", { name: "Estado" });
    const cell = within(screen.getByRole("table")).getByRole("cell", { name: label });
    const badge = within(cell).getByText(label);
    expect(badge).toHaveAttribute("data-slot", "badge");
    expect(badge).toHaveAttribute("data-variant", variant);
  });
  it("keeps response values readable when approval permission is revoked",async()=>{setup(["formrecords.read","formapprovals.decide"]);const taskId=crypto.randomUUID();server.use(http.get("/api/forms/approvals/count",()=>HttpResponse.json({count:1})),http.get("/api/forms/records/:id/workflow",()=>HttpResponse.json({...responseWorkflowFixture(),recordState:"PendingApproval",task:{id:taskId,roleId:taskId,roleName:"Supervisión", requestedAtUtc:"2026-10-16T12:00:00Z",revision:1,state:"Open",decidedAtUtc:null,decidedBy:null,reason:null}})),http.get("/api/forms/approvals/:id",()=>HttpResponse.json({id:taskId,definitionId:responseFormId,recordId:responseRecordId,number:"TEST-000002",formName:"Visita",author:{userId:taskId,displayName:"Ana"},role:{id:taskId,name:"Supervisión"},requestedAtUtc:"2026-10-16T12:00:00Z",revision:1,state:"Open",canDecide:true,cannotDecideReason:null,decidedAtUtc:null,decidedBy:null,reason:null})),http.post("/api/forms/approvals/:id/decisions",()=>HttpResponse.json({code:"Authorization.Forbidden"},{status:403})));renderRouteWithProviders("/formularios/"+responseFormId+"/respuestas/"+responseRecordId);
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));await userEvent.click(await screen.findByRole("button",{name:"Aprobar"}));await screen.findByText("Ya no tenés permiso para decidir esta aprobación.");expect(responseView.getByText("Texto completo para revisar")).toBeInTheDocument();});
  it("shows the historic decision to a reader without approval permission",async()=>{setup(["formrecords.read"]);const taskId=crypto.randomUUID();let metadataReads=0;server.use(http.get("/api/forms/records/:id/workflow",()=>HttpResponse.json({...responseWorkflowFixture(),recordState:"Rejected",task:{id:taskId,roleId:taskId,roleName:"Supervisión histórica", requestedAtUtc:"2026-10-16T12:00:00Z",revision:2,state:"Rejected",decidedAtUtc:"2026-10-16T13:00:00Z",decidedBy:{userId:taskId,displayName:"Luz"},reason:"Falta la firma"}})),http.get("/api/forms/approvals/:id",()=>{metadataReads++;return HttpResponse.json({});}));renderRouteWithProviders("/formularios/"+responseFormId+"/respuestas/"+responseRecordId);
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));await within((await responseView.findByRole("heading", { name: "Rechazada", level: 3 })).closest("li")!).findByText("Falta la firma");expect(within(responseView.getByRole("heading", { name: "Rechazada", level: 3 }).closest("li")!).getByText(/Luz/)).toBeInTheDocument();expect(metadataReads).toBe(0);expect(screen.queryByRole("button",{name:"Aprobar"})).not.toBeInTheDocument();});

  it("withdraws response values and workflow reasons when the follow-up read is forbidden", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    let revoked = false;
    const privateReason = "private workflow reason";
    server.use(http.get("/api/forms/records/:id/workflow", () => revoked ? HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 }) : HttpResponse.json({ ...responseWorkflowFixture(), ruleRevision: 1, actions: [{ id: runId, ruleId: crypto.randomUUID(), kind: "NotifyAuthor", event: "Received", order: 1, revision: 0, state: "Uncertain", reasonCode: null, reason: privateReason, canConsult: true, canRetry: false, recipients: [recipientFixture()], createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:00Z", completedAtUtc: null }] })),
      http.post("/api/forms/records/:id/actions/:runId/consult", () => { revoked = true; return HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 }); }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    await activity.findByText(privateReason);
    await userEvent.click(activity.getByRole("button", { name: "Consultar" }));
    await screen.findByRole("heading", { name: /permiso/i });
    expect(screen.queryByText("Texto completo para revisar")).not.toBeInTheDocument();
    expect(screen.queryByText(privateReason)).not.toBeInTheDocument();
    await waitFor(() => expect(queryClient.getQueryCache().getAll().some(query => JSON.stringify(query.state.data)?.includes(privateReason))).toBe(false));
  });

  it("preserves the readable response when workflow recovery permission is revoked", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    const payload = { ...responseWorkflowFixture(), ruleRevision: 1, actions: [{ id: runId, ruleId: crypto.randomUUID(), kind: "NotifyAuthor", event: "Received", order: 1, revision: 0, state: "Uncertain", reasonCode: null, reason: null, canConsult: true, canRetry: false, recipients: [recipientFixture()], createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:00Z", completedAtUtc: null }] };
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(payload)),
      http.post("/api/forms/records/:id/actions/:runId/consult", () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 })));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    const activity = await openResponseActivity();
    await userEvent.click(await activity.findByRole("button", { name: "Consultar" }));
    await screen.findByText("Ya no tenés permiso para recuperar acciones.");
    expect(screen.getByRole("heading", { name: "TEST-000002" })).toBeInTheDocument();
    expect(activity.queryByRole("button", { name: "Consultar" })).not.toBeInTheDocument();
    await openResponseTab("Respuesta");
    expect(responseView.getByText("Texto completo para revisar")).toBeInTheDocument();
    expect(notify).not.toHaveBeenCalled();
  });

  it("consults an uncertain workflow action first and retries only the unconfirmed failure", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = "0199a0c0-0000-7000-8000-000000000090";
    let state: "Uncertain" | "Failed" | "Completed" = "Uncertain";
    const consulted = vi.fn();
    const retried = vi.fn();
    const payload = () => ({ ...responseWorkflowFixture(), recordState: "Approved", ruleRevision: 3, actions: [{ id: runId, ruleId: "0199a0c0-0000-7000-8000-000000000091", kind: "NotifyAuthor", event: "Approved", order: 1, revision: 0, state, reasonCode: state === "Completed" ? null : "Test.Delivery", reason: state === "Completed" ? null : "Revisá la entrega.", canConsult: state === "Uncertain", canRetry: state === "Failed", recipients: [recipientFixture({ state: state === "Completed" ? "Accepted" : state, canReview: state === "Uncertain" })], createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:00Z", completedAtUtc: state === "Completed" ? "2026-10-16T12:01:00Z" : null }] });
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(payload())),
      http.post("/api/forms/records/:id/actions/:runId/consult", () => { consulted(); state = "Failed"; return HttpResponse.json(payload()); }),
      http.post("/api/forms/records/:id/actions/:runId/retry", () => { retried(); state = "Completed"; return HttpResponse.json(payload()); }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    await screen.findByRole("heading", { name: "TEST-000002" });
    const history = activity;
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
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json({ ...responseWorkflowFixture(), ruleRevision: 1, actions: [{ id: crypto.randomUUID(), ruleId: crypto.randomUUID(), kind: "NotifyAuthor", event: "Received", order: 1, revision: 0, state: "Uncertain", reasonCode: null, reason: null, canConsult: true, canRetry: true, recipients: [recipientFixture()], createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:00Z", completedAtUtc: null }] })));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    const history = activity;
    await history.findByText("Sin confirmar");
    expect(history.queryByRole("button", { name: "Consultar" })).not.toBeInTheDocument();
    expect(history.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(history.queryByRole("button", { name: "Resolver envío" })).not.toBeInTheDocument();
  });

  it.each([true, false])("records a human decision wasSent=%s without resending an uncertain notice", async wasSent => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = "0199a0c0-0000-7000-8000-000000000090";
    const requests: unknown[] = [];
    let state: ResponseAction["state"] = "Uncertain";
    let review: ResponseRecipient["review"] = null;
    const payload = (): ResponseWorkflow => ({ ...responseWorkflowFixture(), ruleRevision: 1, actions: [{ id: runId, ruleId: runId, kind: "NotifyAuthor", event: "Received", order: 0, revision: 0, state, reasonCode: null, reason: null, canConsult: state === "Uncertain", canRetry: state === "Failed", recipients: [recipientFixture({ state: state === "Uncertain" ? "Uncertain" : state === "Failed" ? "Failed" : "Accepted", canReview: state === "Uncertain", review })], createdAtUtc: "2026-10-17T12:00:00Z", updatedAtUtc: "2026-10-17T13:00:00Z", completedAtUtc: null }] });
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(payload())),
      http.post("/api/forms/records/:id/actions/:runId/consult", () => HttpResponse.json(payload())),
      http.post("/api/forms/records/:id/actions/:runId/review", async ({ request, params }) => {
        expect(params).toMatchObject({ id: responseRecordId, runId });
        requests.push(await request.json());
        review = { wasSent, reviewedAtUtc: "2026-10-17T13:00:00Z", reviewedBy: { userId: currentUser.id, displayName: "Luz" } };
        state = wasSent ? "Waiting" : "Failed";
        return HttpResponse.json(payload(), { status: 202 });
      }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    const history = activity;
    await userEvent.click(await history.findByRole("button", { name: "Consultar" }));
    expect(history.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    await userEvent.click(history.getByRole("button", { name: "Resolver envío" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Resolver el envío" }));
    expect(dialog.getByRole("button", { name: "Confirmar revisión" })).toBeDisabled();
    expect(requests).toEqual([]);
    await userEvent.click(dialog.getByRole("radio", { name: wasSent ? "Salió" : "No salió" }));
    await userEvent.click(dialog.getByRole("button", { name: wasSent ? "Confirmar que salió" : "Confirmar que no salió" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(requests).toEqual([{ recipientUserId, expectedRevision: 0, wasSent }]);
    expect(await history.findByText(wasSent ? "Luz indicó que salió." : "Luz indicó que no salió.")).toBeInTheDocument();
    expect(history.getByText("Revisión humana: no confirma la entrega de WhatsApp.")).toBeInTheDocument();
    expect(history.queryByText("Entregado")).not.toBeInTheDocument();
    expect(history.queryByRole("button", { name: "Resolver envío" })).not.toBeInTheDocument();
    expect(history.queryByRole("button", { name: "Reintentar" }) !== null).toBe(!wasSent);
    await waitFor(() => expect(history.getByText(wasSent ? "Luz indicó que salió." : "Luz indicó que no salió.").closest("li")).toHaveFocus());
  });
  it("cancels a human review without writing and restores focus to its action", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    const writes = vi.fn();
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json({ ...uncertainWorkflow(runId), actions: [{ ...uncertainWorkflow(runId).actions[0], canRetry: true }] })), http.post("/api/forms/records/:id/actions/:runId/review", () => { writes(); return HttpResponse.json({}); }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    const resolve = await activity.findByRole("button", { name: "Resolver envío" });
    await userEvent.click(resolve);
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("radio", { name: "No salió" }));
    await userEvent.click(dialog.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(resolve).toHaveFocus());
    expect(writes).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    await userEvent.click(resolve);
    expect(within(screen.getByRole("dialog")).getByRole("radio", { name: "No salió" })).not.toBeChecked();
  });
  it("keeps the human choice after a network failure and never repeats the review automatically", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    const writes = vi.fn();
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(uncertainWorkflow(runId))), http.post("/api/forms/records/:id/actions/:runId/review", () => { writes(); return HttpResponse.error(); }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    const activity = await openResponseActivity();
    await userEvent.click(await activity.findByRole("button", { name: "Resolver envío" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("radio", { name: "Salió" }));
    await userEvent.click(dialog.getByRole("button", { name: "Confirmar que salió" }));
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(dialog.getByRole("radio", { name: "Salió" })).toBeChecked();
    expect(writes).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    await userEvent.click(dialog.getByRole("button", { name: "Cancelar" }));
    await openResponseTab("Respuesta");
    expect(responseView.getByText("Texto completo para revisar")).toBeInTheDocument();
  });
  it("removes human review controls after a forbidden operation without hiding readable response values", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(uncertainWorkflow(runId))), http.post("/api/forms/records/:id/actions/:runId/review", () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 })));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    const activity = await openResponseActivity();
    await userEvent.click(await activity.findByRole("button", { name: "Resolver envío" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("radio", { name: "No salió" }));
    await userEvent.click(dialog.getByRole("button", { name: "Confirmar que no salió" }));
    await screen.findByText("Ya no tenés permiso para recuperar acciones.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolver envío" })).not.toBeInTheDocument();
    await openResponseTab("Respuesta");
    expect(responseView.getByText("Texto completo para revisar")).toBeInTheDocument();
    expect(notify).not.toHaveBeenCalled();
  });

  it("ignores a late human review after navigating to another response", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    const other = responseSheetFixture().records.items.find(row => row.id !== responseRecordId)!;
    let release!: () => void;
    let requested = false;
    server.use(http.get("/api/forms/records/:id/workflow", ({ params }) => HttpResponse.json(params.id === responseRecordId ? uncertainWorkflow(runId) : responseWorkflowFixture(String(params.id)))),
      http.post("/api/forms/records/:id/actions/:runId/review", async () => {
        requested = true;
        await new Promise<void>(resolve => { release = resolve; });
        return HttpResponse.json({ ...uncertainWorkflow(runId), actions: [{ ...uncertainWorkflow(runId).actions[0], state: "Waiting", canConsult: false, recipients: [recipientFixture({ state: "Accepted", canReview: false, review: { wasSent: true, reviewedAtUtc: "2026-10-17T13:00:00Z", reviewedBy: { userId: currentUser.id, displayName: "Old response reviewer" } } })] }] }, { status: 202 });
      }));
    const { router } = renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    await userEvent.click(await activity.findByRole("button", { name: "Resolver envío" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("radio", { name: "Salió" }));
    await userEvent.click(dialog.getByRole("button", { name: "Confirmar que salió" }));
    await waitFor(() => expect(requested).toBe(true));
    await act(async () => { await router.navigate("/formularios/" + responseFormId + "/respuestas/" + other.id); });
    await screen.findByRole("heading", { name: other.number });
    await act(async () => { release(); });
    expect(screen.queryByText("Old response reviewer indicó que salió.")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(notify).not.toHaveBeenCalled();
    await act(async () => { await router.navigate("/formularios/" + responseFormId + "/respuestas/" + responseRecordId); });
    await (await openResponseActivity()).findByRole("button", { name: "Resolver envío" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each(["network", "server", "conflict"] as const)("consults workflow after a lost or conflicting human review: %s", async failure => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    let reads = 0;
    const posts: unknown[] = [];
    let response: ResponseWorkflow = { ...uncertainWorkflow(runId), actions: [{ ...uncertainWorkflow(runId).actions[0], revision: 3 }] };
    server.use(http.get("/api/forms/records/:id/workflow", () => { reads++; return HttpResponse.json(response); }),
      http.post("/api/forms/records/:id/actions/:runId/review", async ({ request }) => {
        posts.push(await request.json());
        response = { ...response, actions: [{ ...response.actions[0], revision: 4, state: "Completed", canConsult: false, recipients: [recipientFixture({ state: "Accepted", canReview: false, review: { wasSent: true, reviewedAtUtc: "2026-10-17T13:00:00Z", reviewedBy: { userId: currentUser.id, displayName: "Luz" } } })] }] };
        return failure === "network" ? HttpResponse.error() : HttpResponse.json({ code: failure === "conflict" ? "Forms.Action.StateConflict" : "Server.Error", detail: "La acción cambió." }, { status: failure === "conflict" ? 409 : 503 });
      }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    await userEvent.click(await activity.findByRole("button", { name: "Resolver envío" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("radio", { name: "Salió" }));
    await userEvent.click(dialog.getByRole("button", { name: "Confirmar que salió" }));
    await waitFor(() => expect(reads).toBe(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(posts).toEqual([{ recipientUserId, expectedRevision: 3, wasSent: true }]);
    const evidence = screen.getByText("Luz indicó que salió.");
    await waitFor(() => expect(evidence.closest("li")).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(notify).toHaveBeenCalledTimes(failure === "conflict" ? 1 : 0);
  });

  it.each(["network", "rateLimit"] as const)("requires a successful workflow check before repeating a review when recovery also failed: %s", async failure => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    let reads = 0;
    const posts: unknown[] = [];
    server.use(http.get("/api/forms/records/:id/workflow", () => { reads++; return reads === 2 ? failure === "network" ? HttpResponse.error() : HttpResponse.json({ code: "RateLimit.Exceeded", retryAfter: 1 }, { status: 429 }) : HttpResponse.json(uncertainWorkflow(runId)); }),
      http.post("/api/forms/records/:id/actions/:runId/review", async ({ request }) => { posts.push(await request.json()); return HttpResponse.error(); }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    await userEvent.click(await activity.findByRole("button", { name: "Resolver envío" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("radio", { name: "No salió" }));
    await userEvent.click(dialog.getByRole("button", { name: "Confirmar que no salió" }));
    await waitFor(() => expect(reads).toBe(2));
    expect(dialog.getByRole("radio", { name: "No salió" })).toBeChecked();
    const check = await dialog.findByRole("button", { name: "Consultar" });
    expect(dialog.getByRole("radio", { name: "Salió" })).toBeDisabled();
    expect(dialog.getByRole("radio", { name: "No salió" })).toBeDisabled();
    // The wait is the reason of the disabled check; when it ends the check is drawn again without its reason.
    if (failure === "rateLimit") { expect(check).toBeDisabled(); expect(check).toHaveAccessibleDescription("Esperá 1 segundo para volver a intentar."); await waitFor(() => expect(dialog.getByRole("button", { name: "Consultar" })).toBeEnabled(), { timeout: 2000 }); }
    await userEvent.click(dialog.getByRole("button", { name: "Consultar" }));
    await dialog.findByRole("button", { name: "Confirmar que no salió" });
    expect(reads).toBe(3);
    expect(posts).toEqual([{ recipientUserId, expectedRevision: 0, wasSent: false }]);
  });

  it("withdraws readable values, private workflow reasons and PDF metadata when review recovery GET is forbidden", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    const privateReason = "Private recovery reason";
    const privateDocument = "Private recovery.pdf";
    const payload: ResponseWorkflow = { ...uncertainWorkflow(runId), recordState: "Approved", actions: [{ ...uncertainWorkflow(runId).actions[0], reason: privateReason }], documents: [{ id: crypto.randomUUID(), runId, name: privateDocument, culture: "es", size: 123, createdAtUtc: "2026-10-17T12:00:00Z" }] };
    let denied = false;
    let reads = 0;
    let writes = 0;
    server.use(http.get("/api/forms/records/:id/workflow", () => { reads++; return denied ? HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 }) : HttpResponse.json(payload); }),
      http.post("/api/forms/records/:id/actions/:runId/review", () => { denied = true; writes++; return HttpResponse.error(); }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    await responseView.findByText("Texto completo para revisar");
    await openResponseTab("PDF");
    await responseView.findByText(privateDocument);
    const activity = await openResponseActivity();
    await userEvent.click(await activity.findByRole("button", { name: "Resolver envío" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("radio", { name: "Salió" }));
    await userEvent.click(dialog.getByRole("button", { name: "Confirmar que salió" }));
    await screen.findByRole("heading", { name: /permiso/i });
    expect(reads).toBe(2);
    expect(writes).toBe(1);
    expect(screen.queryByText("Texto completo para revisar")).not.toBeInTheDocument();
    expect(screen.queryByText(privateReason)).not.toBeInTheDocument();
    expect(screen.queryByText(privateDocument)).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(notify).not.toHaveBeenCalled();
    await waitFor(() => expect(queryClient.getQueryCache().getAll().some(query => { const data = JSON.stringify(query.state.data) ?? ""; return data.includes(privateReason) || data.includes(privateDocument); })).toBe(false));
  });

  it("checks a pending review after closing and reopening its dialog without requiring another decision", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    let reads = 0;
    let writes = 0;
    server.use(http.get("/api/forms/records/:id/workflow", () => { reads++; return reads === 2 ? HttpResponse.error() : HttpResponse.json(uncertainWorkflow(runId)); }),
      http.post("/api/forms/records/:id/actions/:runId/review", () => { writes++; return HttpResponse.error(); }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    const open = await activity.findByRole("button", { name: "Resolver envío" });
    await userEvent.click(open);
    let dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("radio", { name: "Salió" }));
    await userEvent.click(dialog.getByRole("button", { name: "Confirmar que salió" }));
    await dialog.findByRole("button", { name: "Consultar" });
    await userEvent.click(dialog.getByRole("button", { name: "Cancelar" }));
    await userEvent.click(open);
    dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("button", { name: "Consultar" }));
    await dialog.findByRole("button", { name: "Confirmar revisión" });
    expect(reads).toBe(3);
    expect(writes).toBe(1);
    expect(dialog.getByRole("radio", { name: "Salió" })).toBeEnabled();
  });

  it("shows terminal role deliveries including an unavailable member without offering a partial retry", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    const accepted = recipientFixture({ state: "Accepted", canReview: false });
    const failed = recipientFixture({ user: { userId: crypto.randomUUID(), displayName: "Pedro" }, state: "Failed", canReview: false, reasonCode: "WhatsApp.Chat.NoPhone", reason: "Pedro no tiene WhatsApp." });
    const payload = roleWorkflow(runId, [accepted, failed], "Completed");
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(payload)));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    const history = activity;
    await history.findByText("Pedro no tiene WhatsApp.");
    expect(history.getByText("Juan")).toBeInTheDocument();
    expect(history.getByText("Pedro")).toBeInTheDocument();
    expect(history.getByText("Enviado")).toBeInTheDocument();
    expect(history.getByText("No se pudo enviar")).toBeInTheDocument();
    expect(history.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(history.queryByRole("button", { name: "Resolver envío" })).not.toBeInTheDocument();
  });
  it("shows a completed role with its only member failed when no channel is installed", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const failed = { ...recipientFixture({ state: "Failed", canReview: false, reasonCode: "Forms.Action.ChannelUnavailable", reason: "No hay un canal disponible para avisarle." }), channelId: null };
    const payload = roleWorkflow(crypto.randomUUID(), [failed], "Completed");
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(payload)));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    const history = activity;
    await history.findByText("No hay un canal disponible para avisarle.");
    expect(history.getByText("Juan")).toBeInTheDocument();
    expect(history.getByText("Hecho")).toBeInTheDocument();
    expect(history.getByText("No se pudo enviar")).toBeInTheDocument();
    expect(history.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(history.queryByRole("button", { name: "Resolver envío" })).not.toBeInTheDocument();
  });
  it.each([true, false])("reviews only the uncertain role recipient wasSent=%s and preserves accepted members", async wasSent => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    const targetUserId = crypto.randomUUID();
    const accepted = recipientFixture({ state: "Accepted", canReview: false });
    const pending = recipientFixture({ user: { userId: targetUserId, displayName: "Pedro" } });
    let payload = roleWorkflow(runId, [accepted, pending]);
    const posts: unknown[] = [];
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(payload)),
      http.post("/api/forms/records/:id/actions/:runId/review", async ({ request }) => {
        posts.push(await request.json());
        payload = roleWorkflow(runId, [accepted, { ...pending, state: wasSent ? "Accepted" : "Failed", canReview: false, review: { wasSent, reviewedAtUtc: "2026-10-17T13:00:00Z", reviewedBy: { userId: currentUser.id, displayName: "Luz" } } }], "Completed");
        return HttpResponse.json(payload, { status: 202 });
      }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    await userEvent.click(await activity.findByRole("button", { name: "Resolver envío" }));
    const dialog = within(await screen.findByRole("dialog"));
    expect(dialog.getByText("Destinatario: Pedro")).toBeInTheDocument();
    await userEvent.click(dialog.getByRole("radio", { name: wasSent ? "Salió" : "No salió" }));
    await userEvent.click(dialog.getByRole("button", { name: wasSent ? "Confirmar que salió" : "Confirmar que no salió" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(posts).toEqual([{ recipientUserId: targetUserId, expectedRevision: 3, wasSent }]);
    const evidence = await screen.findByText(wasSent ? "Luz indicó que salió." : "Luz indicó que no salió.");
    await waitFor(() => expect(evidence.closest("li")).toHaveFocus());
    expect(within(screen.getByText("Juan").closest("li")!).queryByText(/Luz indicó/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
  });
  it("keeps the targeted recipient review open when recovery changed only another role member", async () => {
    setup(["formrecords.read", "formrules.manage"]);
    const runId = crypto.randomUUID();
    const target = recipientFixture({ user: { userId: crypto.randomUUID(), displayName: "Pedro" } });
    let payload = roleWorkflow(runId, [recipientFixture({ canReview: false }), target]);
    let reads = 0;
    const posts: unknown[] = [];
    server.use(http.get("/api/forms/records/:id/workflow", () => { reads++; return HttpResponse.json(payload); }),
      http.post("/api/forms/records/:id/actions/:runId/review", async ({ request }) => { posts.push(await request.json()); payload = roleWorkflow(runId, [recipientFixture({ state: "Accepted", canReview: false }), target]); return HttpResponse.error(); }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    await userEvent.click(await activity.findByRole("button", { name: "Resolver envío" }));
    const dialog = within(await screen.findByRole("dialog"));
    await userEvent.click(dialog.getByRole("radio", { name: "No salió" }));
    await userEvent.click(dialog.getByRole("button", { name: "Confirmar que no salió" }));
    await waitFor(() => expect(reads).toBe(2));
    expect(dialog.getByRole("radio", { name: "No salió" })).toBeChecked();
    expect(posts).toEqual([{ recipientUserId: target.user.userId, expectedRevision: 3, wasSent: false }]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("uses the confirmed detail name in breadcrumbs even when navigation has a different name", async () => {
    setup();
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    await screen.findByRole("heading", { name: "TEST-000002" });
    const crumbs = within(screen.getByRole("navigation", { name: "Migas de pan" }));
    expect(crumbs.getByText("Formulario publicado")).toHaveAttribute("aria-current", "page");
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
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    await screen.findByRole("heading", { name: "TEST-000002" });
    await waitFor(() => expect(screen.getByText("20 de 21")).toBeInTheDocument());
    await userEvent.click(responseView.getByRole("button", { name: "Siguiente" }));
    await screen.findByRole("heading", { name: "TEST-000001" });
    await waitFor(() => expect(screen.getByText("21 de 21")).toBeInTheDocument());
    expect(router.state.location.search).toContain("page=2");
    expect(requested).toHaveBeenCalledWith(expect.objectContaining({ page: 2, sort: "field", sortFieldId: fieldId }));
    expect(responseView.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    await userEvent.click(responseView.getByRole("button", { name: "Anterior" }));
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
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    await screen.findByRole("heading", { name: "TEST-000002" });
    expect(responseView.getByText("Texto completo para revisar")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Columnas · 1 oculta" })).toBeInTheDocument();
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
  it("opens the static overview and preserves the shell", async () => {
    setup();
    const requested = vi.fn();
    server.use(http.get("/api/forms/overview", () => { requested(); return HttpResponse.json({ forms: { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false }, filterCounts: { active: 0, deactivated: 0, deactivatedPending: null } }); }));
    renderRouteWithProviders("/perfil");
    await screen.findByRole("heading", { name: "Mi perfil" });
    const shell = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(requested).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "Gestión de formularios" }));
    await userEvent.click(screen.getByRole("link", { name: "Formularios" }));
    await screen.findByRole("heading", { name: "Formularios", level: 1 });
    await waitFor(() => expect(requested).toHaveBeenCalledOnce());
    expect(screen.getByRole("navigation", { name: "Navegación principal" })).toBe(shell);
  });
  it("reports one detail failure when detail and its sheet both fail", async () => {
    setup();
    server.use(http.get("/api/forms/records/:id", () => HttpResponse.json({ detail: "Failed", code: "Test.Failure" }, { status: 500 })), http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json({ detail: "Failed", code: "Test.Failure" }, { status: 500 })));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas/${responseRecordId}`);
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    await responseView.findByRole("heading", { name: "No pudimos cargar las respuestas." });
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(vi.mocked(notify).mock.calls[0][0].action).toBeUndefined();
  });
  it("does not load the overview while another screen is open", async () => {
    setup();
    const requested = vi.fn(); server.use(http.get("/api/forms/overview", () => { requested(); return HttpResponse.json({ code: "Test.Failure" }, { status: 500 }); }));
    renderRouteWithProviders("/perfil");
    await screen.findByRole("heading", { name: "Mi perfil" });
    expect(notify).not.toHaveBeenCalled();
    expect(requested).not.toHaveBeenCalled();
  });
  it.each(["", "?pageSize=20&sort=-number"])("opens the historical detail and returns to its captured sheet (%s)", async initialSearch => {
    setup();
    const path = `/formularios/${responseFormId}/respuestas`;
    const { router } = renderRouteWithProviders(path + initialSearch);
    const firstRow = await screen.findByRole("link", { name: "TEST-000002" });
    await waitFor(() => {
      const linkedLocation = new URL(firstRow.getAttribute("href") ?? "", window.location.href);
      expect(linkedLocation.searchParams.get("pageSize")).toBe("20");
      expect(linkedLocation.search).toBe(router.state.location.search);
    });
    const capturedSearch = router.state.location.search;
    if (initialSearch) expect(capturedSearch).toBe(initialSearch);
    await userEvent.click(firstRow);
    await screen.findByRole("heading", { name: "TEST-000002" });
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    expect(responseView.getByText("Texto completo para revisar")).toBeInTheDocument();
    expect(screen.getByText("1 de 2")).toBeInTheDocument();
    expect(
      responseView.getByRole("link", { name: "Abrir conversación" }),
    ).toHaveAttribute("href", expect.stringContaining("conversacion="));
    await userEvent.click(
      await responseView.findByRole("button", { name: "Siguiente" }),
    );
    await screen.findByRole("heading", { name: "TEST-000001" });
    const back = within(screen.getByRole("region", { name: "Detalle de la respuesta" })).getByRole("button", { name: "Cerrar" });
    await userEvent.click(back);
    await waitFor(() => expect(router.state.location.pathname).toBe(path));
    await screen.findByRole("table");
    const lastRow = screen.getByRole("link", { name: "TEST-000001" });
    await waitFor(() => expect(lastRow).toHaveFocus());
    expect(router.state.location.search).toBe(capturedSearch);
    expect(lastRow.closest("tr")).toHaveAttribute("aria-selected", "true");
    expect(screen.getAllByRole("row", { selected: true })).toEqual([lastRow.closest("tr")]);
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
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    await screen.findByRole("heading", { name: "TEST-000002" });
    const button = responseView.getByRole("button", { name: "Siguiente" });
    await userEvent.click(button);
    await waitFor(() => expect(requested).toHaveBeenCalled());
    expect(screen.getByRole("heading", { name: "TEST-000002" })).toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(screen.getByRole("region", { name: "Detalle de la respuesta" })).toHaveAttribute("aria-busy", "true");
    await act(async () => release?.());
    await screen.findByRole("heading", { name: "TEST-000001" });
    expect(button).toBeDisabled();
    expect(screen.getByRole("region", { name: "Detalle de la respuesta" })).toHaveFocus();
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
  it.each([400, 404])("applies valid filters without offering a count retry after HTTP %s", async status => {
    setup();
    const counts = vi.fn();
    const applied = vi.fn();
    server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => {
      const body = await request.json() as { pageSize: number; conditions?: unknown[] };
      if (body.pageSize === 1) {
        counts(body);
        return HttpResponse.json({ detail: "Count unavailable", code: "Test.Count" }, { status });
      }
      applied(body);
      return HttpResponse.json(responseSheetFixture());
    }));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Desde" }), "12,5");
    await waitFor(() => expect(counts).toHaveBeenCalledWith(expect.objectContaining({
      page: 1, pageSize: 1, conditions: [expect.objectContaining({ operator: "gte", values: ["12.5"] })],
    })));
    await waitFor(() => expect(queryClient.getQueryCache().getAll().find(query => query.queryKey[2] === "count" && query.state.status === "error")).toBeDefined());
    expect(within(dialog).queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    const apply = within(dialog).getByRole("button", { name: "Aplicar filtros" });
    expect(apply).toBeEnabled();
    await userEvent.click(apply);
    await waitFor(() => expect(applied).toHaveBeenCalledWith(expect.objectContaining({
      pageSize: 20, conditions: [expect.objectContaining({ operator: "gte", values: ["12.5"] })],
    })));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it.each(["network", "server"])("retains the filter draft and explicitly retries a %s count failure", async failure => {
    setup();
    let recovered = false;
    const counts = vi.fn();
    server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => {
      const body = await request.json() as { pageSize: number; conditions?: unknown[] };
      if (body.pageSize === 1) {
        counts(body);
        if (!recovered && body.conditions?.length) return failure === "network" ? HttpResponse.error() : HttpResponse.json({ code: "Test.Count", traceId: "count-trace" }, { status: 503 });
      }
      return HttpResponse.json(responseSheetFixture());
    }));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByRole("button", { name: "Ver 2 respuestas" });
    const input = within(dialog).getByRole("textbox", { name: "Desde" });
    await userEvent.type(input, "12,5");
    // La lectura de red conserva los reintentos acotados del QueryClient real.
    if (failure === "network") await waitFor(() => expect(counts.mock.calls.length).toBeGreaterThanOrEqual(3));
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    expect(within(dialog).getByRole("button", { name: "Aplicar filtros" })).toBeEnabled();
    expect(input).toHaveValue("12,5");
    const countBeforeRetry = counts.mock.calls.length;
    recovered = true;
    await userEvent.click(within(dialog).getByRole("button", { name: "Reintentar" }));
    await within(dialog).findByRole("button", { name: "Ver 2 respuestas" });
    expect(counts).toHaveBeenCalledTimes(countBeforeRetry + 1);
    expect(counts).toHaveBeenLastCalledWith(expect.objectContaining({ conditions: [expect.objectContaining({ values: ["12.5"] })] }));
    expect(input).toHaveValue("12,5");
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it("keeps the count wait after dismissing its notice and retries only by click after expiry", async () => {
    setup();
    let recovered = false;
    const counts = vi.fn();
    server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => {
      const body = await request.json() as { pageSize: number };
      if (body.pageSize === 1) {
        counts(body);
        if (!recovered) return HttpResponse.json({ code: "Test.Wait", detail: "Wait before counting", retryAfter: 1 }, { status: 429 });
      }
      return HttpResponse.json(responseSheetFixture());
    }));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    const retry = within(dialog).getByRole("button", { name: "Reintentar" });
    expect(retry).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Aplicar filtros" })).toBeEnabled();
    // The wait is the reason of the disabled Retry, not a text above it.
    expect(retry).toHaveAccessibleDescription("Esperá 1 segundo para volver a intentar.");
    expect(within(dialog).getByText("Esperá 1 segundo para volver a intentar.")).not.toBeVisible();
    act(() => dismissNotification(vi.mocked(notify).mock.calls[0][0].id));
    expect(retry).toBeDisabled();
    expect(retry).toHaveAccessibleDescription("Esperá 1 segundo para volver a intentar.");
    // When the wait ends, Retry is drawn again without its reason.
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Reintentar" })).toBeEnabled());
    expect(counts).toHaveBeenCalledTimes(1);
    recovered = true;
    await userEvent.click(within(dialog).getByRole("button", { name: "Reintentar" }));
    await within(dialog).findByRole("button", { name: "Ver 2 respuestas" });
    expect(counts).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it.each(["apply", "retry"])("can %s an edited valid filter while the count remains paused by HTTP 429", async recovery => {
    setup();
    let recovered = false;
    const counts = vi.fn();
    const applied = vi.fn();
    server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => {
      const body = await request.json() as { pageSize: number };
      if (body.pageSize === 1) {
        counts(body);
        if (!recovered) return HttpResponse.json({ code: "Test.Wait", detail: "Wait before counting", retryAfter: recovery === "retry" ? 1 : 60 }, { status: 429 });
      }
      applied(body);
      return HttpResponse.json(responseSheetFixture());
    }));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Desde" }), "12,5");
    const apply = within(dialog).getByRole("button", { name: "Aplicar filtros" });
    expect(apply).toBeDisabled();
    await waitFor(() => expect(apply).toBeEnabled());
    if (recovery === "apply") expect(within(dialog).getByRole("button", { name: "Reintentar" })).toHaveAccessibleDescription(/^Esperá [0-9]+ segundos para volver a intentar\.$/);
    expect(counts).toHaveBeenCalledTimes(1);
    if (recovery === "retry") {
      const retry = () => within(dialog).getByRole("button", { name: "Reintentar" });
      await waitFor(() => expect(retry()).toBeEnabled());
      expect(counts).toHaveBeenCalledTimes(1);
      recovered = true;
      await userEvent.click(retry());
      await within(dialog).findByRole("button", { name: "Ver 2 respuestas" });
      expect(counts).toHaveBeenCalledTimes(2);
      expect(counts).toHaveBeenLastCalledWith(expect.objectContaining({ conditions: [expect.objectContaining({ values: ["12.5"] })] }));
      return;
    }
    await userEvent.click(apply);
    await waitFor(() => expect(applied).toHaveBeenCalledWith(expect.objectContaining({
      pageSize: 20, conditions: [expect.objectContaining({ operator: "gte", values: ["12.5"] })],
    })));
    expect(counts).toHaveBeenCalledTimes(1);
  });
  it("withdraws records and count recovery after the count read returns HTTP 403", async () => {
    setup();
    server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => {
      const body = await request.json() as { pageSize: number };
      return body.pageSize === 1
        ? HttpResponse.json({ code: "Forms.Record.Forbidden" }, { status: 403 })
        : HttpResponse.json(responseSheetFixture());
    }));
    renderRouteWithProviders(`/formularios/${responseFormId}/respuestas`);
    await screen.findByRole("table");
    await userEvent.click(screen.getByRole("button", { name: "Más filtros" }));
    await screen.findByRole("heading", { name: /permiso/i });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(screen.queryByText("TEST-000002")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
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
      // The wait of the facet is the reason of its disabled Reintentar (and of the answer state), not a text in its region.
      const actor = within(dialog).getByRole("region", { name: "Cargó" });
      const wait = /^Esperá [0-9]+ segundos para volver a intentar\.$/;
      expect(within(actor).getByRole("button", { name: "Reintentar" })).toBeDisabled();
      expect(within(actor).getByRole("button", { name: "Reintentar" })).toHaveAccessibleDescription(wait);
      expect(within(actor).queryByRole("status")).not.toBeInTheDocument();
      const state = within(dialog).getAllByRole("combobox", { name: "Respuesta" })[0];
      expect(state).toBeDisabled();
      expect(state).toHaveAccessibleDescription(wait);
      for (const text of within(dialog).getAllByText(wait)) expect(text).not.toBeVisible();
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
    expect(within(dialog).getByRole("button", { name: "Exportar a Excel" })).toHaveAccessibleDescription(/^Esperá [0-9]+ segundos para volver a intentar\.$/);
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

it("keeps one workflow read notification in the detail without repeating its cause in history", async () => {
  setup(["formrecords.read", "formrules.manage"]);
  server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json({ code: "Test.Workflow", detail: "No pudimos leer este seguimiento." }, { status: 400 })));
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  expect(vi.mocked(notify).mock.calls[0][0]).toMatchObject({ kind: "error", message: "No pudimos leer este seguimiento." });
  const history = activity;
  expect(history.queryByText("No pudimos leer este seguimiento.")).not.toBeInTheDocument();
  expect(history.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
});

  it.each(["Approved", "Rejected"] as const)("keeps the same detail decision panel and focuses its confirmed %s result", async decision => {
    const { fixture } = setupDetailDecision();
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
    const summaryElement = (await responseView.findByText("Supervisión")).closest("[tabindex='-1']")!;
    const controls = within(summaryElement as HTMLElement);
    const actions = within(panel);
    await actions.findByRole("button", { name: "Aprobar" });
    if (decision === "Rejected") {
      await userEvent.click(actions.getByRole("button", { name: "Rechazar" }));
      const reject = within(await screen.findByRole("dialog", { name: "Rechazar TEST-000002" }));
      await userEvent.type(reject.getByRole("textbox", { name: /Motivo/ }), "Revisá la firma");
      await userEvent.click(reject.getByRole("button", { name: "Rechazar" }));
    } else await userEvent.click(actions.getByRole("button", { name: "Aprobar" }));
    await waitFor(() => expect(fixture.workflowReads).toBe(2));
    expect(panel).toBeInTheDocument();
    expect(within(summaryElement.closest("li")!).getByRole("heading", { name: decision === "Approved" ? "Aprobada" : "Rechazada", level: 3 })).toBeInTheDocument();
    const summary = controls.getByText("Supervisión").closest("[tabindex='-1']");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(summary).toHaveAccessibleName(decision === "Approved" ? "Aprobada" : "Rechazada");
    expect(controls.getByText(/Luz/)).toBeInTheDocument();
    expect(controls.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    expect(fixture.writes).toEqual([{ expectedRevision: 1, decision, ...(decision === "Rejected" ? { reason: "Revisá la firma" } : {}) }]);
    expect(notify).toHaveBeenCalledOnce();
    expect(vi.mocked(notify).mock.calls[0][0]).toMatchObject({ kind: "success", message: decision === "Approved" ? "Respuesta aprobada." : "Respuesta rechazada." });
  });
  it("keeps a conflicting detail decision visible and focuses the authoritative result after one rejection attempt", async () => {
    const { fixture, complete } = setupDetailDecision();
    server.use(http.post("/api/forms/approvals/:id/decisions", async ({ request }) => { fixture.writes.push(await request.json()); complete("Rejected", "Rocío", "La visita ya fue evaluada."); return HttpResponse.json({ code: "Forms.Approval.RevisionConflict", detail: "Otra persona ya decidió." }, { status: 409 }); }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
    await userEvent.click(await screen.findByRole("button", { name: "Rechazar" }));
    const reject = within(await screen.findByRole("dialog", { name: "Rechazar TEST-000002" }));
    await userEvent.type(reject.getByRole("textbox", { name: /Motivo/ }), "Mi motivo sin confirmar");
    await userEvent.click(reject.getByRole("button", { name: "Rechazar" }));
    await waitFor(() => expect(fixture.workflowReads).toBe(2));
    expect(panel).toBeInTheDocument();
    const result = within((await responseView.findByText("Supervisión")).closest("[tabindex='-1']")! as HTMLElement);
    expect(await result.findByText(/Rocío/)).toBeInTheDocument();
    expect(result.getByText("La visita ya fue evaluada.")).toBeInTheDocument();
    expect(result.getByText("La aprobación cambió. Se actualizó con la decisión vigente.")).toBeInTheDocument();
    await waitFor(() => expect(result.getByText("Supervisión").closest("[tabindex='-1']")).toHaveFocus());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fixture.writes).toEqual([{ expectedRevision: 1, decision: "Rejected", reason: "Mi motivo sin confirmar" }]);
    expect(notify).toHaveBeenCalledOnce();
    expect(vi.mocked(notify).mock.calls[0][0]).toMatchObject({ kind: "error", message: "Otra persona ya decidió." });
  });
  it("retains the detail rejection reason and its panel after a network failure without another POST", async () => {
    const { fixture } = setupDetailDecision();
    server.use(http.post("/api/forms/approvals/:id/decisions", async ({ request }) => { fixture.writes.push(await request.json()); return HttpResponse.error(); }));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
    await userEvent.click(await screen.findByRole("button", { name: "Rechazar" }));
    const reject = within(await screen.findByRole("dialog", { name: "Rechazar TEST-000002" }));
    await userEvent.type(reject.getByRole("textbox", { name: /Motivo/ }), "Mi motivo conservado");
    await userEvent.click(reject.getByRole("button", { name: "Rechazar" }));
    await waitFor(() => expect(notify).toHaveBeenCalledOnce());
    expect(panel).toBeInTheDocument();
    expect(reject.getByRole("textbox", { name: /Motivo/ })).toHaveValue("Mi motivo conservado");
    expect(reject.getByRole("button", { name: "Rechazar" })).toBeEnabled();
    expect(fixture.task.state).toBe("Open");
    expect(fixture.writes).toEqual([{ expectedRevision: 1, decision: "Rejected", reason: "Mi motivo conservado" }]);
    expect(screen.queryByText("Respuesta rechazada.")).not.toBeInTheDocument();
  });

  it("keeps one decision owner in its approval moment and preserves the resolved status", async () => {
    const { fixture } = setupDetailDecision();
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    const title = await screen.findByRole("heading", { name: "TEST-000002", level: 2 });
    const header = within((await responseView.findByText("Supervisión")).closest("li")!);
    expect(await header.findByRole("heading", { name: "Por aprobar", level: 3 })).toBeInTheDocument();
    await header.findByRole("button", { name: "Aprobar" });
    expect(header.getAllByText("Por aprobar")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Aprobar" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Rechazar" })).toHaveLength(1);
    const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
    expect(within(title.closest("header")!).queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    await userEvent.click(header.getByRole("button", { name: "Aprobar" }));
    await header.findByRole("heading", { name: "Aprobada", level: 3 });
    expect(header.queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    await waitFor(() => expect(within(panel).getByText("Supervisión").closest("[tabindex='-1']")).toHaveFocus());
    expect(fixture.writes).toEqual([{ expectedRevision: 1, decision: "Approved" }]);
  });
  it("keeps the confirmed moment and header status when the workflow refresh fails after approval", async () => {
    setupDetailDecision();
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const panel = await screen.findByRole("region", { name: "Detalle de la respuesta" });
    const approve = await within(panel).findByRole("button", { name: "Aprobar" });
    const moment = within(panel).getByText("Supervisión").closest("li")!;
    expect(moment).toHaveAttribute("data-moment-state", "pending");
    const previous = structuredClone(queryClient.getQueryCache().findAll({ predicate: query => query.queryKey[0] === "form-responses" && query.queryKey[2] === "workflow" })[0].state.data) as ResponseWorkflow;
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let reads = 0;
    server.use(http.get("/api/forms/records/:id/workflow", async () => {
      reads++;
      if (reads === 1) { await gate; return HttpResponse.json(previous); }
      return HttpResponse.json({ code: "General.Unexpected", traceId: "moment-refresh" }, { status: 500 });
    }));
    await act(async () => { void queryClient.invalidateQueries({ predicate: query => query.queryKey[0] === "form-responses" && query.queryKey[2] === "workflow" }); });
    await waitFor(() => expect(reads).toBe(1));
    await userEvent.click(approve);
    await within(moment).findByRole("heading", { name: "Aprobada", level: 3 });
    await waitFor(() => expect(reads).toBe(2));
    await act(async () => release?.());
    await waitFor(() => expect(moment).toHaveAttribute("data-moment-state", "completed"));
    const title = within(panel).getByRole("heading", { name: "TEST-000002" });
    expect(within(title.closest("header")!).getByText("Aprobada")).toHaveAttribute("data-variant", "success");
    expect(within(moment).queryByRole("button", { name: "Aprobar" })).not.toBeInTheDocument();
    expect(within(moment).getByText(/Luz/)).toBeInTheDocument();
    expect(within(panel).queryByRole("heading", { name: "Al aprobarla" })).not.toBeInTheDocument();
  });
  it("does not revive a private workflow or refresh after closing during decision observation", async () => {
    const { fixture } = setupDetailDecision();
    const { router } = renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const approve = await screen.findByRole("button", { name: "Aprobar" });
    let release: (() => void) | undefined;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let observing = false;
    const original = queryClient.cancelQueries.bind(queryClient);
    const cancellation = vi.spyOn(queryClient, "cancelQueries").mockImplementation((filters, options) => {
      if (filters?.exact && filters.queryKey?.[2] === "workflow") { observing = true; return gate.then(() => original(filters, options)); }
      return original(filters, options);
    });
    try {
      await userEvent.click(approve);
      await waitFor(() => expect(observing).toBe(true));
      await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
      await waitFor(() => expect(router.state.location.pathname).toBe("/formularios/" + responseFormId + "/respuestas"));
      await waitFor(() => expect(queryClient.getQueryCache().findAll({ predicate: query => query.queryKey[0] === "form-responses" && query.queryKey[2] === "workflow" })).toHaveLength(0));
      await act(async () => release?.());
      expect(queryClient.getQueryCache().findAll({ predicate: query => query.queryKey[0] === "form-responses" && query.queryKey[2] === "workflow" })).toHaveLength(0);
      expect(fixture.workflowReads).toBe(1);
    } finally { cancellation.mockRestore(); release?.(); }
  });
  it("keeps an own decision disabled in its approval moment with its reason in the existing panel", async () => {
    const { fixture } = setupDetailDecision();
    fixture.task = { ...fixture.task, canDecide: false, cannotDecideReason: "OwnResponse" };
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const responseView = within(await screen.findByRole("region", { name: "Detalle de la respuesta" }));
    const header = within((await responseView.findByText("Supervisión")).closest("li")!);
    expect(await header.findByRole("button", { name: "Aprobar" })).toBeDisabled();
    expect(header.getByRole("button", { name: "Rechazar" })).toBeDisabled();
    // The reason is the help of each disabled button, not a text under them.
    for (const name of ["Aprobar", "Rechazar"]) expect(header.getByRole("button", { name })).toHaveAccessibleDescription("No podés aprobar ni rechazar tu propia respuesta.");
    expect(fixture.writes).toEqual([]);
  });
  it("groups observed workflow moments with UTC ordered record events and one approval request", async () => {
    setup(["formrecords.read"]);
    const detail = responseDetailFixture();
    detail.history = [
      { kind: "Saved", atUtc: "2026-10-16T12:02:00Z", actor: null },
      { kind: "Sent", atUtc: "2026-10-16T11:59:00Z", actor: detail.actor },
      { kind: "Submitted", atUtc: "2026-10-16T12:00:00Z", actor: detail.actor },
    ];
    const makeAction = (kind: ResponseAction["kind"], atUtc: string): ResponseAction => ({ id: crypto.randomUUID(), ruleId: approvalTaskId, kind, event: kind === "GeneratePdf" ? "Approved" : "Received", order: 0, revision: 0, state: "Completed", reasonCode: null, reason: null, canConsult: false, canRetry: false, recipients: [], createdAtUtc: atUtc, updatedAtUtc: atUtc, completedAtUtc: atUtc });
    const payload: ResponseWorkflow = { ...responseWorkflowFixture(), recordState: "Approved", task: { id: approvalTaskId, roleId: approvalTaskId, roleName: "Supervisión", requestedAtUtc:"2026-10-16T12:03:00Z", revision: 2, state: "Approved", decidedAtUtc: "2026-10-16T12:04:00Z", decidedBy: { userId: currentUser.id, displayName: "Luz" }, reason: null }, actions: [makeAction("GeneratePdf", "2026-10-16T12:05:00Z"), makeAction("NotifyAuthor", "2026-10-16T12:01:00Z"), makeAction("RequestApproval", "2026-10-16T12:03:00Z")] };
    server.use(http.get("/api/forms/records/:id", () => HttpResponse.json(detail)), http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(payload)));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    const history = activity;
    await history.findByText("Armar el PDF");
    const moments = history.getAllByRole("list")[0];
    expect(Array.from(moments.children).map(row => row.getAttribute("aria-label"))).toEqual(["Recibida", "Al recibirla", "Por aprobar → Aprobada", "Al aprobarla"]);
    const received = within(history.getByRole("listitem", { name: "Recibida" }));
    expect(received.getAllByRole("time").map(time => time.getAttribute("datetime"))).toEqual(["2026-10-16T11:59:00Z", "2026-10-16T12:00:00Z", "2026-10-16T12:02:00Z"]);
    expect(history.getAllByRole("time").map(time => time.getAttribute("datetime"))).toEqual(["2026-10-16T11:59:00Z", "2026-10-16T12:00:00Z", "2026-10-16T12:02:00Z", "2026-10-16T12:01:00Z", "2026-10-16T12:03:00Z", "2026-10-16T12:04:00Z", "2026-10-16T12:05:00Z"]);
    expect(history.getAllByText("Se pidió aprobación al rol Supervisión")).toHaveLength(1);
    expect(history.getAllByText("Armar el PDF")).toHaveLength(1);
  });
  it("shows provider receipts separately from human resolution without inventing delivery", async () => {
    setup(["formrecords.read"]);
    const deliveredAtUtc = "2026-10-17T12:05:00Z";
    const readAtUtc = "2026-10-17T12:08:00Z";
    const payload = roleWorkflow(approvalTaskId, [recipientFixture({ state: "Accepted", canReview: false, deliveredAtUtc, readAtUtc }), recipientFixture({ user: { userId: approvalTaskId, displayName: "Ana" }, state: "Accepted", canReview: false, review: { wasSent: true, reviewedAtUtc: "2026-10-17T12:03:00Z", reviewedBy: { userId: currentUser.id, displayName: "Luz" } } })], "Completed");
    server.use(http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(payload)));
    renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas/" + responseRecordId);
    const activity = await openResponseActivity();
    const provider = within(await activity.findByRole("listitem", { name: "Destinatario: Juan" }));
    expect(provider.getByText("Entregado")).toBeInTheDocument();
    expect(provider.getByText("Leído")).toBeInTheDocument();
    expect(provider.getAllByRole("time").map(time => time.getAttribute("datetime"))).toEqual([deliveredAtUtc, readAtUtc]);
    const human = within(activity.getByRole("listitem", { name: "Destinatario: Ana" }));
    expect(human.getByText("Luz indicó que salió.")).toBeInTheDocument();
    expect(human.queryByText("Entregado")).not.toBeInTheDocument();
    expect(human.queryByText("Leído")).not.toBeInTheDocument();
    expect(human.getByText("Revisión humana: no confirma la entrega de WhatsApp.")).toBeInTheDocument();
    expect(activity.getByText("Hecho")).toBeInTheDocument();
  });

});


it("filters multi choices through anyOf while keeping their column unsortable", async () => {
  setup();
  const sheet = responseSheetFixture();
  const single = sheet.columns.find(column => column.type === "choice")!;
  const options = [
    { id: "01990000-0000-7000-8000-000000000911", label: "Frío" },
    { id: "01990000-0000-7000-8000-000000000912", label: "Ruido" },
  ];
  single.type = "multiChoice"; single.label = "Fallas"; single.options = options;
  for (const row of sheet.records.items) {
    const cell = row.cells.find(cell => cell.fieldId === single.fieldId)!;
    cell.type = "multiChoice"; cell.state = "Answered";
    cell.value = [...options].reverse().map(option => ({ choiceId: option.id, label: option.label }));
  }
  const requests: unknown[] = [];
  server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { requests.push(await request.json()); return HttpResponse.json(sheet); }),
    http.post("/api/forms/definitions/:id/records/filter-counts/search", () => HttpResponse.json({
      items: options.map(option => ({ ...option, count: 2 })), page: 1, pageSize: 20, totalCount: 2, totalPages: 1, hasPrevious: false, hasNext: false,
    })));
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas");
  const header = await screen.findByRole("columnheader", { name: "Fallas" });
  expect(within(header).queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getAllByText("Ruido, Frío", { exact: true })).toHaveLength(sheet.records.items.length);
  const trigger = screen.getByRole("button", { name: "Fallas" });
  trigger.focus(); await userEvent.keyboard("{Enter}");
  await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: /Frío/ }));
  await waitFor(() => expect(requests).toContainEqual(expect.objectContaining({ conditions: [{ fieldId: single.fieldId, operator: "anyOf", values: [options[0]!.id] }] })));
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Fallas: alguna de 1" })).toBeInTheDocument();
  expect(await screen.findByText("Fallas: alguna de Frío", { exact: true })).toBeInTheDocument();
  expect(requests.every(body => (body as { sortFieldId?: string }).sortFieldId !== single.fieldId)).toBe(true);
});

it("shows sealed data subcolumns without enabling sorting or requiring catalog permission", async () => {
  setup(["formrecords.read", "formrecords.export"]);
  const sheet = responseSheetFixture(); const question = sheet.columns.find(column => column.type === "choice")!;
  const extra = { fieldId: "01990000-0000-7000-8000-000000000081", key: "tax", label: "CUIT histórico", type: "text" as const, role: "data" as const };
  question.fields = [extra]; const choice = sheet.records.items[0]!.cells.find(cell => cell.type === "choice")!;
  choice.value = { choiceId: "01990000-0000-7000-8000-000000000082", label: "Proveedor histórico", catalogId: "01990000-0000-7000-8000-000000000083", fields: [{ fieldId: extra.fieldId, label: extra.label, type: extra.type, role: extra.role, value: "30-71234567-8" }] };
  const requested = vi.fn(); server.use(http.post("/api/forms/definitions/:id/records/search", async ({ request }) => { requested(await request.json()); return HttpResponse.json(sheet); }));
  renderRouteWithProviders("/formularios/" + responseFormId + "/respuestas");
  const header = await screen.findByRole("columnheader", { name: "Modalidad · CUIT histórico" });
  expect(within(header).queryByRole("button")).not.toBeInTheDocument(); expect(screen.getByText("30-71234567-8")).toBeInTheDocument();
  const before = requested.mock.calls.length; await userEvent.click(header); expect(requested).toHaveBeenCalledTimes(before);
});
