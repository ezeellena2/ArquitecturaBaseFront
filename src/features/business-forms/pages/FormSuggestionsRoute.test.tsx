import { screen,waitFor,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http,HttpResponse } from "msw";
import { expect,it,vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import { createFormFixtureStore,fixtureFormId } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context",async()=>({...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),useAuth:()=>({isAuthenticated:true,isLoading:false,user:{access_token:"test"}})}));
it("protects only suggestion edits with the existing discard dialog without saving the form draft",async()=>{
  const store=createFormFixtureStore("es","forms-publication-preview");const destinationId="0199a0c0-0000-7000-8000-000000000020",version="0199a0c0-0000-7000-8000-000000000030";
  server.use(http.get("/api/me",()=>HttpResponse.json({id:"actor",displayName:"Ana",email:"ana@example.com",emailConfirmed:true,phoneNumber:null,formattedPhoneNumber:null,maskedPhoneNumber:null,phoneNumberConfirmed:false,hasGoogleLogin:false,culture:"es",timeZoneId:"America/Argentina/Buenos_Aires",lastLoginAtUtc:null,roles:[],permissions:["formtemplates.read","formsuggestions.manage"]})),http.get("/api/forms/definitions/:id/suggestions",()=>HttpResponse.json({id:null,definitionId:fixtureFormId,sourceVersionId:null,revision:0,suggestions:[],createdAtUtc:null,author:null})),http.get("/api/forms/definitions/:id/suggestions/options",()=>HttpResponse.json({source:{definitionId:fixtureFormId,versionId:version,name:{es:"Entrega"},originalCulture:"es",questions:[]},destinations:[{definitionId:destinationId,versionId:version,name:{es:"Facturar entrega"},originalCulture:"es",questions:[]}],unavailableDestinations:[],conditionChoices:{}})),http.get("/api/forms/definitions/:id/suggestions/revisions",()=>HttpResponse.json({items:[],page:1,pageSize:10,totalCount:0,totalPages:0,hasPrevious:false,hasNext:false})),http.all("/api/forms/*",({request})=>store.handle(request)));
  renderRouteWithProviders("/formularios/"+fixtureFormId);
  await userEvent.click(await screen.findByRole("button",{name:"Agregar sugerencia"}));await userEvent.selectOptions(screen.getByRole("combobox",{name:"Formulario a sugerir"}),destinationId);await userEvent.type(screen.getByRole("textbox",{name:"Cuándo sugerirlo"}),"Cuando pide factura");
  await userEvent.click(screen.getByRole("button",{name:"Descartar"}));const dialog=await screen.findByRole("dialog");await userEvent.click(within(dialog).getByRole("button",{name:"Seguir editando"}));await waitFor(()=>expect(dialog).not.toBeInTheDocument());
  expect(screen.getByRole("textbox",{name:"Cuándo sugerirlo"})).toHaveValue("Cuando pide factura");expect(screen.queryByRole("button",{name:"Guardar borrador"})).not.toBeInTheDocument();expect(store.calls.some(call=>call.method!=="GET")).toBe(false);
});
