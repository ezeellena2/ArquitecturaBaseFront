import { act,screen,waitFor,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { useQueryClient,type QueryClient } from "@tanstack/react-query";
import { http,HttpResponse } from "msw";
import { beforeEach,expect,it,vi } from "vitest";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { notify,dismissNotification } from "@/shared/ui/notifications";
import { FormSuggestionsSection } from "./FormSuggestionsSection";
const id="0199a0c0-0000-7000-8000-000000000010",destinationId="0199a0c0-0000-7000-8000-000000000020",version="0199a0c0-0000-7000-8000-000000000030",fieldId="0199a0c0-0000-7000-8000-000000000040",targetId="0199a0c0-0000-7000-8000-000000000050",actor="0199a0c0-0000-7000-8000-000000000060";
const scope={actorId:actor,culture:"es" as const,permissions:["formsuggestions.manage"]};
const current=()=>({id:null,definitionId:id,sourceVersionId:null,revision:0,suggestions:[],createdAtUtc:null,author:null});
const question=(fieldId:string,label:string,type="shortText")=>({fieldId,key:"field_"+fieldId.replaceAll("-",""),label:{es:label},help:null,type,required:false,maxLength:type==="shortText"?100:null,options:null});
const source={definitionId:id,versionId:version,name:{es:"Entrega"},originalCulture:"es",questions:[question(fieldId,"Bultos","decimal")]};
const destination={definitionId:destinationId,versionId:version,name:{es:"Facturar entrega"},originalCulture:"es",questions:[question(targetId,"Entrega asociada")]};
function setup(){server.use(http.get("/api/forms/definitions/:id/suggestions",()=>HttpResponse.json(current())),http.get("/api/forms/definitions/:id/suggestions/options",()=>HttpResponse.json({source,destinations:[destination],unavailableDestinations:[],conditionChoices:{}})),http.get("/api/forms/definitions/:id/suggestions/revisions",()=>HttpResponse.json({items:[],page:1,pageSize:10,totalCount:0,totalPages:0,hasPrevious:false,hasNext:false})));}
const props=()=>({definitionId:id,definitionRevision:1,scope,onDirtyChange:vi.fn()});
async function add(){await userEvent.click(await screen.findByRole("button",{name:"Agregar sugerencia"}));await userEvent.selectOptions(screen.getByRole("combobox",{name:"Formulario a sugerir"}),destinationId);await userEvent.type(screen.getByRole("textbox",{name:"Cuándo sugerirlo"}),"Cuando pide factura");}
beforeEach(()=>vi.clearAllMocks());
it("saves a monolingual suggestion independently with a record number mapping and stable identities",async()=>{setup();const writes=vi.fn();server.use(http.post("/api/forms/definitions/:id/suggestions",async({request})=>{const body=await request.json() as {suggestions:unknown[]};writes(body);return HttpResponse.json({...current(),id:version,sourceVersionId:version,revision:1,suggestions:body.suggestions.map(row=>({...row as object,destinationVersionId:version})),createdAtUtc:"2026-10-17T12:00:00Z"},{status:201});}));const p=props();renderWithProviders(<FormSuggestionsSection {...p}/>);await add();await userEvent.click(screen.getByRole("button",{name:"Agregar dato"}));await userEvent.selectOptions(screen.getByRole("combobox",{name:"Dato de origen 1"}),"RecordNumber");await userEvent.selectOptions(screen.getByRole("combobox",{name:"Pregunta de destino 1"}),targetId);await userEvent.click(screen.getByRole("button",{name:"Guardar sugerencias"}));await waitFor(()=>expect(writes).toHaveBeenCalledOnce());expect(writes).toHaveBeenCalledWith({expectedRevision:0,suggestions:[{id:expect.any(String),destinationDefinitionId:destinationId,mode:"Assistant",when:"Cuando pide factura",isActive:true,conditions:[],mappings:[{source:{kind:"RecordNumber",fieldId:null},destinationFieldId:targetId}]}]});await waitFor(()=>expect(p.onDirtyChange).toHaveBeenLastCalledWith(false));expect(vi.mocked(notify).mock.calls.at(-1)?.[0]).toMatchObject({kind:"success"});});
it("retains its own whole draft through a conflict and uses the reread revision only after an explicit choice",async()=>{setup();let revision=0;const writes:unknown[]=[];server.use(http.get("/api/forms/definitions/:id/suggestions",()=>HttpResponse.json({...current(),revision,id:revision?version:null})),http.post("/api/forms/definitions/:id/suggestions",async({request})=>{const body=await request.json() as {suggestions:unknown[]};writes.push(body);if(writes.length===1){revision=2;return HttpResponse.json({code:"Forms.Suggestion.RevisionConflict"},{status:409});}return HttpResponse.json({...current(),id:version,sourceVersionId:version,revision:3,suggestions:body.suggestions.map(row=>({...row as object,destinationVersionId:version})),createdAtUtc:"2026-10-17T12:00:00Z"},{status:201});}));renderWithProviders(<FormSuggestionsSection {...props()}/>);await add();await userEvent.click(screen.getByRole("button",{name:"Guardar sugerencias"}));await userEvent.click(await screen.findByRole("button",{name:"Releer sugerencias"}));expect(screen.getByRole("textbox",{name:"Cuándo sugerirlo"})).toHaveValue("Cuando pide factura");await userEvent.click(await screen.findByRole("button",{name:"Conservar mis cambios"}));expect(writes).toHaveLength(1);await userEvent.click(screen.getByRole("button",{name:"Guardar sugerencias"}));await waitFor(()=>expect(writes).toHaveLength(2));expect(writes[1]).toEqual({...writes[0] as object,expectedRevision:2});});
it("notifies one recoverable save failure without duplicating the cause or losing the draft",async()=>{setup();server.use(http.post("/api/forms/definitions/:id/suggestions",()=>HttpResponse.json({code:"Test.Save",detail:"Falló este guardado."},{status:500})));const view=renderWithProviders(<FormSuggestionsSection {...props()}/>);await add();await userEvent.click(screen.getByRole("button",{name:"Guardar sugerencias"}));await waitFor(()=>expect(notify).toHaveBeenCalledOnce());const notice=vi.mocked(notify).mock.calls[0][0];expect(notice.kind).toBe("error");expect(screen.queryByText(notice.message)).not.toBeInTheDocument();expect(screen.getByRole("textbox",{name:"Cuándo sugerirlo"})).toHaveValue("Cuando pide factura");expect(screen.getByRole("button",{name:"Guardar sugerencias"})).toBeEnabled();view.unmount();expect(dismissNotification).toHaveBeenCalledWith(notice.id);});
it("does not request configuration without its own permission",async()=>{setup();const calls=vi.fn();server.use(http.get("/api/forms/definitions/:id/suggestions",()=>{calls();return HttpResponse.json(current());}));await act(async()=>{renderWithProviders(<FormSuggestionsSection {...props()} scope={{...scope,permissions:["formtemplates.read"]}}/>);});expect(calls).not.toHaveBeenCalled();expect(screen.queryByRole("button",{name:"Guardar sugerencias"})).not.toBeInTheDocument();});
it("removes the private draft and all configuration queries after a confirmed permission denial",async()=>{setup();const secret="Contenido privado sugerido";const row={id:version,destinationDefinitionId:destinationId,destinationVersionId:version,mode:"Assistant",when:secret,isActive:true,conditions:[],mappings:[]};server.use(http.get("/api/forms/definitions/:id/suggestions",()=>HttpResponse.json({...current(),id:version,sourceVersionId:version,revision:1,suggestions:[row],createdAtUtc:"2026-10-17T12:00:00Z"})),http.post("/api/forms/definitions/:id/suggestions",()=>HttpResponse.json({code:"Test.Forbidden"},{status:403})));let client:QueryClient|undefined;function Probe(){const value=useQueryClient();useEffect(()=>{client=value;},[value]);return null;}renderWithProviders(<><Probe/><FormSuggestionsSection {...props()}/></>);await userEvent.click(await screen.findByRole("button",{name:"Editar sugerencia 1"}));await userEvent.type(screen.getByRole("textbox",{name:"Cuándo sugerirlo"})," propio");await userEvent.click(screen.getByRole("button",{name:"Guardar sugerencias"}));await screen.findByText("Ya no tenés permiso para administrar las sugerencias.");expect(screen.queryByDisplayValue(new RegExp(secret))).not.toBeInTheDocument();await waitFor(()=>expect(client?.getQueryCache().getAll().some(query=>JSON.stringify(query.state.data)?.includes(secret))).toBe(false));});
it("returns focus to the same row after Done and to Add after removing the last suggestion",async()=>{setup();renderWithProviders(<FormSuggestionsSection {...props()}/>);await add();await userEvent.click(screen.getByRole("button",{name:"Listo"}));const edit=screen.getByRole("button",{name:"Editar sugerencia 1"});await waitFor(()=>expect(edit).toHaveFocus());await userEvent.click(screen.getByRole("button",{name:"Quitar sugerencia 1"}));await waitFor(()=>expect(screen.getByRole("button",{name:"Agregar sugerencia"})).toHaveFocus());});
it("explains the unpublished source as configuration state without issuing an operational notice",async()=>{setup();server.use(http.get("/api/forms/definitions/:id/suggestions/options",()=>HttpResponse.json({code:"Forms.Suggestion.SourceNotPublished"},{status:409})));renderWithProviders(<FormSuggestionsSection {...props()}/>);expect(await screen.findByText("Publicá el formulario para configurar qué sugerir después.")).toBeVisible();expect(notify).not.toHaveBeenCalled();expect(screen.queryByRole("button",{name:"Agregar sugerencia"})).not.toBeInTheDocument();});
vi.mock("@/shared/ui/notifications",async()=>({...await vi.importActual<typeof import("@/shared/ui/notifications")>("@/shared/ui/notifications"),notify:vi.fn(),dismissNotification:vi.fn()}));

it("refreshes published metadata after publishing without overwriting an unsaved suggestion",async()=>{setup();let available=false;server.use(http.get("/api/forms/definitions/:id/suggestions/options",()=>available?HttpResponse.json({source,destinations:[destination],unavailableDestinations:[],conditionChoices:{}}):HttpResponse.json({code:"Forms.Suggestion.SourceNotPublished"},{status:409})));const p=props();const view=renderWithProviders(<FormSuggestionsSection {...p} publishedVersionId={null}/>);await screen.findByText("Publicá el formulario para configurar qué sugerir después.");available=true;view.rerender(<FormSuggestionsSection {...p} publishedVersionId={version}/>);await add();expect(screen.getByRole("textbox",{name:"Cuándo sugerirlo"})).toHaveValue("Cuando pide factura");const updated={...destination,questions:[question(targetId,"Nueva pregunta publicada")]};server.use(http.get("/api/forms/definitions/:id/suggestions/options",()=>HttpResponse.json({source,destinations:[updated],unavailableDestinations:[],conditionChoices:{}})));view.rerender(<FormSuggestionsSection {...p} publishedVersionId={destinationId}/>);await userEvent.click(screen.getByRole("button",{name:"Agregar dato"}));await screen.findByRole("option",{name:"Nueva pregunta publicada"});expect(screen.getByRole("textbox",{name:"Cuándo sugerirlo"})).toHaveValue("Cuando pide factura");});

it("views a fixed historical suggestion without relabeling its old destination or adopting it",async()=>{setup();const oldVersion=crypto.randomUUID();const row={id:version,destinationDefinitionId:destinationId,destinationVersionId:oldVersion,mode:"Assistant",when:"Motivo histórico",isActive:true,conditions:[],mappings:[]};let details=0;server.use(http.get("/api/forms/definitions/:id/suggestions/revisions",()=>HttpResponse.json({items:[{id:version,revision:1,createdAtUtc:"2026-10-17T12:00:00Z",author:null,changes:{addedSuggestions:1,updatedSuggestions:0,removedSuggestions:0,orderChanged:false}}],page:1,pageSize:10,totalCount:1,totalPages:1,hasPrevious:false,hasNext:false})),http.get("/api/forms/definitions/:id/suggestions/revisions/:revision",()=>{details++;return HttpResponse.json({...current(),id:version,sourceVersionId:version,revision:1,suggestions:[row],createdAtUtc:"2026-10-17T12:00:00Z"});}));const p=props();renderWithProviders(<FormSuggestionsSection {...p}/>);const trigger=await screen.findByRole("button",{name:"Revisión 1"});expect(details).toBe(0);await userEvent.click(trigger);const dialog=await screen.findByRole("dialog",{name:"Revisión 1"});expect(within(dialog).getByText(/Motivo histórico/)).toBeVisible();expect(within(dialog).getByText("Formulario de otra versión")).toBeVisible();expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();expect(p.onDirtyChange).toHaveBeenLastCalledWith(false);await userEvent.click(within(dialog).getByRole("button",{name:"Cerrar"}));await waitFor(()=>expect(trigger).toHaveFocus());});

it("opens the stable suggestion of a nested HTTP field error and focuses the marked source without losing the other draft",async()=>{setup();server.use(http.post("/api/forms/definitions/:id/suggestions",()=>HttpResponse.json({code:"Forms.Suggestion.ContentInvalid",detail:"Revisá los datos marcados.",errors:{"suggestions[0].mappings[0].source":["La pregunta de origen cambió."]}},{status:400})));renderWithProviders(<FormSuggestionsSection {...props()}/>);await add();await userEvent.click(screen.getByRole("button",{name:"Agregar dato"}));await userEvent.selectOptions(screen.getByRole("combobox",{name:"Pregunta de destino 1"}),targetId);await userEvent.click(screen.getByRole("button",{name:"Listo"}));await add();await userEvent.type(screen.getByRole("textbox",{name:"Cuándo sugerirlo"})," segundo borrador");await userEvent.click(screen.getByRole("button",{name:"Guardar sugerencias"}));const first=within(screen.getByRole("region",{name:"Sugerencia 1"}));await waitFor(()=>expect(first.getByRole("button",{name:"Editar sugerencia 1"})).toHaveAttribute("aria-expanded","true"),{timeout:1000});const control=first.getByRole("combobox",{name:"Dato de origen 1"});expect(control).toHaveAttribute("aria-invalid","true");expect(control).toHaveAccessibleDescription("La pregunta de origen cambió.");await waitFor(()=>expect(control).toHaveFocus());expect(within(screen.getByRole("region",{name:"Sugerencia 2"})).getByText(/Cuando pide factura segundo borrador/)).toBeVisible();expect(notify).not.toHaveBeenCalled();});
it("keeps one general notification for an unknown HTTP validation path instead of dropping its message",async()=>{setup();server.use(http.post("/api/forms/definitions/:id/suggestions",()=>HttpResponse.json({code:"Forms.Suggestion.ContentInvalid",detail:"Cambió una parte de la configuración que hay que revisar.",errors:{"unknown.field":["No se reconoce este dato."]}},{status:400})));renderWithProviders(<FormSuggestionsSection {...props()}/>);await add();await userEvent.click(screen.getByRole("button",{name:"Guardar sugerencias"}));await waitFor(()=>expect(notify).toHaveBeenCalledOnce());expect(vi.mocked(notify).mock.calls[0][0]).toMatchObject({kind:"error",message:"Cambió una parte de la configuración que hay que revisar."});expect(screen.queryByText("Cambió una parte de la configuración que hay que revisar.")).not.toBeInTheDocument();expect(screen.getByRole("textbox",{name:"Cuándo sugerirlo"})).toHaveValue("Cuando pide factura");await waitFor(()=>expect(screen.getByRole("button",{name:"Guardar sugerencias"})).toBeEnabled());});

it.each(["Deactivated", "Deleted"] as const)("keeps a %s target named and removable only, blocking save until it is removed and restoring focus", async state => {
 setup();
 const otherId = "0199a0c0-0000-7000-8000-000000000021";
 const row = {id:version,destinationDefinitionId:destinationId,destinationVersionId:version,mode:"Assistant",when:"Cuando pide factura",isActive:true,conditions:[],mappings:[]};
 server.use(
  http.get("/api/forms/definitions/:id/suggestions",()=>HttpResponse.json({...current(),id:version,sourceVersionId:version,revision:1,suggestions:[row,{...row,id:otherId}],createdAtUtc:"2026-10-17T12:00:00Z"})),
  http.get("/api/forms/definitions/:id/suggestions/options",()=>HttpResponse.json({source,destinations:[],unavailableDestinations:[{definitionId:destinationId,name:{es:"Facturar entrega",en:"Invoice delivery"},state}],conditionChoices:{}}))
 );
 renderWithProviders(<FormSuggestionsSection {...props()}/>);
 const first=within(await screen.findByRole("region",{name:"Sugerencia 1"}));
 expect(first.getByText("Facturar entrega")).toBeVisible();
 expect(first.getByText(state === "Deleted" ? "Eliminado" : "Dado de baja")).toBeVisible();
 expect(first.queryByRole("alert")).not.toBeInTheDocument();
 expect(first.queryByRole("button",{name:/Editar/})).not.toBeInTheDocument();
 expect(first.getAllByRole("button")).toHaveLength(1);
 expect(screen.getByRole("button",{name:"Guardar sugerencias"})).toBeDisabled();
 await userEvent.click(first.getByRole("button",{name:"Quitar sugerencia 1"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Quitar sugerencia 1"})).toHaveFocus());
 expect(screen.getByRole("button",{name:"Guardar sugerencias"})).toBeDisabled();
 await userEvent.click(screen.getByRole("button",{name:"Quitar sugerencia 1"}));
 await waitFor(()=>expect(screen.getByRole("button",{name:"Agregar sugerencia"})).toHaveFocus());
 expect(screen.getByRole("button",{name:"Guardar sugerencias"})).toBeEnabled();
 await userEvent.click(screen.getByRole("button",{name:"Agregar sugerencia"}));
 expect(within(screen.getByRole("combobox",{name:"Formulario a sugerir"})).queryByRole("option",{name:"Facturar entrega"})).not.toBeInTheDocument();
});


it("clears a condition value after changing its question and focuses the surviving condition when removed", async () => {
  setup(); const textId = crypto.randomUUID();
  server.use(http.get("/api/forms/definitions/:id/suggestions/options", () => HttpResponse.json({ source: { ...source, questions: [...source.questions, question(textId, "Notas")] }, destinations: [destination], unavailableDestinations: [], conditionChoices: {} })));
  renderWithProviders(<FormSuggestionsSection {...props()}/>); await add();
  await userEvent.click(screen.getByRole("button", { name: "Agregar condición" }));
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Condición" }), "gte");
  await userEvent.type(screen.getByRole("textbox", { name: "Valor" }), "12");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Pregunta" }), textId);
  expect(screen.getByRole("combobox", { name: "Condición" })).toHaveValue("answered");
  expect(screen.queryByRole("textbox", { name: "Valor" })).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Condición" }), "contains");
  expect(screen.getByRole("textbox", { name: "Valor" })).toHaveValue("");
  await userEvent.click(screen.getByRole("button", { name: "Agregar condición" }));
  await userEvent.click(screen.getByRole("button", { name: "Quitar condición 1" }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Pregunta" })).toHaveFocus());
  await userEvent.click(screen.getByRole("button", { name: "Quitar condición 1" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Agregar condición" })).toHaveFocus());
});


it("omits multiple-choice questions from both mapping selectors while retaining valid record-number mapping", async () => {
  setup();
  const sourceMultiId = "0199a0c0-0000-7000-8000-000000000070";
  const targetMultiId = "0199a0c0-0000-7000-8000-000000000071";
  const multiple = (fieldId: string, label: string) => ({ ...question(fieldId, label, "multiChoice"), source: { catalog: id },
    selection: { minSelected: 0, maxSelected: 3 }, options: null });
  server.use(http.get("/api/forms/definitions/:id/suggestions/options", () => HttpResponse.json({
    source: { ...source, questions: [...source.questions, multiple(sourceMultiId, "Fallas de origen")] },
    destinations: [{ ...destination, questions: [...destination.questions, multiple(targetMultiId, "Fallas de destino")] }],
    unavailableDestinations: [], conditionChoices: {},
  })));
  renderWithProviders(<FormSuggestionsSection {...props()}/>); await add();
  await userEvent.click(screen.getByRole("button", { name: "Agregar dato" }));
  const origin = screen.getByRole("combobox", { name: "Dato de origen 1" });
  expect(within(origin).queryByRole("option", { name: "Fallas de origen" })).not.toBeInTheDocument();
  await userEvent.selectOptions(origin, "RecordNumber");
  const target = screen.getByRole("combobox", { name: "Pregunta de destino 1" });
  expect(within(target).queryByRole("option", { name: "Fallas de destino" })).not.toBeInTheDocument();
  expect(within(target).getByRole("option", { name: "Entrega asociada" })).toBeInTheDocument();
});
