import {act,screen,waitFor,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {http,HttpResponse} from "msw";
import {beforeEach,expect,it,vi} from "vitest";
import {queryClient} from "@/shared/api/queryClient";
import {renderRouteWithProviders} from "@/test/utils/renderWithProviders";
import {server} from "@/test/mocks/server";
import {createFormFixtureStore} from "@/test/visual/formFixtures";
import {notify} from "@/shared/ui/notifications";
vi.mock("react-oidc-context",async()=>({...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),useAuth:()=>({isAuthenticated:true,isLoading:false,user:{access_token:"test"}})}));
vi.mock("@/shared/ui/notifications",async()=>({...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"),notify:vi.fn()}));
const id="11111111-1111-4111-8111-111111111111";
const topic={id,revision:2,name:"Reclamos de clientes",description:"Dejar asentado qué pasó y qué pide.",originalCulture:"es",requestCount:5,personCount:3,lastRequestedAtUtc:"2026-10-17T12:00:00Z",state:"Pending",discardedBy:null,discardedAtUtc:null};
const page=(items:unknown[]=[topic],extra:Record<string,unknown>={})=>({items,page:1,pageSize:20,totalCount:items.length,totalRequests:5,stateCounts:{pending:1,discarded:0},totalPages:items.length?1:0,hasPrevious:false,hasNext:false,...extra});
function setup(permissions=["formtemplates.manage"]){
 const store=createFormFixtureStore("es","");
 server.use(http.all("/api/forms/definitions*",({request})=>store.handle(request)),http.get("/api/forms/missing-requests",()=>HttpResponse.json(page())),http.get("/api/me",()=>HttpResponse.json({id:"actor",displayName:"Ana",email:"ana@example.com",emailConfirmed:true,phoneNumber:null,formattedPhoneNumber:null,maskedPhoneNumber:null,phoneNumberConfirmed:false,hasGoogleLogin:false,culture:"es",timeZoneId:"America/Argentina/Buenos_Aires",lastLoginAtUtc:null,roles:[],permissions})));
 return store;
}
beforeEach(()=>{queryClient.clear();vi.mocked(notify).mockClear();});
it("reads and discards aggregate requests with Manage only, while Create still requires template Read",async()=>{
 setup();let body:unknown;
 server.use(http.post("/api/forms/missing-requests/:id/discard",async({request})=>{body=await request.json();return HttpResponse.json({...topic,revision:3,state:"Discarded",discardedBy:{userId:id,displayName:"Ana"},discardedAtUtc:"2026-10-17T13:00:00Z"});}));
 renderRouteWithProviders("/formularios/faltantes");
 await screen.findByText(topic.name);expect(screen.getByText(topic.description)).toBeInTheDocument();expect(screen.queryByRole("link",{name:/Crear formulario/})).not.toBeInTheDocument();
 await userEvent.click(screen.getByRole("button",{name:"Descartar Reclamos de clientes"}));
 const dialog=await screen.findByRole("dialog",{name:"Descartar pedido"});await userEvent.click(within(dialog).getByRole("button",{name:"Descartar"}));
 await waitFor(()=>expect(body).toEqual({expectedRevision:2}));expect(vi.mocked(notify).mock.calls.filter(([notice])=>notice.kind==="success")).toHaveLength(1);
});
it("keeps search/state on discard conflict, refreshes the server revision and never repeats POST automatically",async()=>{
 setup();let reads=0;let posts=0;const params:URLSearchParams[]=[];
 server.use(http.get("/api/forms/missing-requests",({request})=>{reads++;params.push(new URL(request.url).searchParams);return HttpResponse.json(page([{...topic,revision:reads+1}]));}),http.post("/api/forms/missing-requests/:id/discard",()=>{posts++;return HttpResponse.json({code:"Forms.MissingRequest.RevisionConflict",detail:"El pedido cambió."},{status:409});}));
 const {router}=renderRouteWithProviders("/formularios/faltantes?search=reclamo&state=Pending&pageSize=10");
 await screen.findByText(topic.name);await userEvent.click(screen.getByRole("button",{name:"Descartar Reclamos de clientes"}));await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button",{name:"Descartar"}));
 await waitFor(()=>expect(reads).toBe(2));expect(posts).toBe(1);expect(router.state.location.search).toContain("search=reclamo");expect(screen.getByRole("searchbox",{name:"Buscar por tema"})).toHaveValue("reclamo");expect(params[0]?.get("pageSize")).toBe("10");
 expect(vi.mocked(notify).mock.calls.filter(([notice])=>notice.kind==="warning")).toHaveLength(1);
});
it("opens a normal new form seeded by the actor-owned original topic name without resolving the topic",async()=>{
 setup(["formtemplates.manage","formtemplates.read"]);let posts=0;server.use(http.post("/api/forms/missing-requests/:id/discard",()=>{posts++;return HttpResponse.error();}));
 const {router}=renderRouteWithProviders("/formularios/faltantes");await screen.findByText(topic.name);
 expect(screen.getByRole("link",{name:"Diseñar formularios"})).not.toHaveAttribute("aria-current","page");
 expect(screen.getByRole("link",{name:"Formularios que faltan"})).toHaveAttribute("aria-current","page");
 await userEvent.click(screen.getByRole("link",{name:"Crear formulario Reclamos de clientes"}));
 expect(await screen.findByLabelText("Nombre")).toHaveValue(topic.name);expect(router.state.location.pathname).toBe("/formularios/nuevo");expect(router.state.location.search).toBe("");expect(posts).toBe(0);
 await userEvent.click(screen.getByRole("button",{name:/English/}));expect(screen.getByLabelText("Nombre")).toHaveValue("");
});
it("uses server discarded counts and history, without claiming that no one has ever asked for a form",async()=>{
 setup();const queries:URLSearchParams[]=[];
 server.use(http.get("/api/forms/missing-requests",({request})=>{const q=new URL(request.url).searchParams;queries.push(q);return HttpResponse.json(q.get("state")==="Discarded"?page([{...topic,state:"Discarded",discardedBy:{userId:id,displayName:"Ana"},discardedAtUtc:"2026-10-17T13:00:00Z"}],{stateCounts:{pending:0,discarded:1}}):page([],{stateCounts:{pending:0,discarded:1}}));}));
 renderRouteWithProviders("/formularios/faltantes");const discarded=await screen.findByRole("button",{name:"Descartados (1)"});expect(screen.queryByText("Nadie pidió formularios que no existen")).not.toBeInTheDocument();await userEvent.click(discarded);
 await screen.findByText(topic.name);expect(screen.getByText(/Descartado por Ana/)).toBeInTheDocument();expect(queries.at(-1)?.get("state")).toBe("Discarded");expect(screen.queryByRole("button",{name:"Descartar Reclamos de clientes"})).not.toBeInTheDocument();
});
it("withdraws observed private rows and queries immediately after a server 403",async()=>{
 setup();const {router}=renderRouteWithProviders("/formularios/faltantes");await screen.findByText(topic.name);server.use(http.get("/api/forms/missing-requests",()=>HttpResponse.json({code:"Authorization.Forbidden"},{status:403})));
 await act(async()=>{await queryClient.invalidateQueries({queryKey:["form-missing-requests"]});});
 await screen.findByText("No tenés permiso");expect(screen.queryByText(topic.name)).not.toBeInTheDocument();await waitFor(()=>expect(queryClient.getQueryCache().findAll({queryKey:["form-missing-requests"]}).every(q=>q.state.data===undefined)).toBe(true));expect(router.state.location.pathname).toBe("/formularios/faltantes");
});

it("retains local search with one operational notice and explicit recovery on a read failure",async()=>{
 setup();let calls=0;server.use(http.get("/api/forms/missing-requests",()=>{calls++;return calls===1?HttpResponse.json({detail:"No pudimos leer los pedidos ahora."},{status:500}):HttpResponse.json(page());}));
 renderRouteWithProviders("/formularios/faltantes?search=reclamo");
 await screen.findByRole("button",{name:"Reintentar"});expect(screen.getByRole("searchbox",{name:"Buscar por tema"})).toHaveValue("reclamo");expect(screen.queryByText("No pudimos leer los pedidos ahora.")).not.toBeInTheDocument();expect(vi.mocked(notify).mock.calls.filter(([notice])=>notice.kind==="error")).toHaveLength(1);
 await userEvent.click(screen.getByRole("button",{name:"Reintentar"}));await screen.findByText(topic.name);expect(calls).toBe(2);
});
it("honors discard Retry-After and waits for an explicit new confirmation after the deadline",async()=>{
 setup();let calls=0;let now=100;const clock=vi.spyOn(performance,"now").mockImplementation(()=>now);
 server.use(http.post("/api/forms/missing-requests/:id/discard",()=>{calls++;return calls===1?HttpResponse.json({detail:"Esperá para descartar.",retryAfter:2},{status:429}):HttpResponse.json({...topic,revision:3,state:"Discarded",discardedBy:{userId:id,displayName:"Ana"},discardedAtUtc:"2026-10-17T13:00:00Z"});}));
 renderRouteWithProviders("/formularios/faltantes");await screen.findByText(topic.name);await userEvent.click(screen.getByRole("button",{name:"Descartar Reclamos de clientes"}));await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button",{name:"Descartar"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Descartar Reclamos de clientes"})).toBeDisabled());
 await act(async()=>{now+=3000;document.dispatchEvent(new Event("visibilitychange"));});await waitFor(()=>expect(screen.getByRole("button",{name:"Descartar Reclamos de clientes"})).toBeEnabled());expect(calls).toBe(1);clock.mockRestore();
});
it("does not apply an old actor's discard result or retain its query data",async()=>{
 setup();let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});let started=false;
 server.use(http.post("/api/forms/missing-requests/:id/discard",async()=>{started=true;await gate;return HttpResponse.json({...topic,revision:3,state:"Discarded",discardedBy:{userId:id,displayName:"Ana"},discardedAtUtc:"2026-10-17T13:00:00Z"});}));
 renderRouteWithProviders("/formularios/faltantes");await screen.findByText(topic.name);await userEvent.click(screen.getByRole("button",{name:"Descartar Reclamos de clientes"}));await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button",{name:"Descartar"}));await waitFor(()=>expect(started).toBe(true));
 await act(async()=>{queryClient.setQueryData(["current-user"],(old:Record<string,unknown>|undefined)=>({...old,id:"other",permissions:[]}));});await screen.findByText("No tenés permiso");await act(async()=>release());
 expect(vi.mocked(notify).mock.calls.some(([notice])=>notice.kind==="success")).toBe(false);expect(queryClient.getQueryCache().findAll({queryKey:["form-missing-requests","actor"]})).toHaveLength(0);
});
it("does not replace an already edited new draft with a later navigation seed",async()=>{
 setup(["formtemplates.manage","formtemplates.read"]);
 const {router}=renderRouteWithProviders("/formularios/nuevo",{state:{formSeed:{ownerActorId:"actor",name:"Tema original",originalCulture:"es"}}});
 const name=await screen.findByLabelText("Nombre");await userEvent.type(name," editado");
 await act(async()=>{await router.navigate("/formularios/nuevo",{replace:true,state:{formSeed:{ownerActorId:"actor",name:"Otra semilla",originalCulture:"es"}}});});
 expect(screen.getByLabelText("Nombre")).toHaveValue("Tema original editado");
});

it("recovers a throttled refresh explicitly while retaining the previously loaded rows",async()=>{
 setup();let calls=0;let now=100;const clock=vi.spyOn(performance,"now").mockImplementation(()=>now);
 server.use(http.get("/api/forms/missing-requests",()=>{calls++;return calls===2?HttpResponse.json({detail:"Esperá para consultar.",retryAfter:2},{status:429}):HttpResponse.json(page());}));
 renderRouteWithProviders("/formularios/faltantes");await screen.findByText(topic.name);
 await userEvent.type(screen.getByRole("searchbox",{name:"Buscar por tema"}),"materiales");
 await act(async()=>{await queryClient.invalidateQueries({queryKey:["form-missing-requests"]});});
 const retry=await screen.findByRole("button",{name:"Reintentar"});expect(retry).toBeDisabled();expect(screen.getByText(topic.name)).toBeInTheDocument();
 expect(screen.getByRole("searchbox",{name:"Buscar por tema"})).toBeDisabled();
 expect(screen.getByRole("button",{name:"Descartados (0)"})).toBeDisabled();
 expect(screen.getByRole("button",{name:"Último pedido"})).toBeDisabled();
 expect(screen.getByRole("combobox",{name:"Filas por página"})).toBeDisabled();
 await act(async()=>{await new Promise(resolve=>setTimeout(resolve,350));});expect(calls).toBe(2);
 await act(async()=>{now+=3000;document.dispatchEvent(new Event("visibilitychange"));});await waitFor(()=>expect(retry).toBeEnabled());expect(calls).toBe(2);clock.mockRestore();
 await userEvent.click(retry);await waitFor(()=>expect(calls).toBe(3));
});
