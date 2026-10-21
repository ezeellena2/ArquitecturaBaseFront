import { notify, dismissNotification } from "@/shared/ui/notifications";
import {screen,waitFor,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {http,HttpResponse} from "msw";
import {beforeEach,expect,it,vi} from "vitest";
import {server} from "@/test/mocks/server";
import {currentUser} from "@/test/mocks/handlers";
import {renderRouteWithProviders} from "@/test/utils/renderWithProviders";
import {queryClient} from "@/shared/api/queryClient";
import {approvalTaskFixture,approvalTaskId} from "@/test/approvalFixtures";
import { responseDetailFixture, responseSheetFixture, responseWorkflowFixture, responseFormId } from "@/test/responseFixtures";
vi.mock("react-oidc-context",async()=>({...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),useAuth:()=>({isAuthenticated:true,isLoading:false,user:{access_token:"test"}})}));
beforeEach(()=>{vi.clearAllMocks();queryClient.clear();});
function setup(permissions=["formapprovals.decide"]) {
 let task=approvalTaskFixture(); const decisions:unknown[]=[];const lists:string[]=[];
 server.use(http.get("/api/me",()=>HttpResponse.json({...currentUser,permissions})),
 http.get("/api/forms/approvals",({request})=>{lists.push(request.url);return HttpResponse.json({items:task.state==="Open"?[task]:[],page:1,pageSize:20,totalCount:task.state==="Open"?1:0,totalPages:1,hasNext:false,hasPrevious:false});}),
 http.get("/api/forms/approvals/options",()=>HttpResponse.json({forms:[{id:task.definitionId,name:task.formName}]})),
 http.get("/api/forms/approvals/count",()=>HttpResponse.json({count:1})),
 http.get("/api/forms/approvals/"+approvalTaskId,()=>HttpResponse.json(task)),
 http.post("/api/forms/approvals/:id/decisions",async({request})=>{const body=await request.json() as {decision:"Approved"|"Rejected";reason?:string};decisions.push(body);task={...task,state:body.decision,revision:2,canDecide:false,cannotDecideReason:"AlreadyDecided",decidedAtUtc:"2026-10-16T13:00:00Z",decidedBy:{userId:currentUser.id,displayName:"Supervisora"},reason:body.reason??null};return HttpResponse.json({taskId:task.id,recordId:task.recordId,revision:task.revision,state:task.state,decidedAtUtc:task.decidedAtUtc,decidedBy:task.decidedBy,reason:task.reason});}));
 return {decisions,lists};
}
it("decides from metadata without fetching record values or PDF",async()=>{const fixture=setup();let reads=0;server.use(http.get("/api/forms/records/:id",()=>{reads++;return HttpResponse.json({});}));renderRouteWithProviders("/formularios/por-aprobar");await userEvent.click(await screen.findByRole("link",{name:"VIS-00001"}));const panel=await screen.findByRole("region",{name:"Detalle de la respuesta"});expect(within(panel).getByText("Supervisión")).toBeInTheDocument();await userEvent.click(within(panel).getByRole("button",{name:"Aprobar"}));await waitFor(()=>expect(fixture.decisions).toEqual([{expectedRevision:1,decision:"Approved"}]));expect(reads).toBe(0);await waitFor(()=>expect(screen.queryByRole("link",{name:"VIS-00001"})).not.toBeInTheDocument());});
it("uses server scopes for mine and all, retaining own tasks as disabled",async()=>{const fixture=setup();renderRouteWithProviders("/formularios/por-aprobar?page=4");await screen.findByRole("link",{name:"VIS-00001"});await userEvent.click(screen.getByRole("button",{name:/Todas abiertas/}));await waitFor(()=>expect(fixture.lists.some(url=>new URL(url).searchParams.get("onlyMine")==="false"&&new URL(url).searchParams.get("page")==="1")).toBe(true));});
it("requires a trimmed rejection reason and sends it once",async()=>{const fixture=setup();renderRouteWithProviders("/formularios/por-aprobar");await userEvent.click(await screen.findByRole("link",{name:"VIS-00001"}));await userEvent.click(screen.getByRole("button",{name:"Rechazar"}));const reject=screen.getByRole("dialog",{name:"Rechazar VIS-00001"});const submit=within(reject).getByRole("button",{name:"Rechazar"});expect(submit).toBeDisabled();await userEvent.type(within(reject).getByRole("textbox",{name:/Motivo/}),"  Revisá la visita  ");await userEvent.click(submit);await waitFor(()=>expect(fixture.decisions).toEqual([{expectedRevision:1,decision:"Rejected",reason:"Revisá la visita"}]));});
it("refreshes a competing decision without sending a second write",async()=>{setup();let writes=0;server.use(http.post("/api/forms/approvals/:id/decisions",()=>{writes++;server.use(http.get("/api/forms/approvals/"+approvalTaskId,()=>HttpResponse.json({...approvalTaskFixture(),state:"Approved",canDecide:false,cannotDecideReason:"AlreadyDecided",revision:2,decidedAtUtc:"2026-10-16T13:00:00Z",decidedBy:{userId:approvalTaskId,displayName:"Otra supervisora"}})));return HttpResponse.json({code:"BusinessForms.Task.RevisionConflict"},{status:409});}));renderRouteWithProviders("/formularios/por-aprobar");await userEvent.click(await screen.findByRole("link",{name:"VIS-00001"}));await userEvent.click(screen.getByRole("button",{name:"Aprobar"}));await screen.findByText(/Otra supervisora/);expect(writes).toBe(1);expect(screen.queryByRole("button",{name:"Aprobar"})).not.toBeInTheDocument();});

it("retains own tasks in All while disabling both decisions",async()=>{setup();server.use(http.get("/api/forms/approvals/"+approvalTaskId,()=>HttpResponse.json({...approvalTaskFixture(),canDecide:false,cannotDecideReason:"OwnResponse"})));renderRouteWithProviders("/formularios/por-aprobar?view=all");await userEvent.click(await screen.findByRole("link",{name:"VIS-00001"}));expect(await screen.findByText("No podés aprobar ni rechazar tu propia respuesta.")).toBeInTheDocument();expect(screen.getByRole("button",{name:"Aprobar"})).toBeDisabled();expect(screen.getByRole("button",{name:"Rechazar"})).toBeDisabled();});
it("withdraws metadata after decision permission is revoked",async()=>{setup();server.use(http.post("/api/forms/approvals/:id/decisions",()=>HttpResponse.json({code:"Authorization.Forbidden"},{status:403})));renderRouteWithProviders("/formularios/por-aprobar");await userEvent.click(await screen.findByRole("link",{name:"VIS-00001"}));await userEvent.click(screen.getByRole("button",{name:"Aprobar"}));await screen.findByText("Ya no tenés permiso para decidir esta aprobación.");expect(within(screen.getByRole("region", { name: "Detalle de la respuesta" })).queryByText("Supervisión")).not.toBeInTheDocument();await waitFor(()=>expect(queryClient.getQueryCache().findAll({predicate:query=>query.queryKey[0]==="form-approvals"&&query.queryKey[2]==="task"})).toHaveLength(0));});
it("loads the approval navigation count only when the Forms panel opens",async()=>{setup();let counts=0;server.use(http.get("/api/forms/approvals/count",()=>{counts++;return HttpResponse.json({count:3});}));renderRouteWithProviders("/perfil");await screen.findByRole("heading",{name:"Mi perfil"});expect(counts).toBe(0);await userEvent.click(await screen.findByRole("button",{name:"Gestión de formularios"}));await screen.findByRole("link",{name:"Formularios (3)"});expect(screen.queryByText("Respuestas")).not.toBeInTheDocument();expect(counts).toBe(1);});
it("keeps the legacy task route reachable without restoring its retired menu link", async () => {
  setup(["formapprovals.decide", "formtemplates.read"]);
  renderRouteWithProviders("/formularios/por-aprobar/" + approvalTaskId);
  await screen.findByRole("region", { name: "Detalle de la respuesta" });
  expect(await screen.findByRole("link", { name: "Formularios (1)" })).toHaveAttribute("href", "/formularios/respuestas");
  expect(screen.queryByRole("link", { name: "Por aprobar (1)" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("navigation", { name: "Gestión de formularios" })).getByRole("link", { name: "Diseñar formularios" })).not.toHaveAttribute("aria-current", "page");
});

vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn(), dismissNotification: vi.fn() }));

it("notifies a rejection failure once without duplicating its cause in the panel or rejection dialog and keeps the reason", async () => {
  setup();
  server.use(http.post("/api/forms/approvals/:id/decisions", () => HttpResponse.json({ code: "Test.Decision", detail: "No pudimos registrar este rechazo." }, { status: 400 })));
  const view = renderRouteWithProviders("/formularios/por-aprobar");
  await userEvent.click(await screen.findByRole("link", { name: "VIS-00001" }));
  await userEvent.click(screen.getByRole("button", { name: "Rechazar" }));
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
it("keeps rejection field feedback beside the reason without a general notice", async () => {
  setup();
  server.use(http.post("/api/forms/approvals/:id/decisions", () => HttpResponse.json({ code: "Validation.Failed", errors: { reason: ["Revisá el motivo del rechazo."] } }, { status: 400 })));
  renderRouteWithProviders("/formularios/por-aprobar");
  await userEvent.click(await screen.findByRole("link", { name: "VIS-00001" }));
  await userEvent.click(screen.getByRole("button", { name: "Rechazar" }));
  const reject = within(screen.getByRole("dialog", { name: "Rechazar VIS-00001" }));
  await userEvent.type(reject.getByRole("textbox", { name: /Motivo/ }), "Motivo válido");
  await userEvent.click(reject.getByRole("button", { name: "Rechazar" }));
  expect(await reject.findByText("Revisá el motivo del rechazo.")).toBeInTheDocument();
  expect(reject.getByRole("textbox", { name: /Motivo/ })).toHaveAttribute("aria-invalid", "true");
  expect(notify).not.toHaveBeenCalled();
});
it.each(["list", "options", "otherCount"])("notifies a failed inbox %s read through one query owner", async operation => {
  setup();
  const failure = () => HttpResponse.json({ code: "Test.Read", detail: "Falló esta lectura de aprobaciones." }, { status: 400 });
  if (operation === "list") server.use(http.get("/api/forms/approvals", failure));
  if (operation === "options") server.use(http.get("/api/forms/approvals/options", failure));
  if (operation === "otherCount") server.use(http.get("/api/forms/approvals/count", ({ request }) => new URL(request.url).searchParams.get("onlyMine") === "false" ? failure() : HttpResponse.json({ count: 1 })));
  renderRouteWithProviders("/formularios/por-aprobar");
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  expect(vi.mocked(notify).mock.calls[0][0]).toMatchObject({ kind: "error", message: "Falló esta lectura de aprobaciones." });
  expect(screen.queryByText("Falló esta lectura de aprobaciones.")).not.toBeInTheDocument();
  if (operation === "list") expect(screen.getByRole("heading", { name: "No pudimos cargar las aprobaciones." })).toBeInTheDocument();
});
it.each(["available", "missing"])("returns from an %s response to the original approval inbox filters", async state => {
  setup(["formapprovals.decide", "formrecords.read"]);
  const task = approvalTaskFixture();
  const origin = `/formularios/por-aprobar?view=all&definitionId=${responseFormId}&page=2&pageSize=20`;
  server.use(
    http.get("/api/forms/navigation", () => HttpResponse.json({ items: [], page: 1, pageSize: 4, totalCount: 0, totalPages: 0, hasPrevious: false, hasNext: false })),
    http.get("/api/forms/approvals", () => HttpResponse.json({ items: [task], page: 2, pageSize: 20, totalCount: 21, totalPages: 2, hasPrevious: true, hasNext: false })),
    http.post("/api/forms/definitions/:id/records/search", () => HttpResponse.json(responseSheetFixture())),
    http.get("/api/forms/records/:id/workflow", () => HttpResponse.json(responseWorkflowFixture())),
    http.get("/api/forms/records/:id", () => state === "missing"
      ? HttpResponse.json({ code: "Forms.Record.NotFound" }, { status: 404 })
      : HttpResponse.json({ ...responseDetailFixture(), number: task.number })),
  );
  const { router } = renderRouteWithProviders(origin);
  await userEvent.click(await screen.findByRole("link", { name: task.number }));
  await waitFor(() => expect(router.state.location.pathname + router.state.location.search).toBe(`/formularios/por-aprobar/${task.id}?view=all&definitionId=${responseFormId}&page=2&pageSize=20`));
  await screen.findByRole("heading", { name: state === "missing" ? "No encontramos esa respuesta o no está disponible" : task.number });
  const panel = within(screen.getByRole("region", { name: "Detalle de la respuesta" }));
  const close = panel.getAllByRole("button", { name: "Cerrar" });
  expect(close).toHaveLength(1);
  await userEvent.click(close[0]);
  await waitFor(() => expect(router.state.location.pathname + router.state.location.search).toBe(origin));
  await screen.findByRole("heading", { name: "Por aprobar" });
  expect(screen.getByRole("button", { name: /Todas abiertas/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("combobox", { name: "Formulario" })).toHaveValue(responseFormId);
});
it("notifies a failed task metadata read without repeating the cause in the decision panel", async () => {
  setup();
  server.use(http.get("/api/forms/approvals/"+approvalTaskId, () => HttpResponse.json({ code: "Test.Read", detail: "No pudimos leer esta tarea." }, { status: 400 })));
  renderRouteWithProviders("/formularios/por-aprobar");
  await userEvent.click(await screen.findByRole("link", { name: "VIS-00001" }));
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  expect(screen.queryByText("No pudimos leer esta tarea.")).not.toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Detalle de la respuesta" })).getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
});
