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
function setup(scenario = "forms-lifecycle", permissions = ["formtemplates.read", "formtemplates.manage"]) {
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

it("allows authoritative deletion with an unknown response count and preserves unsaved text on Cancel",async()=>{
 const store=setup();store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{canDelete:true,deletionUnavailableReason:null}));
 renderRouteWithProviders("/formularios/"+fixtureFormId);
 const name=await screen.findByLabelText("Nombre");await userEvent.click(name);await userEvent.paste(" sin guardar");
 const menu=await openEditorMenu();await userEvent.click(within(menu).getByRole("menuitem",{name:/Eliminar/}));
 const dialog=await screen.findByRole("dialog",{name:"Eliminar «Registrar visita»"});
 expect(within(dialog).getByText(/El prefijo queda reservado/)).toBeVisible();
 expect(within(dialog).getByText(/Si llegó a publicarse, sus Flows se deprecan cuando no quedan envíos abiertos/)).toBeVisible();
 expect(store.calls.filter(call=>call.method==="DELETE")).toHaveLength(0);
 await userEvent.click(within(dialog).getByRole("button",{name:"Cancelar"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Acciones del formulario"})).toHaveFocus());
 expect(name).toHaveValue("Registrar visita sin guardar");
 expect(store.definitions.has(fixtureFormId)).toBe(true);
});
it("keeps a failed deletion open with one error notice and preserves its draft",async()=>{
 const store=setup();store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{canDelete:true,deletionUnavailableReason:null}));
 server.use(http.delete("/api/forms/definitions/:id",()=>HttpResponse.json({code:"Test.Delete",detail:"Falló esta eliminación."},{status:500})));
 renderRouteWithProviders("/formularios/"+fixtureFormId);
 const name=await screen.findByLabelText("Nombre");await userEvent.click(name);await userEvent.paste(" sin guardar");
 const menu=await openEditorMenu();await userEvent.click(within(menu).getByRole("menuitem",{name:/Eliminar/}));
 const dialog=await screen.findByRole("dialog",{name:"Eliminar «Registrar visita»"});
 await userEvent.click(within(dialog).getByRole("button",{name:"Eliminar"}));
 await waitFor(()=>expect(vi.mocked(notify).mock.calls.filter(([notice])=>notice.kind==="error")).toHaveLength(1));
 expect(dialog).toBeInTheDocument();expect(name).toHaveValue("Registrar visita sin guardar");
 expect(screen.queryByText("Falló esta eliminación.")).not.toBeInTheDocument();
 expect(within(dialog).getByRole("button",{name:"Eliminar"})).toBeEnabled();
});
it("deletes with the confirmed revision and returns to the list without a dirty-draft prompt",async()=>{
 const store=setup();store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{canDelete:true,deletionUnavailableReason:null}));
 let received:unknown;server.use(http.delete("/api/forms/definitions/:id",async({request})=>{received=await request.clone().json();return store.handle(request);}));
 const {router}=renderRouteWithProviders("/formularios/"+fixtureFormId);
 const name=await screen.findByLabelText("Nombre");await userEvent.click(name);await userEvent.paste(" sin guardar");
 const menu=await openEditorMenu();await userEvent.click(within(menu).getByRole("menuitem",{name:/Eliminar/}));
 const dialog=await screen.findByRole("dialog",{name:"Eliminar «Registrar visita»"});
 await userEvent.click(within(dialog).getByRole("button",{name:"Eliminar"}));
 await waitFor(()=>expect(router.state.location.pathname).toBe("/formularios"));
 expect(received).toEqual({expectedRevision:1});expect(store.definitions.has(fixtureFormId)).toBe(false);
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 expect(queryClient.getQueryCache().getAll().some(query=>query.queryKey.includes("detail")&&query.queryKey.includes(fixtureFormId))).toBe(false);
});
it("removes a deleted row and restores focus to the list search",async()=>{
 const store=setup();store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{canDelete:true,deletionUnavailableReason:null}));
 renderRouteWithProviders("/formularios");
 await userEvent.click(await screen.findByRole("button",{name:"Eliminar Registrar visita"}));
 const dialog=await screen.findByRole("dialog",{name:"Eliminar «Registrar visita»"});
 await userEvent.click(within(dialog).getByRole("button",{name:"Eliminar"}));
 await waitFor(()=>expect(store.definitions.has(fixtureFormId)).toBe(false));
 await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
 expect(screen.queryByRole("link",{name:"Registrar visita"})).not.toBeInTheDocument();
 await waitFor(()=>expect(screen.getByRole("searchbox")).toHaveFocus());
});

it("shows a definitive deleted-form notice after saving against a concurrently removed definition without a recovery loop",async()=>{
 setup();
 server.use(http.put("/api/forms/definitions/:id/draft",()=>HttpResponse.json({code:"Forms.Definition.NotFound",detail:"No se encontró el formulario."},{status:404})));
 renderRouteWithProviders("/formularios/"+fixtureFormId);
 const name=await screen.findByLabelText("Nombre");await userEvent.click(name);await userEvent.paste(" sin guardar");
 await userEvent.click(screen.getByRole("button",{name:"Guardar borrador"}));
 await waitFor(()=>expect(vi.mocked(notify).mock.calls).toContainEqual([expect.objectContaining({kind:"error",message:"El formulario ya fue eliminado. Tus cambios sin guardar se conservan."})]));
 expect(name).toHaveValue("Registrar visita sin guardar");
 expect(screen.getByRole("button",{name:"Guardar borrador"})).toBeDisabled();
 expect(screen.queryByRole("button",{name:"Consultar guardado"})).not.toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"Repetir el mismo intento"})).not.toBeInTheDocument();
});

it.each([
 ["OpenSends","Tiene envíos vigentes o respuestas en proceso."],
 ["PublicationInProgress","Hay una publicación en curso."],
] as const)("explains authoritative deletion refusal %s without treating an unknown count as zero",async(reason,label)=>{
 const store=setup();store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{canDelete:false,deletionUnavailableReason:reason,responseCount:null}));
 renderRouteWithProviders("/formularios/"+fixtureFormId);
 const menu=await openEditorMenu();const action=within(menu).getByRole("menuitem",{name:/Eliminar/});
 expect(action).toHaveAttribute("aria-disabled","true");
 expect(within(menu).getByText(label)).toBeVisible();
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it.each([403,409])("retains the dirty draft and prevents another DELETE after a definitive %s refusal",async status=>{
 const store=setup();store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{canDelete:true}));
 const attempts=vi.fn();
 server.use(http.delete("/api/forms/definitions/:id",()=>{
  attempts();store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{canDelete:false,deletionUnavailableReason:"HasResponses"}));
  return HttpResponse.json({code:status===403?"General.Forbidden":"Forms.Definition.HasResponses",detail:status===403?"No tenés permiso.":"El formulario ya tiene respuestas."},{status});
 }));
 renderRouteWithProviders("/formularios/"+fixtureFormId);
 const name=await screen.findByLabelText("Nombre");await userEvent.click(name);await userEvent.paste(" sin guardar");
 const menu=await openEditorMenu();await userEvent.click(within(menu).getByRole("menuitem",{name:/Eliminar/}));
 const dialog=await screen.findByRole("dialog",{name:"Eliminar «Registrar visita»"});
 await userEvent.click(within(dialog).getByRole("button",{name:"Eliminar"}));
 await waitFor(()=>expect(within(dialog).getByRole("button",{name:"Eliminar"})).toBeDisabled());
 expect(name).toHaveValue("Registrar visita sin guardar");expect(attempts).toHaveBeenCalledOnce();
 if(status===403) expect(within(dialog).getByText("Ya no tenés permiso para eliminar este formulario.")).toBeVisible();
 else {expect(vi.mocked(notify).mock.calls.filter(([notice])=>notice.kind==="error")).toHaveLength(1);expect(screen.queryByText("El formulario ya tiene respuestas.")).not.toBeInTheDocument();}
 await userEvent.click(within(dialog).getByRole("button",{name:"Cancelar"}));
 await waitFor(()=>expect(name).toHaveFocus());
});

for(const publicationOpen of [false,true]) {
 it("hides deletion from editor and list when the server reports responses"+(publicationOpen?" during a publication":""),async()=>{
  const store=setup(publicationOpen?"forms-lifecycle-publishing":"forms-lifecycle",["formtemplates.read","formtemplates.manage","formtemplates.publish"]);
  store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{canDelete:false,responseCount:publicationOpen?null:4,deletionUnavailableReason:publicationOpen?"HasResponses":null,unavailableReason:publicationOpen?"PublicationInProgress":null}));
  const view=renderRouteWithProviders("/formularios/"+fixtureFormId);
  const menu=await openEditorMenu();
  expect(within(menu).queryByRole("menuitem",{name:/Eliminar/})).not.toBeInTheDocument();
  const explanation=within(menu).getByText("Tiene respuestas y no se puede eliminar.");
  expect(explanation).toBeVisible();expect(explanation.closest('[role="menuitem"]')).toBeNull();
  view.unmount();queryClient.clear();
  renderRouteWithProviders("/formularios");
  const table=await screen.findByRole("table");
  expect(within(table).queryByRole("button",{name:/Eliminar/})).not.toBeInTheDocument();
 });
}

it("does not create an empty lifecycle menu for a manager without publish when responses prevent deletion",async()=>{
 const store=setup();store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{canDelete:false,responseCount:null,deletionUnavailableReason:"HasResponses"}));
 renderRouteWithProviders("/formularios/"+fixtureFormId);
 await screen.findByLabelText("Nombre");
 expect(screen.queryByRole("button",{name:"Acciones del formulario"})).not.toBeInTheDocument();
});

for (const source of ["row", "editor"] as const) {
 it("refreshes response navigation after deletion from the " + source, async () => {
  const store=setup("forms-lifecycle",["formtemplates.read","formtemplates.manage","formrecords.read"]);store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{canDelete:true})); const navigation=vi.fn();
  server.use(http.get("/api/forms/navigation",()=>{navigation(); const visible=store.definitions.has(fixtureFormId); return HttpResponse.json({items:visible?[{id:fixtureFormId,name:"Visita en respuestas",prefix:"VIS",versionNumber:1}]:[],page:1,pageSize:4,totalCount:visible?1:0,totalPages:visible?1:0,hasPrevious:false,hasNext:false});}));
  renderRouteWithProviders(source==="row"?"/formularios":"/formularios/"+fixtureFormId);
  await waitFor(()=>expect(navigation).toHaveBeenCalledOnce());
  if(source==="row") await userEvent.click(await screen.findByRole("button",{name:"Eliminar Registrar visita"}));
  else {const menu=await openEditorMenu();await userEvent.click(within(menu).getByRole("menuitem",{name:/Eliminar/}));}
  const dialog=await screen.findByRole("dialog",{name:"Eliminar «Registrar visita»"});await userEvent.click(within(dialog).getByRole("button",{name:"Eliminar"}));
  await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  await waitFor(()=>expect(navigation).toHaveBeenCalledTimes(2));
  const nav=queryClient.getQueryCache().getAll().find(query=>query.queryKey[0]==="form-responses"&&query.queryKey[2]==="navigation");
  expect(nav?.state.data).toMatchObject({items:[],totalCount:0});
 });
}

for(const failure of ["network","500"] as const) it("observes a deleted definition after a lost "+failure+" result before leaving",async()=>{
 const store=setup();store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{canDelete:true}));const writes=vi.fn();
 server.use(http.delete("/api/forms/definitions/:id",async({request})=>{writes();await store.handle(request);return failure==="network"?HttpResponse.error():HttpResponse.json({traceId:"lost-delete"},{status:500});}));
 const {router}=renderRouteWithProviders("/formularios/"+fixtureFormId);const name=await screen.findByLabelText("Nombre");await userEvent.click(name);await userEvent.paste(" sin guardar");const menu=await openEditorMenu();await userEvent.click(within(menu).getByRole("menuitem",{name:/Eliminar/}));const dialog=await screen.findByRole("dialog");await userEvent.click(within(dialog).getByRole("button",{name:"Eliminar"}));
 await waitFor(()=>expect(router.state.location.pathname).toBe("/formularios"));expect(writes).toHaveBeenCalledOnce();expect(screen.queryByRole("dialog")).not.toBeInTheDocument();expect(screen.queryByText("Tenés cambios sin guardar")).not.toBeInTheDocument();
});

for(const readStatus of [403,404] as const) it("does not infer deletion from a recovery GET "+readStatus+" without its typed absence",async()=>{
 const store=setup();store.lifecycles.set(fixtureFormId,fixtureLifecycle(1,{canDelete:true}));let attempted=false;const writes=vi.fn();
 server.use(http.delete("/api/forms/definitions/:id",()=>{attempted=true;writes();return HttpResponse.error();}),http.get("/api/forms/definitions/:id",({request})=>attempted?HttpResponse.json({code:readStatus===403?"General.Forbidden":"Other.NotFound"},{status:readStatus}):store.handle(request)));
 const {router}=renderRouteWithProviders("/formularios/"+fixtureFormId);const menu=await openEditorMenu();await userEvent.click(within(menu).getByRole("menuitem",{name:/Eliminar/}));const dialog=await screen.findByRole("dialog");await userEvent.click(within(dialog).getByRole("button",{name:"Eliminar"}));
 if(readStatus===403) {await screen.findByRole("heading",{name:"No tenés permiso"});expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();} else {await within(dialog).findByText("Cambió la situación del formulario. Cerrá este diálogo y revisalo antes de eliminarlo.");expect(within(dialog).getByRole("button",{name:"Eliminar"})).toBeDisabled();}expect(router.state.location.pathname).toBe("/formularios/"+fixtureFormId);expect(writes).toHaveBeenCalledOnce();expect(vi.mocked(notify).mock.calls.some(([notice])=>notice.kind==="success")).toBe(false);
});
