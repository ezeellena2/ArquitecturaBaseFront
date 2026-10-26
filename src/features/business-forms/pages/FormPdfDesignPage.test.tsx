import { notify, dismissNotification } from "@/shared/ui/notifications";
import {act,screen,waitFor,within} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {http,HttpResponse} from "msw";
import {beforeEach,expect,it,vi} from "vitest";
import {server} from "@/test/mocks/server";
import {currentUser} from "@/test/mocks/handlers";
import {queryClient} from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";
import {renderRouteWithProviders} from "@/test/utils/renderWithProviders";
import {pdfDesignFixture,pdfOptionsFixture} from "@/test/pdfFixtures";
import {responseFormId} from "@/test/responseFixtures";
vi.mock("react-oidc-context",async()=>({...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),useAuth:()=>({isAuthenticated:true,isLoading:false,user:{access_token:"test"}})}));
beforeEach(async()=>{vi.clearAllMocks();queryClient.clear();await i18n.changeLanguage("es");Object.defineProperty(URL,"createObjectURL",{configurable:true,value:vi.fn().mockReturnValue("blob:pdf-test")});Object.defineProperty(URL,"revokeObjectURL",{configurable:true,value:vi.fn()});});
function setup(){const writes:unknown[]=[];server.use(http.get("/api/me",()=>HttpResponse.json({...currentUser,permissions:["formrules.manage"]})),http.get("/api/forms/definitions/:id/pdf-design",()=>HttpResponse.json(pdfDesignFixture())),http.get("/api/forms/definitions/:id/rules/options",()=>HttpResponse.json(pdfOptionsFixture())),http.post("/api/forms/definitions/:id/pdf-design",async({request})=>{const body=await request.json() as {design:unknown};writes.push(body);return HttpResponse.json({...pdfDesignFixture(),id:crypto.randomUUID(),revision:1,design:body.design,createdAtUtc:"2026-10-16T12:00:00Z",author:{userId:responseFormId,displayName:"Ana"}});}));return writes;}
it("saves only the PDF design with original language and photo setting",async()=>{const writes=setup();let drafts=0;server.use(http.put("/api/forms/definitions/:id",()=>{drafts++;return HttpResponse.json({});}));renderRouteWithProviders("/formularios/"+responseFormId+"/pdf");const name=await screen.findByRole("textbox",{name:"Nombre del PDF"});await userEvent.clear(name);await userEvent.type(name,"  Visita aprobada  ");await userEvent.click(screen.getByRole("checkbox",{name:"Incluir las fotos"}));await userEvent.click(screen.getByRole("button",{name:"Guardar diseño"}));await waitFor(()=>expect(writes).toEqual([{expectedRevision:0,design:{...pdfDesignFixture().design,name:{es:"Visita aprobada"},includePhotos:false}}]));expect(drafts).toBe(0);await waitFor(()=>expect(screen.getByRole("button",{name:"Guardar diseño"})).toBeDisabled());expect(notify).toHaveBeenCalledWith(expect.objectContaining({kind:"success",message:"Diseño guardado."}));});
// There is no language selector: each text is one field in the menu language, the original is only a reference, and the preview asks for the menu language.
it("edits the PDF texts in the menu language and previews that language without a selector",async()=>{
 const writes=setup();let previewed:unknown;const design={...pdfDesignFixture().design,footer:{es:"Gracias por tu visita."}};
 server.use(http.get("/api/me",()=>HttpResponse.json({...currentUser,culture:"en",permissions:["formrules.manage"]})),http.get("/api/forms/definitions/:id/pdf-design",()=>HttpResponse.json({...pdfDesignFixture(),design})),http.post("/api/forms/definitions/:id/pdf-design/preview",async({request})=>{previewed=await request.json();return new HttpResponse(new Uint8Array([37,80,68,70]),{headers:{"content-type":"application/pdf","content-language":"es"}});}));
 await act(async()=>{await i18n.changeLanguage("en");});
 renderRouteWithProviders("/formularios/"+responseFormId+"/pdf");
 const name=await screen.findByRole("textbox",{name:"PDF name"});
 expect(name).toHaveValue("");expect(name).toHaveAttribute("placeholder","Untranslated");expect(name).toHaveAccessibleDescription("Original (Spanish): Comprobante de visita");expect((name as HTMLInputElement).labels?.[0]).toHaveTextContent(/^PDF name$/);
 const footer=screen.getByRole("textbox",{name:"Footer text"});
 expect(footer).toHaveValue("");expect(footer).toHaveAccessibleDescription("Original (Spanish): Gracias por tu visita.");
 expect(screen.getAllByRole("textbox")).toHaveLength(2);
 expect(screen.queryByRole("group",{name:"Preview language"})).not.toBeInTheDocument();
 expect(screen.queryByRole("button",{name:"English"})).not.toBeInTheDocument();
 await userEvent.type(name,"Visit receipt");
 const preview=screen.getByRole("region",{name:"Preview"});
 await userEvent.click(within(preview).getByRole("button",{name:"Preview"}));
 await within(preview).findByText("English is incomplete. The preview uses all content in Spanish.");
 const translated={...design,name:{es:"Comprobante de visita",en:"Visit receipt"}};
 expect(previewed).toEqual({design:translated,culture:"en"});
 await userEvent.click(screen.getByRole("button",{name:"Save design"}));
 await waitFor(()=>expect(writes).toEqual([{expectedRevision:0,design:translated}]));
});
it("previews in the menu language without saving and revokes private bytes when the menu language changes",async()=>{const writes=setup();let body:unknown;server.use(http.post("/api/forms/definitions/:id/pdf-design/preview",async({request})=>{body=await request.json();return new HttpResponse(new Uint8Array([37,80,68,70]),{headers:{"content-type":"application/pdf","content-language":"es"}});}));renderRouteWithProviders("/formularios/"+responseFormId+"/pdf");await screen.findByRole("textbox",{name:"Nombre del PDF"});await userEvent.click(screen.getByRole("button",{name:"Vista previa"}));const preview=screen.getByRole("region",{name:"Vista previa"});await within(preview).findByText("Contenido en Español");expect(body).toEqual({design:{...pdfDesignFixture().design,name:{es:"Comprobante de visita"}},culture:"es"});expect(writes).toHaveLength(0);const frame=within(preview).getByTitle("Vista previa del PDF");expect(frame).toHaveAttribute("src","blob:pdf-test");expect(frame).not.toHaveAttribute("sandbox");expect(frame).toHaveAttribute("referrerpolicy","no-referrer");const download=within(preview).getByRole("link",{name:"Descargar"});expect(download).toHaveAttribute("href","blob:pdf-test");expect(download).toHaveAttribute("download","El comprobante.pdf");await act(async()=>{await i18n.changeLanguage("en");});expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:pdf-test");await screen.findByRole("textbox",{name:"PDF name"});expect(screen.queryByTitle("PDF preview")).not.toBeInTheDocument();expect(screen.queryByRole("link",{name:"Download"})).not.toBeInTheDocument();});
it("preserves edits on conflict until the current revision is explicitly adopted",async()=>{setup();let current=pdfDesignFixture();server.use(http.get("/api/forms/definitions/:id/pdf-design",()=>HttpResponse.json(current)),http.post("/api/forms/definitions/:id/pdf-design",()=>{current={...current,revision:2,design:{...current.design,name:{es:"Diseño de otra persona"}}};return HttpResponse.json({code:"Forms.Pdf.RevisionConflict"},{status:409});}));renderRouteWithProviders("/formularios/"+responseFormId+"/pdf");const name=await screen.findByRole("textbox",{name:"Nombre del PDF"});await userEvent.type(name," propio");await userEvent.click(screen.getByRole("button",{name:"Guardar diseño"}));
 // Rereading and choosing go in the header of the conflict surface; the disabled Save tells the conflict as its reason.
 const band=(await screen.findByRole("heading",{name:"El diseño cambió"})).parentElement!;
 expect(within(band).getAllByRole("button").map(button=>button.textContent)).toEqual(["Releer"]);
 expect(screen.getByRole("button",{name:"Guardar diseño"})).toBeDisabled();
 expect(screen.getByRole("button",{name:"Guardar diseño"})).toHaveAccessibleDescription("Releé y usá la revisión actual antes de volver a guardar.");
 await userEvent.click(within(band).getByRole("button",{name:"Releer"}));expect(name).toHaveValue("Comprobante de visita propio");
 await waitFor(()=>expect(within(band).getAllByRole("button").map(button=>button.textContent)).toEqual(["Releer","Usar la revisión actual"]));
 await userEvent.click(within(band).getByRole("button",{name:"Usar la revisión actual"}));expect(name).toHaveValue("Diseño de otra persona");});
it("removes editor texts and cached snapshots after PDF manage permission is denied",async()=>{setup();server.use(http.post("/api/forms/definitions/:id/pdf-design/preview",()=>new HttpResponse(new Uint8Array([37,80,68,70]),{headers:{"content-type":"application/pdf","content-language":"es"}})),http.post("/api/forms/definitions/:id/pdf-design",()=>HttpResponse.json({code:"Authorization.Forbidden"},{status:403})));renderRouteWithProviders("/formularios/"+responseFormId+"/pdf");const name=await screen.findByRole("textbox",{name:"Nombre del PDF"});await userEvent.type(name," privado");await userEvent.click(screen.getByRole("button",{name:"Vista previa"}));await screen.findByTitle("Vista previa del PDF");await userEvent.click(screen.getByRole("button",{name:"Guardar diseño"}));await screen.findByRole("heading",{name:/permiso/});expect(screen.queryByRole("textbox")).not.toBeInTheDocument();expect(screen.queryByTitle("Vista previa del PDF")).not.toBeInTheDocument();expect(screen.queryByRole("link",{name:"Descargar"})).not.toBeInTheDocument();expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:pdf-test");await waitFor(()=>expect(queryClient.getQueryCache().getAll().some(query=>JSON.stringify(query.state.data)?.includes("Comprobante de visita"))).toBe(false));});

// Next to the title nothing: the form goes in the breadcrumb, and Page.status only shows a state. No «Cambios sin guardar» nor
// revision numbers: an enabled Save already says there are changes.
// A wait is the reason of the disabled Save, without a text beside it, and the preview is asked from its surface header.
it("keeps revision numbers and save status out of the PDF design",async()=>{
 const writes=setup();
 server.use(http.post("/api/forms/definitions/:id/pdf-design",async({request})=>{const body=await request.json() as {design:unknown};writes.push(body);if(writes.length>1)return HttpResponse.json({code:"RateLimit.Exceeded",detail:"Esperá antes de volver a guardar.",retryAfter:60},{status:429});return HttpResponse.json({...pdfDesignFixture(),id:crypto.randomUUID(),revision:1,design:body.design,createdAtUtc:"2026-10-16T12:00:00Z",author:{userId:responseFormId,displayName:"Ana"}});}));
 renderRouteWithProviders("/formularios/"+responseFormId+"/pdf");
 const name=await screen.findByRole("textbox",{name:"Nombre del PDF"});
 expect(screen.queryByText(/diseño del PDF$/)).not.toBeInTheDocument();
 expect(within(screen.getByRole("navigation",{name:"Migas de pan"})).getByText("Visita")).toBeVisible();
 expect(screen.queryByText(/Revisión|Todavía no se guardó/)).not.toBeInTheDocument();
 const preview=screen.getByRole("heading",{name:"Vista previa"}).parentElement!;
 expect(within(preview).getAllByRole("button").map(button=>button.textContent)).toEqual(["Vista previa"]);
 await userEvent.type(name," propio");
 expect(screen.queryByText(/Cambios sin guardar/)).not.toBeInTheDocument();
 expect(screen.queryByText(/diseño del PDF$/)).not.toBeInTheDocument();
 await userEvent.click(screen.getByRole("button",{name:"Guardar diseño"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Guardar diseño"})).toBeDisabled());
 expect(writes).toHaveLength(1);
 expect(screen.getByRole("button",{name:"Guardar diseño"})).not.toHaveAccessibleDescription();
 expect(screen.queryByText(/Revisión|Todavía no se guardó/)).not.toBeInTheDocument();
 await userEvent.type(name," otra vez");
 await userEvent.click(screen.getByRole("button",{name:"Guardar diseño"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Guardar diseño"})).toHaveAccessibleDescription(/^Esperá [0-9]+ segundos para volver a intentar\.$/));
 expect(screen.getByRole("button",{name:"Guardar diseño"})).toBeDisabled();
 expect(screen.getAllByText(/Esperá [0-9]+ segundos para volver a intentar\./)).toHaveLength(1);
 expect(name).toHaveValue("Comprobante de visita propio otra vez");
});
// The preview is not turned off by errors still hidden: trying it marks and focuses the first one, without asking for the preview.
it("marks the invalid design when the preview is tried instead of disabling it",async()=>{
 const writes=setup();let previews=0;
 server.use(http.post("/api/forms/definitions/:id/pdf-design/preview",()=>{previews++;return new HttpResponse(new Uint8Array([37,80,68,70]),{headers:{"content-type":"application/pdf","content-language":"es"}});}));
 renderRouteWithProviders("/formularios/"+responseFormId+"/pdf");
 const name=await screen.findByRole("textbox",{name:"Nombre del PDF"});
 await userEvent.clear(name);
 expect(name).not.toHaveAttribute("aria-invalid","true");
 const preview=within(screen.getByRole("region",{name:"Vista previa"})).getByRole("button",{name:"Vista previa"});
 expect(preview).toBeEnabled();
 expect(preview).not.toHaveAccessibleDescription();
 await userEvent.click(preview);
 await waitFor(()=>expect(name).toHaveFocus());
 expect(name).toHaveAttribute("aria-invalid","true");
 expect(name).toHaveAccessibleDescription("Completá el idioma original.");
 expect(screen.getByText("Con una respuesta de ejemplo. La vista previa no guarda ni emite un comprobante.")).toBeInTheDocument();
 expect(previews).toBe(0);
 // Save, tried the same way, also focuses the first error and sends nothing.
 act(()=>preview.focus());
 await userEvent.click(screen.getByRole("button",{name:"Guardar diseño"}));
 await waitFor(()=>expect(name).toHaveFocus());
 expect(writes).toEqual([]);
 await userEvent.type(name,"Comprobante");
 expect(name).not.toHaveAttribute("aria-invalid","true");
 await userEvent.click(preview);
 await waitFor(()=>expect(previews).toBe(1));
});

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
it("shows an error of the original under the translated field with its language", async () => {
  setup(); let saves = 0;
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, culture: "en", permissions: ["formrules.manage"] })), http.post("/api/forms/definitions/:id/pdf-design", () => { saves++; return HttpResponse.json({ code: "Validation.Failed", errors: { "design.name.es": ["Check the PDF name."] } }, { status: 400 }); }));
  await act(async () => { await i18n.changeLanguage("en"); });
  renderRouteWithProviders("/formularios/" + responseFormId + "/pdf");
  const footer = await screen.findByRole("textbox", { name: "Footer text" });
  await userEvent.type(footer, "Thanks for your visit.");
  await userEvent.click(screen.getByRole("button", { name: "Save design" }));
  expect(footer).toHaveAccessibleDescription("In Spanish: Complete the original language.");
  expect(footer).toHaveAttribute("aria-invalid", "true");
  expect(saves).toBe(0);
  await userEvent.clear(footer);
  const name = screen.getByRole("textbox", { name: "PDF name" });
  await userEvent.type(name, "Visit receipt");
  await userEvent.click(screen.getByRole("button", { name: "Save design" }));
  await waitFor(() => expect(name).toHaveAccessibleDescription("In Spanish: Check the PDF name."));
  expect(name).toHaveAttribute("aria-invalid", "true");
  expect(notify).not.toHaveBeenCalled();
});

it("titles the PDF design in the menu language and falls back to the original when it has no translation", async () => {
  setup();
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, culture: "en", permissions: ["formrules.manage"] })), http.get("/api/forms/definitions/:id/pdf-design", () => HttpResponse.json({ ...pdfDesignFixture(), design: { ...pdfDesignFixture().design, name: { es: "Comprobante de visita", en: "Visit receipt" } } })));
  await act(async () => { await i18n.changeLanguage("en"); });
  renderRouteWithProviders("/formularios/" + responseFormId + "/pdf");
  const name = await screen.findByRole("textbox", { name: "PDF name" });
  expect(name).toHaveValue("Visit receipt");
  expect(screen.getByRole("heading", { level: 1, name: "Visit receipt" })).toBeVisible();
  await userEvent.clear(name);
  expect(screen.getByRole("heading", { level: 1, name: "Comprobante de visita" })).toBeVisible();
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
