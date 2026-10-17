import type { CanonicalChoice, CanonicalQuestion, LocalizedText } from "./model";
import { normalizeResponseQuery, type ResponseColumn, type ResponseCondition } from "./responses";
export type SuggestionMode = "Assistant" | "Always";
export interface SuggestionMapping { readonly source: { readonly kind: "Field" | "RecordNumber"; readonly fieldId: string | null }; readonly destinationFieldId: string }
export interface FormSuggestion { readonly id: string; readonly destinationDefinitionId: string; readonly destinationVersionId: string | null; readonly mode: SuggestionMode; readonly when: string | null; readonly isActive: boolean; readonly conditions: readonly ResponseCondition[]; readonly mappings: readonly SuggestionMapping[] }
export type FormSuggestionInput = Omit<FormSuggestion, "destinationVersionId">;
export interface SuggestionQuestion { readonly fieldId:string; readonly type:CanonicalQuestion["type"]; readonly label:LocalizedText; readonly options?:readonly CanonicalChoice[]|null }
export interface PublishedSuggestionForm { readonly definitionId: string; readonly versionId: string; readonly name: Readonly<Record<string, string>>; readonly originalCulture: "es" | "en"; readonly questions: readonly SuggestionQuestion[] }
export interface SuggestionIssue { readonly path: string; readonly key: string }
export const newSuggestion = (): FormSuggestion => ({ id: crypto.randomUUID(), destinationDefinitionId: "", destinationVersionId: null, mode: "Assistant", when: null, isActive: true, conditions: [], mappings: [] });
export function mappingTargets(source: SuggestionMapping["source"], questions: readonly SuggestionQuestion[], destination: readonly SuggestionQuestion[]): readonly SuggestionQuestion[] {
  if(source.kind==="RecordNumber") return destination.filter(field=>field.type==="shortText"||field.type==="longText");
  const field=questions.find(field=>field.fieldId===source.fieldId);
  return !field||field.type==="photo"||field.type==="document"?[]:destination.filter(target=>target.type===field.type);
}
export function prepareSuggestions(suggestions: readonly FormSuggestion[], source: PublishedSuggestionForm, destinations: readonly PublishedSuggestionForm[], columns: readonly ResponseColumn[]) {
  const issues: SuggestionIssue[]=[];
  if(suggestions.length>20) issues.push({path:"suggestions",key:"tooMany"});
  const prepared=suggestions.map((suggestion,index):FormSuggestionInput=>{
    const path="suggestions."+index;
    const destination=destinations.find(form=>form.definitionId===suggestion.destinationDefinitionId);
    if(!destination)issues.push({path:path+".destinationDefinitionId",key:"destinationUnavailable"});
    const when=suggestion.mode==="Always"?null:suggestion.when?.trim()||null;
    if(suggestion.mode==="Assistant"&&!when)issues.push({path:path+".when",key:"required"});
    if(when&&when.length>1000)issues.push({path:path+".when",key:"tooLong"});
    const normalized=normalizeResponseQuery({page:1,pageSize:1,conditions:suggestion.conditions},columns);
    if(!normalized||suggestion.conditions.length>10||suggestion.conditions.some(condition=>!["answered","unanswered","notAsked"].includes(condition.operator)&&!condition.values?.some(value=>value.trim())))issues.push({path:path+".conditions",key:"invalidConditions"});
    if(suggestion.mappings.length>40)issues.push({path:path+".mappings",key:"tooMany"});
    const targets=new Set<string>();
    suggestion.mappings.forEach((mapping,position)=>{
      const mappingPath=path+".mappings."+position+".destinationFieldId";
      if(!mappingTargets(mapping.source,source.questions,destination?.questions??[]).some(field=>field.fieldId===mapping.destinationFieldId))issues.push({path:mappingPath,key:"incompatible"});
      if(targets.has(mapping.destinationFieldId))issues.push({path:mappingPath,key:"duplicateTarget"});
      targets.add(mapping.destinationFieldId);
    });
    return {id:suggestion.id,destinationDefinitionId:suggestion.destinationDefinitionId,mode:suggestion.mode,when,isActive:suggestion.isActive,conditions:normalized?.conditions??suggestion.conditions,mappings:suggestion.mappings};
  });
  return {suggestions:prepared,issues};
}

export function suggestionFieldErrors(source:Readonly<Record<string,readonly string[]>>,suggestions:readonly FormSuggestion[]) {
  const errors:Record<string,string[]>={};
  for(const [key,messages] of Object.entries(source)) {
    const dotted=/^suggestions(?:\[|\.)/.test(key)?key.replace(/\[(\d+)\]/g,".$1"):key;
    const path=dotted.replace(/^(suggestions\.\d+\.mappings\.\d+\.source)\.(?:kind|fieldId)$/,"$1");
    errors[path]=[...(errors[path]??[]),...messages];
  }
  const fields=suggestions.flatMap((row,index)=>{const path="suggestions."+index;return [path+".destinationDefinitionId",path+".mode",...(row.mode==="Assistant"?[path+".when"]:[]),path+".conditions",path+".mappings",...row.mappings.flatMap((_,position)=>[path+".mappings."+position+".source",path+".mappings."+position+".destinationFieldId"])];});
  const firstPath=Object.keys(errors).find(path=>errors[path].length>0&&fields.includes(path))??null;
  const index=firstPath?/^suggestions\.(\d+)\./.exec(firstPath)?.[1]:undefined;
  return {errors,fields,firstPath,firstSuggestionId:index===undefined?null:suggestions[Number(index)]?.id??null};
}
