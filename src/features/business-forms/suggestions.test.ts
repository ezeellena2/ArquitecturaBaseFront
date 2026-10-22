import { expect, it } from "vitest";
import type { CanonicalQuestion } from "./model";
import { mappingTargets, newSuggestion, prepareSuggestions, suggestionFieldErrors, type FormSuggestion, type PublishedSuggestionForm } from "./suggestions";
const field = (fieldId:string,type:CanonicalQuestion["type"]):CanonicalQuestion => { const base={fieldId,key:"field_"+fieldId.replaceAll("-",""),label:{es:fieldId},help:null,required:false}; if(type==="shortText"||type==="longText")return {...base,type,maxLength:100};if(type==="multiChoice")return {...base,type,selection:{minSelected:0,maxSelected:3},options:[{choiceId:crypto.randomUUID(),label:{es:"A"}}]};if(type==="choice")return {...base,type,options:[{choiceId:crypto.randomUUID(),label:{es:"A"}}]};if(type==="photo"||type==="document")return {...base,type,files:{minFiles:0,maxFiles:1,photoSource:type==="photo"?"cameraOrGallery":null}};return {...base,type}; };
const source:PublishedSuggestionForm={definitionId:crypto.randomUUID(),versionId:crypto.randomUUID(),name:{es:"Entrega"},originalCulture:"es",questions:[field("text","shortText"),field("number","decimal"),field("photo","photo")]};
const destination:PublishedSuggestionForm={...source,definitionId:crypto.randomUUID(),versionId:crypto.randomUUID(),name:{es:"Factura"},questions:[field("target-text","shortText"),field("target-long","longText"),field("target-number","decimal")]};
const suggestion=():FormSuggestion=>({...newSuggestion(),destinationDefinitionId:destination.definitionId,destinationVersionId:destination.versionId,when:"Cuando pide factura"});
it("normalizes one monolingual explanation without serializing the server-owned destination version",()=>{const draft={...suggestion(),when:"  Cuando pide factura  "};const ready=prepareSuggestions([draft],source,[destination],[]);expect(ready.issues).toEqual([]);expect(ready.suggestions).toEqual([{id:draft.id,destinationDefinitionId:destination.definitionId,mode:"Assistant",when:"Cuando pide factura",isActive:true,conditions:[],mappings:[]}]);expect(draft.when).toBe("  Cuando pide factura  ");});
it("requires When only for Assistant and limits the original text without inventing translations",()=>{const draft=suggestion();expect(prepareSuggestions([{...draft,when:"  "}],source,[destination],[]).issues).toContainEqual({path:"suggestions.0.when",key:"required"});expect(prepareSuggestions([{...draft,when:"x".repeat(1001)}],source,[destination],[]).issues).toContainEqual({path:"suggestions.0.when",key:"tooLong"});expect(prepareSuggestions([{...draft,mode:"Always",when:" "}],source,[destination],[]).suggestions[0].when).toBeNull();});
it("maps only matching field types and maps a record number to text without a fabricated question",()=>{expect(mappingTargets({kind:"Field",fieldId:"number"},source.questions,destination.questions).map(field=>field.fieldId)).toEqual(["target-number"]);expect(mappingTargets({kind:"RecordNumber",fieldId:null},source.questions,destination.questions).map(field=>field.fieldId)).toEqual(["target-text","target-long"]);expect(mappingTargets({kind:"Field",fieldId:"photo"},source.questions,[field("target-photo","photo")])).toEqual([]);});
it("offers choice mappings only between questions backed by the same catalog",()=>{
  const choice=(fieldId:string,catalog:string|null)=>({fieldId,type:"choice" as const,label:{es:fieldId},source:catalog?{catalog}:null});
  const origin=choice("source-choice","shared-catalog");
  const targets=[choice("same-catalog","shared-catalog"),choice("other-catalog","another-catalog"),choice("manual-options",null)];
  expect(mappingTargets({kind:"Field",fieldId:origin.fieldId},[origin],targets).map(question=>question.fieldId)).toEqual(["same-catalog"]);
  expect(mappingTargets({kind:"Field",fieldId:"manual-source"},[choice("manual-source",null)],targets)).toEqual([]);
});
it.each(["another-catalog",null])("marks a choice mapping from an incompatible catalog %s on the source control",catalog=>{
  const origin={fieldId:"source-choice",type:"choice" as const,label:{es:"Origen"},source:{catalog:"shared-catalog"}};
  const target={fieldId:"target-choice",type:"choice" as const,label:{es:"Destino"},source:catalog?{catalog}:null};
  const draft={...suggestion(),mappings:[{source:{kind:"Field" as const,fieldId:origin.fieldId},destinationFieldId:target.fieldId}]};
  expect(prepareSuggestions([draft],{...source,questions:[origin]},[{...destination,questions:[target]}],[]).issues).toEqual([{path:"suggestions.0.mappings.0.source",key:"incompatible"}]);
});
it("marks retired destinations, mismatched mappings and repeated target questions beside their fields",()=>{const draft={...suggestion(),mappings:[{source:{kind:"Field" as const,fieldId:"number"},destinationFieldId:"target-text"},{source:{kind:"RecordNumber" as const,fieldId:null},destinationFieldId:"target-text"}]};expect(prepareSuggestions([draft],source,[destination],[]).issues).toEqual(expect.arrayContaining([{path:"suggestions.0.mappings.0.destinationFieldId",key:"incompatible"},{path:"suggestions.0.mappings.1.destinationFieldId",key:"duplicateTarget"}]));expect(prepareSuggestions([suggestion()],source,[],[]).issues).toContainEqual({path:"suggestions.0.destinationDefinitionId",key:"destinationUnavailable"});});
it("validates optional conditions against the published source using the shared grammar",()=>{const draft={...suggestion(),conditions:[{fieldId:"number",operator:"gte",values:["12,5"]}]};const columns=[{fieldId:"number",type:"decimal" as const,label:"Bultos",introducedInVersion:1,options:[]}];expect(prepareSuggestions([draft],source,[destination],columns).suggestions[0].conditions).toEqual([{fieldId:"number",operator:"gte",values:["12.5"]}]);expect(prepareSuggestions([{...draft,conditions:[{fieldId:"number",operator:"gte",values:["-"]}]}],source,[destination],columns).issues).toContainEqual({path:"suggestions.0.conditions",key:"invalidConditions"});});

it("keeps the explanation in the local draft but sends no inactive AI instruction in Always mode",()=>{const draft={...suggestion(),mode:"Always" as const,when:"Mi explicación conservada"};expect(prepareSuggestions([draft],source,[destination],[]).suggestions[0].when).toBeNull();expect(draft.when).toBe("Mi explicación conservada");});

it("normalizes bracket field errors and resolves the first control to its stable suggestion identity",()=>{const draft={...suggestion(),mappings:[{source:{kind:"RecordNumber" as const,fieldId:null},destinationFieldId:"target-text"}]};const result=suggestionFieldErrors({"suggestions[0].mappings[0].source.kind":["Origen inválido"],"unknown.path":["Dato no reconocido"]},[draft]);expect(result.errors["suggestions.0.mappings.0.source"]).toEqual(["Origen inválido"]);expect(result.errors["unknown.path"]).toEqual(["Dato no reconocido"]);expect(result.firstSuggestionId).toBe(draft.id);expect(result.firstPath).toBe("suggestions.0.mappings.0.source");});


it("never maps a multiple-choice source or target, even when both use the same catalog", () => {
  const choice = (fieldId: string) => ({ fieldId, type: "choice" as const, label: { es: fieldId }, source: { catalog: "same-catalog" } });
  const multiple = (fieldId: string) => ({ ...choice(fieldId), type: "multiChoice" as const, selection: { minSelected: 0, maxSelected: 3 } });
  const sources = [multiple("multi-source"), choice("single-source")];
  const targets = [multiple("multi-target"), choice("single-target")];
  expect(mappingTargets({ kind: "Field", fieldId: "multi-source" }, sources, targets)).toEqual([]);
  expect(mappingTargets({ kind: "Field", fieldId: "single-source" }, sources, targets).map(question => question.fieldId)).toEqual(["single-target"]);
  const draft = { ...suggestion(), mappings: [{ source: { kind: "Field" as const, fieldId: "multi-source" }, destinationFieldId: "multi-target" }] };
  expect(prepareSuggestions([draft], { ...source, questions: sources }, [{ ...destination, questions: targets }], []).issues)
    .toContainEqual({ path: "suggestions.0.mappings.0.destinationFieldId", key: "incompatible" });
});
