import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { createFormFixtureStore, fixtureFormId } from "@/test/visual/formFixtures";
vi.mock("react-oidc-context",async()=>({...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"),useAuth:()=>({isAuthenticated:true,isLoading:false,user:{access_token:"test"}})}));
vi.mock("../hooks/useFormDraftEditor",async()=>{const actual=await vi.importActual<typeof import("../hooks/useFormDraftEditor")>("../hooks/useFormDraftEditor");return {...actual,useFormDraftEditor:(...args:Parameters<typeof actual.useFormDraftEditor>)=>({...actual.useFormDraftEditor(...args),confirmRevision:()=>false})};});
it("refreshes confirmed lifecycle and navigation even when its private draft cannot adopt the revision",async()=>{
 queryClient.clear();const store=createFormFixtureStore("es","forms-lifecycle");const navigation=vi.fn();
 server.use(http.get("/api/forms/navigation",()=>{navigation();return HttpResponse.json({items:[],page:1,pageSize:4,totalCount:0,totalPages:0,hasPrevious:false,hasNext:false});}),http.all("/api/forms/*",({request})=>store.handle(request)),http.get("/api/me",()=>HttpResponse.json({id:"actor",displayName:"Ana",email:"ana@example.com",emailConfirmed:true,phoneNumber:null,formattedPhoneNumber:null,maskedPhoneNumber:null,phoneNumberConfirmed:false,hasGoogleLogin:false,culture:"es",timeZoneId:"America/Argentina/Buenos_Aires",lastLoginAtUtc:null,roles:[],permissions:["formtemplates.read","formtemplates.manage","formtemplates.publish","formrecords.read"]})));
 renderRouteWithProviders("/formularios/"+fixtureFormId);const name=await screen.findByLabelText("Nombre");await userEvent.click(name);await userEvent.paste(" privado");await waitFor(()=>expect(navigation).toHaveBeenCalledOnce());const trigger=screen.getByRole("button",{name:"Acciones del formulario"});act(()=>trigger.focus());await userEvent.keyboard("{Enter}");await userEvent.click(within(await screen.findByRole("menu")).getByRole("menuitem",{name:/Dar de baja/}));const dialog=await screen.findByRole("dialog");await userEvent.click(await within(dialog).findByRole("button",{name:"Dar de baja"}));
 await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());expect(await screen.findByText(/Dado de baja por/)).toBeVisible();expect(name).toHaveValue("Registrar visita privado");await waitFor(()=>expect(navigation).toHaveBeenCalledTimes(2));
});
