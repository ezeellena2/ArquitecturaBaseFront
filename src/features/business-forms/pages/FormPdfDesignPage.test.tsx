import { notify, dismissNotification } from "@/shared/ui/notifications";
import {screen,waitFor,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {http,HttpResponse} from "msw";
import {beforeEach,expect,it,vi} from "vitest";
import {server} from "@/test/mocks/server";
import {currentUser} from "@/test/mocks/handlers";
import {queryClient} from "@/shared/api/queryClient";
import {renderRouteWithProviders} from "@/test/utils/renderWithProviders";
import {pdfDesignFixture,pdfOptionsFixture} from "@/test/pdfFixtures";
import {responseFormId} from "@/test/responseFixtures";
vi.mock("react-oidc-context",async()=>({...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),useAuth:()=>({isAuthenticated:true,isLoading:false,user:{access_token:"test"}})}));
beforeEach(()=>{vi.clearAllMocks();queryClient.clear();Object.defineProperty(URL,"createObjectURL",{configurable:true,value:vi.fn().mockReturnValue("blob:pdf-test")});Object.defineProperty(URL,"revokeObjectURL",{configurable:true,value:vi.fn()});});
function setup(){const writes:unknown[]=[];server.use(http.get("/api/me",()=>HttpResponse.json({...currentUser,permissions:["formrules.manage"]})),http.get("/api/forms/definitions/:id/pdf-design",()=>HttpResponse.json(pdfDesignFixture())),http.get("/api/forms/definitions/:id/rules/options",()=>HttpResponse.json(pdfOptionsFixture())),http.post("/api/forms/definitions/:id/pdf-design",async({request})=>{const body=await request.json() as {design:unknown};writes.push(body);return HttpResponse.json({...pdfDesignFixture(),id:crypto.randomUUID(),revision:1,design:body.design,createdAtUtc:"2026-10-16T12:00:00Z",author:{userId:responseFormId,displayName:"Ana"}});}));return writes;}
it("saves only the PDF design with original language and photo setting",async()=>{const writes=setup();let drafts=0;server.use(http.put("/api/forms/definitions/:id",()=>{drafts++;return HttpResponse.json({});}));renderRouteWithProviders("/formularios/"+responseFormId+"/pdf");const name=await screen.findByRole("textbox",{name:"Nombre del PDF"});await userEvent.clear(name);await userEvent.type(name,"  Visita aprobada  ");await userEvent.click(screen.getByRole("checkbox",{name:"Incluir las fotos"}));await userEvent.click(screen.getByRole("button",{name:"Guardar diseño"}));await waitFor(()=>expect(writes).toEqual([{expectedRevision:0,design:{...pdfDesignFixture().design,name:{es:"Visita aprobada"},includePhotos:false}}]));expect(drafts).toBe(0);await screen.findByText(/Revisión 1/);});
it("previews in the actual complete language without saving and revokes private bytes on language change",async()=>{const writes=setup();let body:unknown;server.use(http.post("/api/forms/definitions/:id/pdf-design/preview",async({request})=>{body=await request.json();return new HttpResponse(new Uint8Array([37,80,68,70]),{headers:{"content-type":"application/pdf","content-language":"es"}});}));renderRouteWithProviders("/formularios/"+responseFormId+"/pdf");await screen.findByRole("textbox",{name:"Nombre del PDF"});await userEvent.click(screen.getByRole("button",{name:"English"}));await userEvent.click(screen.getByRole("button",{name:"Vista previa"}));const preview=screen.getByRole("region",{name:"Vista previa"});await within(preview).findByText(/usa todo el contenido en Español/);expect(body).toEqual({design:{...pdfDesignFixture().design,name:{es:"Comprobante de visita"}},culture:"en"});expect(writes).toHaveLength(0);const frame=within(preview).getByTitle("Vista previa del PDF");expect(frame).toHaveAttribute("src","blob:pdf-test");expect(frame).not.toHaveAttribute("sandbox");expect(frame).toHaveAttribute("referrerpolicy","no-referrer");const download=within(preview).getByRole("link",{name:"Descargar"});expect(download).toHaveAttribute("href","blob:pdf-test");expect(download).toHaveAttribute("download","El comprobante.pdf");await userEvent.click(screen.getByRole("button",{name:"Español"}));expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:pdf-test");expect(within(preview).queryByRole("link",{name:"Descargar"})).not.toBeInTheDocument();});
it("preserves edits on conflict until the current revision is explicitly adopted",async()=>{setup();let current=pdfDesignFixture();server.use(http.get("/api/forms/definitions/:id/pdf-design",()=>HttpResponse.json(current)),http.post("/api/forms/definitions/:id/pdf-design",()=>{current={...current,revision:2,design:{...current.design,name:{es:"Diseño de otra persona"}}};return HttpResponse.json({code:"Forms.Pdf.RevisionConflict"},{status:409});}));renderRouteWithProviders("/formularios/"+responseFormId+"/pdf");const name=await screen.findByRole("textbox",{name:"Nombre del PDF"});await userEvent.type(name," propio");await userEvent.click(screen.getByRole("button",{name:"Guardar diseño"}));await userEvent.click(await screen.findByRole("button",{name:"Releer"}));expect(name).toHaveValue("Comprobante de visita propio");await userEvent.click(await screen.findByRole("button",{name:"Usar la revisión actual"}));expect(name).toHaveValue("Diseño de otra persona");});
it("removes editor texts and cached snapshots after PDF manage permission is denied",async()=>{setup();server.use(http.post("/api/forms/definitions/:id/pdf-design/preview",()=>new HttpResponse(new Uint8Array([37,80,68,70]),{headers:{"content-type":"application/pdf","content-language":"es"}})),http.post("/api/forms/definitions/:id/pdf-design",()=>HttpResponse.json({code:"Authorization.Forbidden"},{status:403})));renderRouteWithProviders("/formularios/"+responseFormId+"/pdf");const name=await screen.findByRole("textbox",{name:"Nombre del PDF"});await userEvent.type(name," privado");await userEvent.click(screen.getByRole("button",{name:"Vista previa"}));await screen.findByTitle("Vista previa del PDF");await userEvent.click(screen.getByRole("button",{name:"Guardar diseño"}));await screen.findByRole("heading",{name:/permiso/});expect(screen.queryByRole("textbox")).not.toBeInTheDocument();expect(screen.queryByTitle("Vista previa del PDF")).not.toBeInTheDocument();expect(screen.queryByRole("link",{name:"Descargar"})).not.toBeInTheDocument();expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:pdf-test");await waitFor(()=>expect(queryClient.getQueryCache().getAll().some(query=>JSON.stringify(query.state.data)?.includes("Comprobante de visita"))).toBe(false));});

it("keeps a removed selected question available until its new design is saved",async()=>{setup();server.use(http.get("/api/forms/definitions/:id/rules/options",()=>HttpResponse.json({...pdfOptionsFixture(),questions:[]})));renderRouteWithProviders("/formularios/"+responseFormId+"/pdf");const removed=await screen.findByRole("checkbox",{name:"Pregunta retirada"});expect(removed).toBeChecked();await userEvent.click(removed);expect(screen.getByRole("checkbox",{name:"Pregunta retirada"})).not.toBeChecked();});

vi.mock("@/shared/ui/notifications", async () => ({ ...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"), notify: vi.fn(), dismissNotification: vi.fn() }));

it("notifies a design save failure once and preserves fields without an inline general error", async () => {
  setup();
  server.use(http.post("/api/forms/definitions/:id/pdf-design", () => HttpResponse.json({ code: "Test.Save", detail: "No pudimos guardar este diseño." }, { status: 400 })));
  const view = renderRouteWithProviders("/formularios/" + responseFormId + "/pdf");
  const name = await screen.findByRole("textbox", { name: "Nombre del PDF" });
  await userEvent.type(name, " propio");
  await userEvent.click(screen.getByRole("button", { name: "Guardar diseño" }));
  await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  const notice = vi.mocked(notify).mock.calls[0][0];
  expect(notice).toMatchObject({ kind: "error", message: "No pudimos guardar este diseño." });
  expect(screen.queryByText(notice.message)).not.toBeInTheDocument();
  expect(name).toHaveValue("Comprobante de visita propio");
  view.unmount();
  expect(dismissNotification).toHaveBeenCalledWith(notice.id);
});
it("keeps a PDF design field validation next to its field without a general notification", async () => {
  setup();
  server.use(http.post("/api/forms/definitions/:id/pdf-design", () => HttpResponse.json({ code: "Validation.Failed", errors: { "design.name.es": ["Revisá el nombre del PDF."] } }, { status: 400 })));
  renderRouteWithProviders("/formularios/" + responseFormId + "/pdf");
  await screen.findByRole("textbox", { name: "Nombre del PDF" });
  await userEvent.click(screen.getByRole("button", { name: "Guardar diseño" }));
  expect(await screen.findByText("Revisá el nombre del PDF.")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Nombre del PDF" })).toHaveAttribute("aria-invalid", "true");
  expect(notify).not.toHaveBeenCalled();
});

it("names the confirmed form in PDF breadcrumbs without linking a forbidden template", async () => {
  setup();
  renderRouteWithProviders("/formularios/" + responseFormId + "/pdf");
  await screen.findByRole("textbox", { name: "Nombre del PDF" });
  const crumbs = screen.getByRole("navigation", { name: "Migas de pan" });
  expect(within(crumbs).getAllByRole("listitem").map(item => item.textContent)).toEqual(["Inicio", "Visita", "Diseño del PDF"]);
  expect(within(crumbs).queryByRole("link", { name: "Visita" })).not.toBeInTheDocument();
  expect(within(crumbs).getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/"]);
});
