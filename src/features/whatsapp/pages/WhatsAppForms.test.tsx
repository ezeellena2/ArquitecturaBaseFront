import * as notifications from "@/shared/ui/notifications";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { queryClient } from "@/shared/api/queryClient";
import { chatKey, type Chat, type Thread } from "../api/chat";
import type { ChatFormOption } from "../api/forms";
import type { FormMessageRequest } from "../lib/formSendSession";
vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));
const definitionId="019abcde-1000-7000-8000-000000000001",versionId="019abcde-1000-7000-8000-000000000002";
let contact: Chat; let thread: Thread; let posts: FormMessageRequest[]; let options: ChatFormOption[];
const receipt=(request:FormMessageRequest,culture=contact.formEligibility?.recipientCulture??"es")=>({ quickReplies: null, assistant: null,id:"019abcde-1000-7000-8000-000000000003",requestId:request.requestId,operatorUserId:currentUser.id,body:(request.message??(culture==="en"?"Complete this form.":"Completá este formulario.")).trim(),requestedAtUtc:"2026-10-10T12:00:00Z",state:"Pending",waMessageId:null,kind:"Flow",origin:"Conversation" as const,recoveryPath:"/api/whatsapp/chats/"+contact.id+"/outgoing/"+request.requestId,form:{definitionId,versionId,versionNumber:1,name:options[0].name,culture}});
beforeEach(()=>{
 queryClient.clear();posts=[];options=[{definitionId,versionId,versionNumber:1,prefix:"VIS",name:{es:"Registrar visita",en:"Register visit"},questionCount:4,submitLabel:{es:"Confirmar visita",en:"Confirm visit"}}];
 contact={id:"chat-forms",profileName:"Juan",phoneNumber:"+54 9 351 555-1234",mode:"Manual",modeRevision:7,lastInboundAtUtc:new Date().toISOString(),lastInboundSequence:1,unreadCount:0,preview:"Hola",linkedAccount:{userId:"employee",displayName:"Juan Gómez",email:"juan@example.com",isActive:true},formEligibility:{status:"Eligible",recipientCulture:"es",recipientContextRevision:"opaque-1"}};
 thread={ assistantSuggestion: null, assistantAvailability: { state: "notInstalled" },contact,messages:[],outgoing:[],beforeAtUtc:null,beforeId:null};
 server.use(http.get("/api/me",()=>HttpResponse.json({...currentUser,permissions:["whatsapp.read","whatsapp.send","users.read"]})),http.get("/api/whatsapp/chats",()=>HttpResponse.json({page:{items:[contact],page:1,pageSize:20,totalPages:1,totalCount:1},allCount:1,unreadCount:0})),http.get("/api/whatsapp/chats/:id/messages",()=>HttpResponse.json(thread)),http.put("/api/whatsapp/chats/:id/read",()=>new HttpResponse(null,{status:204})),http.get("/api/whatsapp/chats/:id/forms",()=>HttpResponse.json({page:{items:options,page:1,pageSize:4,totalCount:options.length,totalPages:1,hasPrevious:false,hasNext:false},recipientCulture:contact.formEligibility?.recipientCulture,recipientContextRevision:contact.formEligibility?.recipientContextRevision})),http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation",()=>HttpResponse.json({culture:contact.formEligibility?.recipientCulture,recipientContextRevision:contact.formEligibility?.recipientContextRevision,preparation:{canSend:true,catalogs:[],issues:[]}})),http.post("/api/whatsapp/chats/:id/form-messages",async({request})=>{const body=await request.json() as FormMessageRequest;posts.push(body);const result=receipt(body);thread.outgoing=[result as Thread['outgoing'][number]];return HttpResponse.json(result,{status:202});}));
});
afterEach(()=>{queryClient.clear();vi.restoreAllMocks();});
async function openChat(){renderRouteWithProviders("/whatsapp/chat");await userEvent.click(await screen.findByRole("button",{name:"Juan"}));return screen.findByLabelText("Respuesta al cliente");}
async function openForm(){await openChat();await waitFor(()=>expect(screen.getByRole("button",{name:"Enviar formulario"})).toBeEnabled());await userEvent.click(screen.getByRole("button",{name:"Enviar formulario"}));const dialog=await screen.findByRole("dialog");await userEvent.click(await within(dialog).findByRole("radio",{name:"Registrar visita"}));if(!options[0].hasCatalogQuestions)await waitFor(()=>expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeEnabled());return dialog;}
describe("WhatsApp form sending with simulated server",()=>{
 it("keeps read access without either sending action when the operator lacks send permission",async()=>{server.use(http.get("/api/me",()=>HttpResponse.json({...currentUser,permissions:["whatsapp.read"]})));await openChat();expect(screen.queryByRole("button",{name:"Enviar"})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Enviar formulario"})).not.toBeInTheDocument();});
 it("keeps ordinary text available when the recipient has no linked account",async()=>{contact.linkedAccount=null;contact.formEligibility={status:"NoLinkedAccount",recipientCulture:null,recipientContextRevision:null};const text=await openChat();expect(text).toBeEnabled();expect(screen.getByRole("button",{name:"Enviar formulario"})).toBeDisabled();expect(screen.getByText("Número sin cuenta vinculada")).toBeInTheDocument();expect(posts).toEqual([]);});
 it("queues the exact selected version and message without losing the ordinary chat draft",async()=>{const dialog=await openForm();fireEvent.change(screen.getByLabelText("Respuesta al cliente"),{target:{value:"Borrador del chat"}});const message=within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"});fireEvent.change(message,{target:{value:" Cuando termines, completá la visita. "}});await userEvent.click(within(dialog).getByRole("button",{name:"Enviar formulario"}));await waitFor(()=>expect(posts).toHaveLength(1));await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());expect(posts[0]).toMatchObject({definitionId,versionId,expectedModeRevision:7,expectedRecipientContextRevision:"opaque-1",message:" Cuando termines, completá la visita. "});expect(posts[0]).not.toHaveProperty("userId");expect(posts[0]).not.toHaveProperty("culture");expect(screen.getByLabelText("Respuesta al cliente")).toHaveValue("Borrador del chat");expect(await screen.findByText("En cola")).toBeInTheDocument();expect(screen.getByText("Registrar visita")).toBeInTheDocument();expect(queryClient.getMutationCache().getAll().some(m=>JSON.stringify(m.state.variables).includes("Cuando termines"))).toBe(false);});
 it("looks up a lost response before repeating the same UUID and frozen body explicitly",async()=>{server.use(http.post("/api/whatsapp/chats/:id/form-messages",async({request})=>{const body=await request.json() as FormMessageRequest;posts.push(body);return posts.length===1?HttpResponse.error():HttpResponse.json(receipt(body),{status:202});}),http.get("/api/whatsapp/chats/:id/outgoing/:requestId",()=>new HttpResponse(null,{status:404})));const dialog=await openForm();const message=within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"});fireEvent.change(message,{target:{value:"Texto que se conserva"}});await userEvent.click(within(dialog).getByRole("button",{name:"Enviar formulario"}));await userEvent.click((await screen.findAllByRole("button",{name:"Consultar envío"}))[0]);expect(message).toHaveValue("Texto que se conserva");expect(message).toBeDisabled();expect(posts).toHaveLength(1);await userEvent.click(await within(dialog).findByRole("button",{name:"Repetir el mismo pedido"}));await waitFor(()=>expect(posts).toHaveLength(2));expect(posts[1]).toEqual(posts[0]);});
 it("blocks a changed recipient context while preserving what the operator wrote",async()=>{const dialog=await openForm();const message=within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"});fireEvent.change(message,{target:{value:"Mensaje privado intacto"}});contact.formEligibility={...contact.formEligibility!,recipientContextRevision:"opaque-2",recipientCulture:"en"};await queryClient.invalidateQueries({queryKey:chatKey});await waitFor(()=>expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeDisabled());expect(message).toHaveValue("Mensaje privado intacto");expect(posts).toEqual([]);});
});

it.each(["InactiveAccount","NoEligibleForms"] as const)("keeps ordinary messages enabled for form-only restriction %s",async status=>{contact.formEligibility={...contact.formEligibility!,status};if(status==="InactiveAccount")contact.linkedAccount!.isActive=false;const text=await openChat();expect(text).toBeEnabled();expect(screen.getByRole("button",{name:"Enviar formulario"})).toBeDisabled();expect(posts).toEqual([]);});
it("supports an eligible account without email",async()=>{contact.linkedAccount!.email=null;await openChat();expect(screen.getByText(/sin correo/)).toBeInTheDocument();expect(screen.getByRole("button",{name:"Enviar formulario"})).toBeEnabled();});
it("uses the recipient language for the initial message and both buttons, independently of Spanish UI",async()=>{contact.formEligibility!.recipientCulture="en";options[0]={...options[0],name:{es:"Registrar visita",en:"Register visit"},submitLabel:{es:"Confirmar visita",en:"Confirm visit"}};await openChat();await waitFor(()=>expect(screen.getByRole("button",{name:"Enviar formulario"})).toBeEnabled());await userEvent.click(screen.getByRole("button",{name:"Enviar formulario"}));const dialog=await screen.findByRole("dialog");await userEvent.click(await within(dialog).findByRole("radio",{name:"Register visit"}));await waitFor(()=>expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeEnabled());expect(within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"})).toHaveValue("Complete this form.");expect(within(dialog).getByText(/Open form/)).toHaveTextContent("Confirm visit");expect(posts).toEqual([]);});
it.each(["", "x".repeat(1025)])("validates message without truncating or posting",async text=>{const dialog=await openForm();const message=within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"});fireEvent.change(message,{target:{value:text}});await userEvent.click(within(dialog).getByRole("button",{name:"Enviar formulario"}));await waitFor(()=>expect(message).toHaveFocus());expect(message).toHaveValue(text);expect(posts).toEqual([]);});
it.each(["Assistant","Closed"])("invalidates send availability while preserving the message when %s",async reason=>{const dialog=await openForm();const message=within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"});fireEvent.change(message,{target:{value:"Texto intacto"}});if(reason==="Assistant")contact.mode="Assistant";else contact.lastInboundAtUtc="2020-01-01T00:00:00Z";await queryClient.invalidateQueries({queryKey:chatKey});await waitFor(()=>expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeDisabled());expect(message).toHaveValue("Texto intacto");expect(posts).toEqual([]);});
it("hides form metadata after permission is revoked by the API while preserving written text",async()=>{const dialog=await openForm();const message=within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"});fireEvent.change(message,{target:{value:"Mensaje privado"}});server.use(http.post("/api/whatsapp/chats/:id/form-messages",()=>HttpResponse.json({code:"General.Forbidden"},{status:403})));await userEvent.click(within(dialog).getByRole("button",{name:"Enviar formulario"}));await waitFor(()=>expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument());expect(message).toHaveValue("Mensaje privado");expect(within(dialog).queryByText("Registrar visita")).not.toBeInTheDocument();expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeDisabled();});
it("blocks a withdrawn selected version without converting it to a text send",async()=>{const dialog=await openForm();server.use(http.post("/api/whatsapp/chats/:id/form-messages",()=>HttpResponse.json({code:"WhatsApp.Flow.FormUnavailable"},{status:409})));const message=within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"});fireEvent.change(message,{target:{value:"Conservar texto"}});await userEvent.click(within(dialog).getByRole("button",{name:"Enviar formulario"}));await waitFor(()=>expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeDisabled());expect(message).toHaveValue("Conservar texto");expect(posts).toEqual([]);});
it("recovers a persisted lost response by GET without reposting",async()=>{server.use(http.post("/api/whatsapp/chats/:id/form-messages",async({request})=>{posts.push(await request.json() as FormMessageRequest);return HttpResponse.error();}),http.get("/api/whatsapp/chats/:id/outgoing/:requestId",()=>HttpResponse.json(receipt(posts[0]))));const dialog=await openForm();await userEvent.click(within(dialog).getByRole("button",{name:"Enviar formulario"}));await userEvent.click((await screen.findAllByRole("button",{name:"Consultar envío"}))[0]);await waitFor(()=>expect(screen.queryByRole("dialog")).not.toBeInTheDocument());expect(posts).toHaveLength(1);});
it.each(["Failed","Uncertain","Reviewed"] as const)("keeps a %s form card in the existing timeline without text reuse or false delivery",async state=>{const request={requestId:"019abcde-1000-7000-8000-000000000004",definitionId,versionId,expectedModeRevision:7,expectedRecipientContextRevision:"opaque-1",message:"Pedido previo"};thread.outgoing=[{...receipt(request),state} as Thread['outgoing'][number]];await openChat();expect(screen.getByText("Registrar visita")).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Usar este texto en el borrador"})).not.toBeInTheDocument();expect(screen.queryByText("Entregado",{exact:true})).not.toBeInTheDocument();if(state==="Uncertain")expect(screen.getByRole("button",{name:"Ya revisé el WhatsApp"})).toBeInTheDocument();});

it("respects Retry-After when checking a lost form send without repeating its POST",async()=>{let reads=0;server.use(http.post("/api/whatsapp/chats/:id/form-messages",async({request})=>{posts.push(await request.json() as FormMessageRequest);return HttpResponse.error();}),http.get("/api/whatsapp/chats/:id/outgoing/:requestId",()=>{reads++;return HttpResponse.json({code:"General.TooManyRequests"},{status:429,headers:{"Retry-After":"30"}});}));const dialog=await openForm();const message=within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"});fireEvent.change(message,{target:{value:"Pedido privado congelado"}});await userEvent.click(within(dialog).getByRole("button",{name:"Enviar formulario"}));await userEvent.click(await within(dialog).findByRole("button",{name:"Consultar envío"}));await waitFor(()=>expect(reads).toBe(1));await waitFor(()=>expect(within(dialog).getByRole("button",{name:"Consultar envío"})).toBeDisabled());expect(message).toHaveValue("Pedido privado congelado");expect(message).toBeDisabled();for(const action of screen.getAllByRole("button",{name:"Consultar envío"}))fireEvent.click(action);expect(reads).toBe(1);expect(posts).toHaveLength(1);});

it("keeps a request-conflict attempt frozen until its owned operation is checked", async () => {
  let reads = 0;
  server.use(http.post("/api/whatsapp/chats/:id/form-messages", async ({request}) => {
    posts.push(await request.json() as FormMessageRequest);
    return HttpResponse.json({code:"WhatsApp.Chat.RequestConflict"},{status:409});
  }), http.get("/api/whatsapp/chats/:id/outgoing/:requestId", () => { reads++; return HttpResponse.json(receipt(posts[0])); }));
  const dialog = await openForm();
  const message = within(dialog).getByRole("textbox", {name:"Mensaje que lo acompaña"});
  fireEvent.change(message, {target:{value:"Pedido privado exacto"}});
  await userEvent.click(within(dialog).getByRole("button", {name:"Enviar formulario"}));
  expect(await within(dialog).findByRole("button", {name:"Consultar envío"})).toBeEnabled();
  expect(message).toBeDisabled();
  expect(message).toHaveValue("Pedido privado exacto");
  expect(posts).toHaveLength(1);
  expect(reads).toBe(0);
  await userEvent.click(within(dialog).getByRole("button", {name:"Consultar envío"}));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(reads).toBe(1);
  expect(posts).toHaveLength(1);
});

it("reopens the existing closed form dialog after a confirmed missing receipt and repeats only on request", async () => {
  let reads = 0;
  server.use(http.post("/api/whatsapp/chats/:id/form-messages", async ({request}) => {
    const body = await request.json() as FormMessageRequest;
    posts.push(body);
    return posts.length === 1 ? HttpResponse.error() : HttpResponse.json(receipt(body), {status:202});
  }), http.get("/api/whatsapp/chats/:id/outgoing/:requestId", () => {
    reads++;
    return new HttpResponse(null, {status:404});
  }));
  const dialog = await openForm();
  fireEvent.change(within(dialog).getByRole("textbox", {name:"Mensaje que lo acompaña"}), {target:{value:" Pedido exacto congelado "}});
  await userEvent.click(within(dialog).getByRole("button", {name:"Enviar formulario"}));
  await within(dialog).findByRole("button", {name:"Consultar envío"});
  await userEvent.click(within(dialog).getByRole("button", {name:"Cancelar"}));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", {name:"Enviar formulario"})).toBeDisabled();
  expect(reads).toBe(0);
  expect(posts).toHaveLength(1);
  await userEvent.click(screen.getAllByRole("button", {name:"Consultar envío"})[0]);
  const reopened = await screen.findByRole("dialog");
  expect(reads).toBe(1);
  const message = within(reopened).getByRole("textbox", {name:"Mensaje que lo acompaña"});
  expect(message).toBeDisabled();
  expect(message).toHaveValue(" Pedido exacto congelado ");
  expect(posts).toHaveLength(1);
  await userEvent.click(await within(reopened).findByRole("button", {name:"Repetir el mismo pedido"}));
  await waitFor(() => expect(posts).toHaveLength(2));
  expect(posts[1]).toEqual(posts[0]);
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

it("preserves read-only history when linked account and eligibility are withheld as null", async () => {
  contact.linkedAccount = null;
  contact.formEligibility = null;
  thread.messages.push({ audio: null, quickReplies: null, assistant: null, origin: "Conversation" as const,id:"019abcde-1000-7000-8000-000000000010",direction:"Inbound",kind:"Text",body:"Historial permitido",occurredAtUtc:contact.lastInboundAtUtc,inboundSequence:1,operatorUserId:null,status:null,errorCode:null,purpose:"Business"});
  server.use(http.get("/api/me", () => HttpResponse.json({...currentUser,permissions:["whatsapp.read"]})));
  await openChat();
  expect(screen.getByText("Historial permitido")).toBeInTheDocument();
  expect(screen.queryByText("Número sin cuenta vinculada")).not.toBeInTheDocument();
  expect(screen.queryByText(/Cuenta vinculada/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", {name:"Enviar formulario"})).not.toBeInTheDocument();
  expect(screen.queryByRole("button", {name:"Enviar"})).not.toBeInTheDocument();
});
it.each([null, "juan@example.com"])("shows the authorized display name without inferring email absence when users.read is missing (%s)", async email => {
  contact.linkedAccount!.email = email;
  server.use(http.get("/api/me", () => HttpResponse.json({...currentUser,permissions:["whatsapp.read","whatsapp.send"]})));
  await openChat();
  expect(screen.queryByText(/juan@example.com/)).not.toBeInTheDocument();
  expect(screen.queryByText(/sin correo/)).not.toBeInTheDocument();
  expect(screen.getByText(/Juan Gómez/)).toBeInTheDocument();
  expect(screen.getByRole("button", {name:"Enviar formulario"})).toBeEnabled();
});


it("prepares recipient catalogs and shows their counts before sending", async () => {
  options[0] = {...options[0], hasCatalogQuestions: true};
  let preparations = 0;
  server.use(http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation", () => {
    preparations++;
    return HttpResponse.json({culture:"es",recipientContextRevision:"opaque-1",preparation:{canSend:true,issues:[],catalogs:[{
      fieldId:"019abcde-1000-7000-8000-000000000020",label:"Cliente",count:1,
    }]}});
  }));
  const dialog = await openForm();
  expect(await within(dialog).findByText("Cliente: 1 opción" )).toBeInTheDocument();
  expect(preparations).toBe(1);
  await userEvent.click(within(dialog).getByRole("button", {name:"Enviar formulario"}));
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0]).not.toHaveProperty("catalogs");
});

it.each([
  ["CatalogEmpty","Cliente: no tiene opciones y la pregunta es obligatoria."],
  ["RecipientDataMissing","No se puede mandar: Juan no tiene Zona, y «Cliente» muestra las opciones según ese dato. Cargáselo en «Editar usuario» y volvé a mandarlo."],
  ["CatalogFilterUnavailable","Cliente: el filtro no se puede usar. Avisale a quien administra el formulario."],
  ["CatalogTooLarge","Cliente: supera las 200 opciones que admite WhatsApp. Ajustá el catálogo antes de mandar."],
  ["CatalogUnavailable","Cliente: el catálogo no se puede usar. Avisale a quien lo administra."],
  ["CatalogOptionInvalid","Cliente: 2 opciones de Clientes no entran en WhatsApp. Revisá sus textos y detalles."],
])("blocks %s without losing either draft", async (reason, expected) => {
  options[0] = {...options[0], hasCatalogQuestions:true};
  server.use(http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation", () => HttpResponse.json({
    culture:"es",recipientContextRevision:"opaque-1",preparation:{canSend:false,catalogs:[],issues:[{
      fieldId:"019abcde-1000-7000-8000-000000000020",label:"Cliente",code:"Forms.Record."+reason,catalogName:"Clientes",invalidOptionCount:reason==="CatalogOptionInvalid"?2:null,missingData:reason==="RecipientDataMissing"?"Zona":null,
    }]},
  })));
  const dialog = await openForm();
  const message = within(dialog).getByRole("textbox", {name:"Mensaje que lo acompaña"});
  fireEvent.change(message, {target:{value:"Mensaje intacto"}});
  expect(await within(dialog).findByText(expected)).toBeInTheDocument();
  expect(within(dialog).getByRole("button", {name:"Enviar formulario"})).toBeDisabled();
  expect(message).toHaveValue("Mensaje intacto");
  expect(posts).toEqual([]);
});

it("opens a fresh manual form send after an inactive item notice without posting automatically", async () => {
  thread.messages=[{ audio: null, quickReplies: null, assistant: null, origin: "Conversation" as const,id:"019abcde-1000-7000-8000-000000000029",direction:"Inbound",kind:"FlowReply",body:null,
    occurredAtUtc:contact.lastInboundAtUtc,inboundSequence:1,operatorUserId:null,status:null,errorCode:null,purpose:"Business",
    formReply:{state:"Rejected",definitionId,versionId,versionNumber:1,name:"Registrar visita",recordId:null,number:null,values:null,
      rejectionCode:"Forms.Record.CatalogItemInactive",rejectedQuestion:"Cliente"}}];
  await openChat();
  await userEvent.click(await screen.findByRole("button",{name:"Mandar de nuevo"}));
  const dialog=await screen.findByRole("dialog");
  expect(posts).toEqual([]);
  await userEvent.click(await within(dialog).findByRole("radio",{name:"Registrar visita"}));
  await userEvent.click(within(dialog).getByRole("button",{name:"Enviar formulario"}));
  await waitFor(()=>expect(posts).toHaveLength(1));
  expect(posts[0]).not.toHaveProperty("flowToken");
});

it("retires prepared private options after an authoritative preparation denial", async () => {
  options[0]={...options[0],hasCatalogQuestions:true};
  let denied=false;
  server.use(http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation",()=>denied?
    HttpResponse.json({code:"Http.Forbidden"},{status:403}):HttpResponse.json({culture:"es",recipientContextRevision:"opaque-1",
      preparation:{canSend:true,issues:[],catalogs:[{fieldId:"019abcde-1000-7000-8000-000000000020",label:"Cliente",count:1}]}})));
  const dialog=await openForm();
  await within(dialog).findByText("Cliente: 1 opción");
  const message=within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"});
  fireEvent.change(message,{target:{value:"Mensaje privado intacto"}});
  denied=true;
  await queryClient.invalidateQueries({queryKey:chatKey});
  await waitFor(()=>expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument());
  await waitFor(()=>expect(JSON.stringify(queryClient.getQueryCache().getAll().map(query=>query.state.data))).not.toContain("Private option marker"));
  expect(message).toHaveValue("Mensaje privado intacto");
  expect(posts).toEqual([]);
});

it("explains how many options do not fit and names only their catalog", async () => {
  options[0] = {...options[0],hasCatalogQuestions:true};
  server.use(http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation", () => HttpResponse.json({
    culture:"es",recipientContextRevision:"opaque-1",preparation:{canSend:false,catalogs:[],issues:[{
      fieldId:"019abcde-1000-7000-8000-000000000020",label:"Cliente",code:"Forms.Record.CatalogOptionInvalid",catalogName:"Clientes",invalidOptionCount:2,missingData:null,
    }]},
  })));
  const dialog = await openForm();
  expect(await within(dialog).findByText("Cliente: 2 opciones de Clientes no entran en WhatsApp. Revisá sus textos y detalles.")).toBeInTheDocument();
  expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeDisabled();
});

it("owns preparation network errors locally and retries once without losing the message", async () => {
  const notices = vi.spyOn(notifications,"notify").mockImplementation(()=>0);
  options[0]={...options[0],hasCatalogQuestions:true}; let reads=0;
  server.use(http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation",()=>++reads===1?HttpResponse.error():HttpResponse.json({culture:"es",recipientContextRevision:"opaque-1",preparation:{catalogs:[{fieldId:"019abcde-1000-7000-8000-000000000020",label:"Cliente",count:1}],issues:[],canSend:true}})));
  const dialog=await openForm();
  await within(dialog).findByText("No pudimos cargar las opciones del catálogo.");
  const message=within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"});
  fireEvent.change(message,{target:{value:"Conservar borrador"}});
  expect(notices).toHaveBeenCalledTimes(1);
  expect(notices.mock.calls[0]![0].id).toBe("whatsapp:form-preparation:"+contact.id);
  expect(within(dialog).getAllByRole("button",{name:"Reintentar"})).toHaveLength(1);
  await userEvent.click(within(dialog).getByRole("button",{name:"Reintentar"}));
  await within(dialog).findByText("Cliente: 1 opción");
  expect(reads).toBe(2); expect(message).toHaveValue("Conservar borrador");
  expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeEnabled();
});
it("presents preparation 409 as a blocked form rather than a failed read", async () => {
  const notices=vi.spyOn(notifications,"notify").mockImplementation(()=>0);
  options[0]={...options[0],hasCatalogQuestions:true};
  server.use(http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation",()=>HttpResponse.json({code:"WhatsApp.Flow.FormUnavailable"},{status:409})));
  const dialog=await openForm();
  await within(dialog).findByText("El formulario elegido ya no está disponible. Elegí otro.");
  expect(within(dialog).queryByRole("button",{name:"Reintentar"})).not.toBeInTheDocument();
  expect(notices).not.toHaveBeenCalled();
  expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeDisabled();
});

it.each(["NoLinkedAccount","InactiveAccount","NoEligibleForms","NoSend"])("hides resend when the form composer cannot open: %s", async reason => {
  thread.messages=[{ audio: null, quickReplies: null, assistant: null, origin: "Conversation" as const,id:"019abcde-1000-7000-8000-000000000029",direction:"Inbound",kind:"FlowReply",body:null,
    occurredAtUtc:contact.lastInboundAtUtc,inboundSequence:1,operatorUserId:null,status:null,errorCode:null,purpose:"Business",
    formReply:{state:"Rejected",definitionId,versionId,versionNumber:1,name:"Registrar visita",recordId:null,number:null,values:null,
      rejectionCode:"Forms.Record.CatalogItemInactive",rejectedQuestion:"Cliente"}}];
  if(reason==="NoSend") server.use(http.get("/api/me",()=>HttpResponse.json({...currentUser,permissions:["whatsapp.read"]})));
  else contact.formEligibility={...contact.formEligibility!,status:reason as "NoLinkedAccount"|"InactiveAccount"|"NoEligibleForms"};
  if(reason==="NoLinkedAccount")contact.linkedAccount=null;
  if(reason==="InactiveAccount")contact.linkedAccount!.isActive=false;
  await openChat();
  expect(screen.queryByRole("button",{name:"Mandar de nuevo"})).not.toBeInTheDocument();
  expect(posts).toEqual([]);
});

it("waits for complete presentation culture even without catalogs and sends the fallback opening without changing the account context", async () => {
 contact.formEligibility!.recipientCulture="en";
 let release!: () => void; const gate = new Promise<void>(resolve => { release=resolve; }); let preparations=0;
 server.use(http.post("/api/whatsapp/chats/:id/form-messages",async({request})=>{const body=await request.json() as FormMessageRequest;posts.push(body);return HttpResponse.json(receipt(body,"es"),{status:202});}));
 server.use(http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation",async()=>{preparations++; await gate; return HttpResponse.json({culture:"es",recipientContextRevision:"opaque-1",preparation:{canSend:true,issues:[],catalogs:[]}});}));
 await openChat(); await waitFor(()=>expect(screen.getByRole("button",{name:"Enviar formulario"})).toBeEnabled()); await userEvent.click(screen.getByRole("button",{name:"Enviar formulario"})); const dialog=await screen.findByRole("dialog");
 await userEvent.click(await within(dialog).findByRole("radio",{name:"Register visit"}));
 expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeDisabled();
 await waitFor(()=>expect(preparations).toBe(1)); await act(async()=>release());
 await waitFor(()=>expect(within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"})).toHaveValue("Completá este formulario."));
 expect(within(dialog).getByRole("radio",{name:"Registrar visita"})).toHaveAttribute("aria-checked","true");
 expect(within(dialog).getByText(/^Es lo que lee arriba del botón/)).toHaveTextContent("Confirmar visita");
 expect(within(dialog).queryByText(/Cambió la cuenta/)).not.toBeInTheDocument();
 await userEvent.click(within(dialog).getByRole("button",{name:"Enviar formulario"})); await waitFor(()=>expect(posts).toHaveLength(1));
 expect(posts[0]).toMatchObject({expectedRecipientContextRevision:"opaque-1",message:null}); expect(posts[0]).not.toHaveProperty("culture");
});

it("preserves an edited opening while presentation culture is resolved after selecting a plain form", async () => {
 contact.formEligibility!.recipientCulture="en"; let release!: () => void; const gate=new Promise<void>(resolve=>{release=resolve;});
 server.use(http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation",async()=>{await gate; return HttpResponse.json({culture:"es",recipientContextRevision:"opaque-1",preparation:{canSend:true,issues:[],catalogs:[]}});}));
 await openChat(); await waitFor(()=>expect(screen.getByRole("button",{name:"Enviar formulario"})).toBeEnabled()); await userEvent.click(screen.getByRole("button",{name:"Enviar formulario"})); const dialog=await screen.findByRole("dialog");
 await userEvent.click(await within(dialog).findByRole("radio",{name:"Register visit"})); const message=within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"});
 fireEvent.change(message,{target:{value:"Texto del operador intacto"}}); await act(async()=>release());
 await waitFor(()=>expect(within(dialog).getByRole("radio",{name:"Registrar visita"})).toHaveAttribute("aria-checked","true"));
 expect(message).toHaveValue("Texto del operador intacto"); await userEvent.click(within(dialog).getByRole("button",{name:"Enviar formulario"})); await waitFor(()=>expect(posts).toHaveLength(1)); expect(posts[0].message).toBe("Texto del operador intacto");
});

it("blocks a plain form after preparation fails and retries without losing the edited opening", async () => {
 contact.formEligibility!.recipientCulture="en"; let reads=0;
 server.use(http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation",()=>++reads===1?HttpResponse.json({detail:"Falla temporal"},{status:500}):HttpResponse.json({culture:"es",recipientContextRevision:"opaque-1",preparation:{canSend:true,catalogs:[],issues:[]}})));
 await openChat(); await waitFor(()=>expect(screen.getByRole("button",{name:"Enviar formulario"})).toBeEnabled()); await userEvent.click(screen.getByRole("button",{name:"Enviar formulario"})); const dialog=await screen.findByRole("dialog"); await userEvent.click(await within(dialog).findByRole("radio",{name:"Register visit"}));
 await within(dialog).findByText("No pudimos preparar el formulario."); expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeDisabled();
 const message=within(dialog).getByRole("textbox",{name:"Mensaje que lo acompaña"}); fireEvent.change(message,{target:{value:"Texto conservado"}});
 await userEvent.click(within(dialog).getByRole("button",{name:"Reintentar"})); await waitFor(()=>expect(within(dialog).getByRole("radio",{name:"Registrar visita"})).toHaveAttribute("aria-checked","true"));
 expect(message).toHaveValue("Texto conservado"); expect(within(dialog).getByRole("button",{name:"Enviar formulario"})).toBeEnabled(); expect(reads).toBe(2); expect(posts).toEqual([]);
});

for (const original of ["es", "en"] as const) for (const secondaryText of [undefined, ""]) {
  it("selects and sends " + original + " original to the other account culture with " + (secondaryText === undefined ? "absent" : "empty") + " secondary", async () => {
    const secondary = original === "es" ? "en" : "es";
    const name = original === "es" ? "Registrar visita" : "Register visit";
    const submitLabel = original === "es" ? "Confirmar visita" : "Confirm visit";
    contact.formEligibility!.recipientCulture = secondary;
    options[0] = { ...options[0], name: { [original]: name, ...(secondaryText === undefined ? {} : { [secondary]: secondaryText }) }, submitLabel: { [original]: submitLabel, ...(secondaryText === undefined ? {} : { [secondary]: secondaryText }) } };
    server.use(http.get("/api/whatsapp/chats/:id/forms/:definitionId/versions/:versionId/preparation", () => HttpResponse.json({ culture: original, recipientContextRevision: "opaque-1", preparation: { canSend: true, catalogs: [], issues: [] } })),
      http.post("/api/whatsapp/chats/:id/form-messages", async ({ request }) => { const body = await request.json() as FormMessageRequest; posts.push(body); const result = receipt(body, original); thread.outgoing = [result as Thread['outgoing'][number]]; return HttpResponse.json(result, { status: 202 }); }));
    await openChat();
    await userEvent.click(screen.getByRole("button", { name: "Enviar formulario" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(await within(dialog).findByRole("radio", { name }));
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Enviar formulario" })).toBeEnabled());
    expect(within(dialog).getByText(/^Es lo que lee arriba del botón/)).toHaveTextContent(submitLabel);
    expect(within(dialog).getByRole("textbox", { name: "Mensaje que lo acompaña" })).toHaveValue(original === "es" ? "Completá este formulario." : "Complete this form.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar formulario" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ definitionId, versionId, message: null, expectedRecipientContextRevision: "opaque-1" });
    expect(screen.getByText(name)).toBeInTheDocument();
    await act(async () => { await queryClient.invalidateQueries({ queryKey: chatKey }); });
    expect(screen.getByText(name)).toBeInTheDocument();
    expect(contact.formEligibility!.recipientCulture).toBe(secondary);
  });
}

it("does not repeat the Manual attention explanation inside an ordinary form dialog", async () => {
 thread.assistantAvailability = { state: "available" };
 const dialog = await openForm();
 expect(within(dialog).queryByText("La conversación sigue en atención manual.")).not.toBeInTheDocument();
 expect(screen.queryByText("La conversación sigue en atención manual.")).not.toBeInTheDocument();
 expect(posts).toEqual([]);
});
