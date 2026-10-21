import { QueryObserver } from "@tanstack/react-query";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context",async()=>({...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),useAuth:()=>({isAuthenticated:true,isLoading:false,user:{access_token:"test"}})}));
vi.mock("../hooks/useFormDraftEditor",async()=>{const actual=await vi.importActual<typeof import("../hooks/useFormDraftEditor")>("../hooks/useFormDraftEditor");return {...actual,useFormDraftEditor:(...args:Parameters<typeof actual.useFormDraftEditor>)=>({...actual.useFormDraftEditor(...args),confirmRevision:()=>false})};});
let stopOverview: (() => void) | undefined;
afterEach(() => { stopOverview?.(); stopOverview = undefined; });
it("refreshes confirmed lifecycle and overview even when its private draft cannot adopt the revision",async()=>{
 queryClient.clear();const store=createFormFixtureStore("es","forms-lifecycle");const overview=vi.fn();
 server.use(http.all("/api/forms/*",({request})=>store.handle(request)),http.get("/api/me",()=>HttpResponse.json({id:"actor",displayName:"Ana",email:"ana@example.com",emailConfirmed:true,phoneNumber:null,formattedPhoneNumber:null,maskedPhoneNumber:null,phoneNumberConfirmed:false,hasGoogleLogin:false,culture:"es",timeZoneId:"America/Argentina/Buenos_Aires",lastLoginAtUtc:null,roles:[],permissions:["formtemplates.read","formtemplates.manage","formtemplates.publish","formrecords.read"]})));
 // Synthetic observed projection; the decoder and exported HTTP contracts are tested separately.
 const observer = new QueryObserver(queryClient, { queryKey: ["form-overview", "actor:es:formrecords.read,formtemplates.manage,formtemplates.publish,formtemplates.read", { state: "Active" }], gcTime: 0, queryFn: async () => {
  overview();const exists=store.definitions.has(fixtureFormId);const inactive=!!store.lifecycles.get(fixtureFormId)?.deactivatedAtUtc;const active=exists&&!inactive;
  return {forms:{items:active?[{id:fixtureFormId,name:"Registrar visita",prefix:"VIS",deactivatedAtUtc:null,pendingApprovalCount:null,responseCount:0,lastResponse:null}]:[],page:1,pageSize:20,totalCount:active?1:0,totalPages:active?1:0,hasPrevious:false,hasNext:false},
   filterCounts:{active:active?1:0,deactivated:exists&&inactive?1:0,deactivatedPending:null}};
 } });
 stopOverview=observer.subscribe(()=>{});
 renderRouteWithProviders("/formularios/"+fixtureFormId);const name=await screen.findByLabelText("Nombre");await userEvent.click(name);await userEvent.paste(" privado");
 await waitFor(()=>expect(overview).toHaveBeenCalledOnce());
 expect(observer.getCurrentResult().data).toMatchObject({forms:{totalCount:1},filterCounts:{active:1,deactivated:0}});
 const trigger=screen.getByRole("button",{name:"Acciones del formulario"});act(()=>trigger.focus());await userEvent.keyboard("{Enter}");await userEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem",{name:/Dar de baja/}));const dialog=await screen.findByRole("dialog");await userEvent.click(await within(dialog).findByRole("button",{name:"Dar de baja"}));
 await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());expect(await screen.findByText(/Dado de baja por/)).toBeVisible();expect(name).toHaveValue("Registrar visita privado");
 await waitFor(()=>expect(overview).toHaveBeenCalledTimes(2));
 expect(observer.getCurrentResult().data).toMatchObject({forms:{items:[],totalCount:0},filterCounts:{active:0,deactivated:1}});
});