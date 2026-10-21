import { readFormDetail } from "../api/response";
import { formDetailKey } from "../hooks/useFormQueries";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import { notify } from "@/shared/ui/notifications";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId, fixtureLifecycle } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));
vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn() }));
function setup(scenario = "forms-lifecycle", permissions = ["formtemplates.read", "formtemplates.manage", "formtemplates.publish", "formrecords.read"]) {
 const store = createFormFixtureStore("es", scenario);
 server.use(http.all("/api/forms/*", ({ request }) => store.handle(request)), http.get("/api/me", () => HttpResponse.json({ id: "actor", displayName: "Ana", email: "ana@example.com", emailConfirmed: true, phoneNumber: null, formattedPhoneNumber: null, maskedPhoneNumber: null, phoneNumberConfirmed: false, hasGoogleLogin: false, culture: "es", timeZoneId: "America/Argentina/Buenos_Aires", lastLoginAtUtc: null, roles: [], permissions })));
 return store;
}
async function openEditorMenu() {
 await screen.findByLabelText("Nombre");
 const menu = screen.getByRole("button", { name: "Acciones del formulario" });
 act(() => menu.focus()); await userEvent.keyboard("{Enter}");
 return screen.findByRole("menu");
}
beforeEach(() => { queryClient.clear(); vi.mocked(notify).mockClear(); });
it("reads incoming suggestion impact before deactivating and keeps its unsaved draft at the confirmed revision", async () => {
 const store = setup();
 store.lifecycles.set(fixtureFormId, fixtureLifecycle(1, { responseCount: 24, pendingApprovalCount: 2, nextRecordNumber: "VIS-000025" }));
 renderRouteWithProviders("/formularios/" + fixtureFormId);
 const name = await screen.findByLabelText("Nombre");
 await userEvent.click(name); await userEvent.paste(" sin guardar");
 const menu = await openEditorMenu();
 await userEvent.click(within(menu).getByRole("menuitem", { name: /Dar de baja/ }));
 const dialog = await screen.findByRole("dialog", { name: "Dar de baja «Registrar visita»" });
 expect(await within(dialog).findByText(/Registrar entrega/)).toBeVisible();
 expect(within(dialog).getByText(/24 respuestas/)).toBeVisible();
 expect(store.calls.filter(call => call.method === "POST" && call.path.endsWith("/deactivation"))).toHaveLength(0);
 await userEvent.click(within(dialog).getByRole("button", { name: "Dar de baja" }));
 await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
 expect(screen.getByLabelText("Nombre")).toHaveValue("Registrar visita sin guardar");
 expect(screen.getByText(/Dado de baja por/)).toBeVisible();
 expect(screen.getByRole("button", { name: "Reactivar" })).toBeEnabled();
 await userEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
 await waitFor(() => expect(store.writes).toHaveLength(1));
 expect(store.writes[0]).toMatchObject({ expectedRevision: 2, name: { es: "Registrar visita sin guardar" } });
});
it("keeps the deactivation decision open after a failed POST and reports the cause only once by toast", async () => {
 setup(); server.use(http.post("/api/forms/definitions/:id/deactivation", () => HttpResponse.json({ code: "Test.Save", detail: "Falló esta baja." }, { status: 500 })));
 renderRouteWithProviders("/formularios/" + fixtureFormId);
 const menu = await openEditorMenu(); await userEvent.click(within(menu).getByRole("menuitem", { name: /Dar de baja/ }));
 const dialog = await screen.findByRole("dialog", { name: "Dar de baja «Registrar visita»" });
 await userEvent.click(await within(dialog).findByRole("button", { name: "Dar de baja" }));
 await waitFor(() => expect(vi.mocked(notify).mock.calls.filter(([notice]) => notice.kind === "error")).toHaveLength(1));
 expect(dialog).toBeInTheDocument(); expect(screen.queryByText("Falló esta baja.")).not.toBeInTheDocument();
 expect(within(dialog).getByRole("button", { name: "Dar de baja" })).toBeEnabled();
 expect(screen.getByLabelText("Nombre")).toHaveValue("Registrar visita");
});
it("reactivates through the normal saved draft check and keeps the form deactivated after acceptance", async () => {
 const store = setup("forms-lifecycle-deactivated"); renderRouteWithProviders("/formularios/" + fixtureFormId);
 await screen.findByLabelText("Nombre"); await userEvent.click(screen.getByRole("button", { name: "Reactivar" }));
 const dialog = await screen.findByRole("dialog", { name: "Reactivar «Registrar visita»" });
 await userEvent.click(await within(dialog).findByRole("button", { name: "Reactivar con la versión 2" }));
 await waitFor(() => expect(store.calls.filter(call => call.method === "POST" && call.path.endsWith("/publications"))).toHaveLength(1));
 expect(screen.getByText(/Dado de baja por/)).toBeVisible();
 expect(screen.queryByRole("button", { name: "Dar de baja" })).not.toBeInTheDocument();
 expect(store.calls.filter(call => call.method === "POST" && call.path.endsWith("/deactivation"))).toHaveLength(0);
 await waitFor(()=>expect(screen.getByRole("button",{name:"Acciones del formulario"})).toHaveFocus());
});
it("does not offer deactivation without Publish and preserves an unknown response count", async () => {
 const store=setup("forms-lifecycle", ["formtemplates.read", "formtemplates.manage"]);
 store.lifecycles.set(fixtureFormId, fixtureLifecycle(1, { responseCount: null }));
 renderRouteWithProviders("/formularios"); const table = await screen.findByRole("table");
 expect(within(table).getByRole("columnheader", { name: "Respuestas" })).toBeInTheDocument();
 expect(within(table).queryByRole("button", { name: /Dar de baja/ })).not.toBeInTheDocument();
 expect(within(table).queryByRole("button", { name: /Eliminar/ })).not.toBeInTheDocument();
 const row = within(table).getAllByRole("row")[1]; expect(within(row).getAllByRole("cell")[3]).toHaveTextContent("—");
});

it("returns focus to the editor action menu after cancelling deactivation", async () => {
 setup(); renderRouteWithProviders("/formularios/"+fixtureFormId);
 const menu=await openEditorMenu(); await userEvent.click(within(menu).getByRole("menuitem",{name:/Dar de baja/}));
 const dialog=await screen.findByRole("dialog",{name:"Dar de baja «Registrar visita»"});
 await userEvent.click(within(dialog).getByRole("button",{name:"Cancelar"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Acciones del formulario"})).toHaveFocus());
});
it("opens row reactivation in the existing editor without accepting automatically and retains its uncertain publication", async () => {
 const store=setup("forms-lifecycle-deactivated");
 server.use(http.post("/api/forms/definitions/:id/publications",()=>HttpResponse.error()));
 const {router}=renderRouteWithProviders("/formularios?publicationFilter=Deactivated");
 await userEvent.click(await screen.findByRole("button",{name:"Reactivar Registrar visita"}));
 await waitFor(()=>expect(router.state.location.pathname).toBe("/formularios/"+fixtureFormId));
 const dialog=await screen.findByRole("dialog",{name:"Reactivar «Registrar visita»"});
 expect(store.calls.filter(call=>call.method==="POST"&&call.path.endsWith("/publications"))).toHaveLength(0);
 await waitFor(()=>expect(router.state.location.state).toBeNull());
 await userEvent.click(within(dialog).getByRole("button",{name:"Cancelar"}));
 const primary=screen.getByRole("button",{name:"Reactivar"});
 await waitFor(()=>expect(primary).toHaveFocus());
 await userEvent.click(primary);
 const reopened=await screen.findByRole("dialog",{name:"Reactivar «Registrar visita»"});
 await userEvent.click(await within(reopened).findByRole("button",{name:"Reactivar con la versión 2"}));
 await screen.findByRole("button",{name:"Consultar publicación"});
 expect(screen.getByText(/Dado de baja por/)).toBeVisible();
});

it("waits for the current deactivated detail before consuming a row intent when an active detail was cached",async()=>{
 const store=setup("forms-lifecycle-deactivated");
 const previous=createFormFixtureStore("es","forms-lifecycle");
 const stale=readFormDetail(await(await previous.handle(new Request("http://localhost/api/forms/definitions/"+fixtureFormId))).json());
 queryClient.setQueryData(formDetailKey({actorId:"actor",culture:"es",permissions:["formtemplates.read","formtemplates.manage","formtemplates.publish","formrecords.read"]},fixtureFormId),stale);
 let release!:()=>void;const pending=new Promise<void>(resolve=>{release=resolve;});const requested=vi.fn();
 server.use(http.get("/api/forms/definitions/"+fixtureFormId,async({request})=>{requested();await pending;return store.handle(request);}));
 const {router}=renderRouteWithProviders("/formularios?publicationFilter=Deactivated");
 await userEvent.click(await screen.findByRole("button",{name:"Reactivar Registrar visita"}));
 await waitFor(()=>expect(requested).toHaveBeenCalledOnce());
 expect(router.state.location.state).toEqual({reactivateFormId:fixtureFormId});
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 release();
 await screen.findByRole("dialog",{name:"Reactivar «Registrar visita»"});
 await waitFor(()=>expect(router.state.location.state).toBeNull());
 expect(store.calls.filter(call=>call.method==="POST"&&call.path.endsWith("/publications"))).toHaveLength(0);
});

it("shows the last open send expiry in the profile time zone only when supplied",async()=>{
 const store=setup();store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{lastOpenSessionExpiresAtUtc:"2026-10-21T18:00:00Z"}));
 renderRouteWithProviders("/formularios/"+fixtureFormId);
 const menu=await openEditorMenu();await userEvent.click(within(menu).getByRole("menuitem",{name:/Dar de baja/}));
 const dialog=await screen.findByRole("dialog",{name:"Dar de baja «Registrar visita»"});
 expect(await within(dialog).findByText("El último envío abierto vence el 21 oct 2026, 15:00.")).toBeVisible();
 expect(within(dialog).queryByText("2026-10-21T18:00:00Z")).not.toBeInTheDocument();
});

it.each(["Pending","Uncertain","Deprecated"] as const)("shows authoritative %s in the deactivated list and omits it from active rows",async state=>{
 const store=setup("forms-lifecycle-deactivated");
 store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{deactivatedAtUtc:"2026-10-20T12:00:00Z",deprecationState:state,lastOpenSessionExpiresAtUtc:state==="Pending"?"2026-10-22T18:00:00Z":null,deprecatedAtUtc:state==="Deprecated"?"2026-10-21T18:00:00Z":null}));
 const view=renderRouteWithProviders("/formularios?publicationFilter=Deactivated");
 const table=await screen.findByRole("table");
 expect(within(table).getByText(state==="Pending"?/se deprecan cuando venzan/:state==="Uncertain"?/Sin confirmar en WhatsApp/:/Deprecados el 21 oct 2026, 15:00/)).toBeVisible();
 view.unmount();queryClient.clear();
 store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{deprecationState:state,lastOpenSessionExpiresAtUtc:state==="Pending"?"2026-10-22T18:00:00Z":null,deprecatedAtUtc:state==="Deprecated"?"2026-10-21T18:00:00Z":null}));
 renderRouteWithProviders("/formularios");
 const active=await screen.findByRole("table");
 expect(within(active).queryByText(/se deprecan|Sin confirmar en WhatsApp|Deprecados el/)).not.toBeInTheDocument();
});
it("omits WhatsApp deprecation claims from the impact preview when the channel has no confirmed Flows",async()=>{
 const store=setup();store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{deprecationState:null,deprecatedAtUtc:null,lastOpenSessionExpiresAtUtc:null}));
 renderRouteWithProviders("/formularios/"+fixtureFormId);
 const menu=await openEditorMenu();await userEvent.click(within(menu).getByRole("menuitem",{name:/Dar de baja/}));
 const dialog=await screen.findByRole("dialog",{name:"Dar de baja «Registrar visita»"});
 await within(dialog).findByText(/Registrar entrega/);
 expect(within(dialog).queryByText("Envíos abiertos y WhatsApp")).not.toBeInTheDocument();
 expect(within(dialog).queryByText(/se deprecan sus Flows/)).not.toBeInTheDocument();
});

for (const source of ["row", "editor"] as const) {
 it("refreshes response navigation after deactivation from the " + source, async () => {
  const store=setup(); const navigation=vi.fn();
  server.use(http.get("/api/forms/navigation",()=>{navigation(); const visible=store.definitions.has(fixtureFormId); return HttpResponse.json({items:visible?[{id:fixtureFormId,name:"Visita en respuestas",prefix:"VIS",versionNumber:1}]:[],page:1,pageSize:4,totalCount:visible?1:0,totalPages:visible?1:0,hasPrevious:false,hasNext:false});}));
  renderRouteWithProviders(source==="row"?"/formularios":"/formularios/"+fixtureFormId);
  await waitFor(()=>expect(navigation).toHaveBeenCalledOnce());
  if(source==="row") await userEvent.click(await screen.findByRole("button",{name:"Dar de baja Registrar visita"}));
  else { const menu=await openEditorMenu();await userEvent.click(within(menu).getByRole("menuitem",{name:/Dar de baja/})); }
  const dialog=await screen.findByRole("dialog",{name:"Dar de baja «Registrar visita»"});
  await userEvent.click(await within(dialog).findByRole("button",{name:"Dar de baja"}));
  await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(()=>expect(navigation).toHaveBeenCalledTimes(2));
  const nav=queryClient.getQueryCache().getAll().find(query=>query.queryKey[0]==="form-responses"&&query.queryKey[2]==="navigation");
  expect(nav?.state.data).toMatchObject({items:[{id:fixtureFormId}],totalCount:1});
  if(source==="row") {expect(screen.queryByRole("link",{name:"Registrar visita"})).not.toBeInTheDocument();expect(screen.getByRole("button",{name:"Dados de baja (1)"})).toBeVisible();await waitFor(()=>expect(screen.getByRole("searchbox")).toHaveFocus());}
 });
}
