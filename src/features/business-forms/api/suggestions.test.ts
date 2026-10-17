import { expect,it } from "vitest";
import { http,HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { readSuggestionOptions,readSuggestionSet,saveFormSuggestions } from "./suggestions";
const id="0199a0c0-0000-7000-8000-000000000010";
const version="0199a0c0-0000-7000-8000-000000000011";
const suggestion={id:version,destinationDefinitionId:version,destinationVersionId:version,mode:"Assistant",when:"Cuando pide factura",isActive:true,conditions:[],mappings:[{source:{kind:"RecordNumber",fieldId:null},destinationFieldId:version}]};
const current=()=>({id:null,definitionId:id,sourceVersionId:null,revision:0,suggestions:[],createdAtUtc:null,author:null});
const form={definitionId:id,versionId:version,name:{es:"Entrega"},originalCulture:"es",questions:[]};
it("reads an empty own revision and a canonical saved suggestion with its fixed destination version",()=>{expect(readSuggestionSet(current())).toEqual(current());expect(readSuggestionSet({...current(),id:version,sourceVersionId:version,revision:1,suggestions:[suggestion],createdAtUtc:"2026-10-17T12:00:00Z"}).suggestions).toEqual([suggestion]);});
it("reads published metadata and required catalog choices without response values",()=>{const body={source:form,destinations:[{...form,definitionId:version}],conditionChoices:{[version]:[{id:version,label:"Cliente"}]}};expect(readSuggestionOptions(body)).toEqual(body);});
it.each([{...suggestion,destinationVersionId:undefined},{...suggestion,mode:"Unknown"},{...suggestion,when:{es:"No es un mapa"}},{...suggestion,privateReason:"secret"}])("rejects unknown or incomplete suggestions",row=>{expect(()=>readSuggestionSet({...current(),suggestions:[row]})).toThrow("Invalid form suggestions contract.");});
it("requires the new configuration metadata without inserting defaults",()=>{expect(()=>readSuggestionOptions({source:form,destinations:[]})).toThrow();});
it("saves through its own revision endpoint without publishing or saving the draft",async()=>{let received:unknown;server.use(http.post("/api/forms/definitions/:id/suggestions",async({request})=>{received=await request.json();return HttpResponse.json({...current(),id:version,sourceVersionId:version,revision:1,suggestions:[],createdAtUtc:"2026-10-17T12:00:00Z"},{status:201});}));expect((await saveFormSuggestions(id,{expectedRevision:0,suggestions:[]})).revision).toBe(1);expect(received).toEqual({expectedRevision:0,suggestions:[]});});

it("requires the captured source version in every revision response without a fallback",()=>{const body=Object.fromEntries(Object.entries(current()).filter(([key])=>key!=="sourceVersionId"));expect(()=>readSuggestionSet(body)).toThrow("Invalid form suggestions contract.");});
