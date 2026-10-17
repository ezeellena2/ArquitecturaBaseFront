import { expect,it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { fetchFormSuggestions,fetchSuggestionHistory,fetchSuggestionOptions,fetchSuggestionRevision,readSuggestionOptions,readSuggestionSet,saveFormSuggestions } from "./suggestions";
it("reads immutable suggestion versions and original-only instructions from unchanged backend bytes",()=>{
  const cohort=httpCohort("suggestions");const provenance=cohort.verify();expect(provenance.sources.some(source=>source.path.endsWith("FormSuggestionHttpTests.cs"))).toBe(true);
  const empty=readSuggestionSet(cohort.json("empty-es.json"));expect(empty.revision).toBe(0);expect(empty.sourceVersionId).toBeNull();
  const saved=readSuggestionSet(cohort.json("saved-es.json"));expect(saved.revision).toBe(1);expect(saved.sourceVersionId).not.toBeNull();expect(saved.suggestions[0].when).toBe("Cuando pida la factura");expect(saved.suggestions[0].mappings[0].source).toEqual({kind:"RecordNumber",fieldId:null});expect(readSuggestionSet(cohort.json("revision-es.json"))).toEqual(saved);
  for(const culture of ["es","en"]){const options=readSuggestionOptions(cohort.json("options-"+culture+".json"));expect(options.source.definitionId).toBe(saved.definitionId);expect(options.source.versionId).toBe(saved.sourceVersionId);expect(options.destinations.some(destination=>destination.versionId===saved.suggestions[0].destinationVersionId)).toBe(true);}
});
it("passes raw configuration, options, history and fixed revisions through real HTTP adapters",async()=>{
  const cohort=httpCohort("suggestions");const saved=readSuggestionSet(cohort.json("saved-es.json"));const path="/api/forms/definitions/"+saved.definitionId+"/suggestions";
  server.use(http.get(path,()=>cohort.response("saved-es.json")),http.get(path+"/options",()=>cohort.response("options-es.json")),http.get(path+"/revisions",()=>cohort.response("history-es.json")),http.get(path+"/revisions/1",()=>cohort.response("revision-es.json")),http.post(path,()=>cohort.response("saved-es.json",201)));
  expect(await fetchFormSuggestions(saved.definitionId)).toEqual(saved);expect(await fetchSuggestionOptions(saved.definitionId)).toEqual(readSuggestionOptions(cohort.json("options-es.json")));expect(await fetchSuggestionHistory(saved.definitionId,1)).toEqual(cohort.json("history-es.json"));expect(await fetchSuggestionRevision(saved.definitionId,1)).toEqual(saved);
  const input=saved.suggestions.map(row=>({id:row.id,destinationDefinitionId:row.destinationDefinitionId,mode:row.mode,when:row.when,isActive:row.isActive,conditions:row.conditions,mappings:row.mappings}));expect(await saveFormSuggestions(saved.definitionId,{expectedRevision:0,suggestions:input})).toEqual(saved);
});
it("keeps the exported conflict and unpublished-source states distinct",async()=>{
  const cohort=httpCohort("suggestions");const saved=readSuggestionSet(cohort.json("saved-es.json"));const path="/api/forms/definitions/"+saved.definitionId+"/suggestions";
  server.use(http.post(path,()=>cohort.response("conflict-es.json",409)),http.get(path+"/options",()=>cohort.response("source-unpublished-es.json",409)));
  await expect(saveFormSuggestions(saved.definitionId,{expectedRevision:0,suggestions:[]})).rejects.toMatchObject({status:409,code:"Forms.Suggestion.RevisionConflict"});await expect(fetchSuggestionOptions(saved.definitionId)).rejects.toMatchObject({status:409,code:"Forms.Suggestion.SourceNotPublished"});
});
