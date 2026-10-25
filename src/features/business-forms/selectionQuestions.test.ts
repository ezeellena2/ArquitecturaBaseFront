import { expect, it } from "vitest";
import { changeQuestionMultiplicity, hasInvalidSelectionCounts, validSelectionCounts } from "./selectionQuestions";
import type { DraftQuestion } from "./model";
const saved: Extract<DraftQuestion, { type: "choice" }> = {
 localId:"old-local",fieldId:"saved-field",replacesFieldId:null,type:"choice",
 label:{es:"Fallas",en:"Issues"},help:{es:"Elegí",en:"Choose"},required:true,
 options:[{localId:"a",choiceId:"saved-a",label:{es:"Frío",en:"Cold"}},{localId:"b",choiceId:"saved-b",label:{es:"Ruido",en:"Noise"}}],
};
it("creates a new field and new own-choice identities without dropping text, order or translations",()=>{
 let sequence=0;
 const next=changeQuestionMultiplicity(saved,true,"new-field",()=>"new-option-"+ ++sequence);
 expect(next).toMatchObject({type:"multiChoice",localId:"new-field",fieldId:null,replacesFieldId:"saved-field",label:saved.label,help:saved.help,required:true,selection:{minSelected:1,maxSelected:3}});
 if(next.source) throw new Error("Expected authored options.");
 expect(next.options.map(option=>[option.localId,option.choiceId,option.label])).toEqual([["new-option-1",null,saved.options![0]!.label],["new-option-2",null,saved.options![1]!.label]]);
 expect(saved.fieldId).toBe("saved-field");
});
it("keeps a new unsaved question local and does not materialize options for a catalog",()=>{
 const catalog={...saved,fieldId:null,replacesFieldId:"retired",source:{catalog:"catalog-id"},options:null} as Extract<DraftQuestion,{type:"choice"}>;
 const next=changeQuestionMultiplicity(catalog,true,"unused",()=>{throw new Error("No own options.");});
 expect(next).toMatchObject({localId:"old-local",fieldId:null,replacesFieldId:"retired",type:"multiChoice",source:{catalog:"catalog-id"}});
 expect(next).not.toHaveProperty("options");
});
it.each([{minSelected:null,maxSelected:3},{minSelected:0,maxSelected:null},{minSelected:0,maxSelected:0},{minSelected:2,maxSelected:1},{minSelected:1,maxSelected:21},{minSelected:1.5,maxSelected:3}])("keeps invalid editable bounds instead of normalizing them: %j",selection=>{
 expect(validSelectionCounts(selection)).toBe(false);
});
it.each([{minSelected:0,maxSelected:1},{minSelected:1,maxSelected:3},{minSelected:20,maxSelected:20}])("accepts the closed server bounds: %j",selection=>{
 expect(validSelectionCounts(selection)).toBe(true);
});

it("rejects an impossible own-choice minimum but allows a larger maximum and defers dynamic catalog quantity to sending",()=>{
 const own={...saved,type:"multiChoice" as const,selection:{minSelected:3,maxSelected:3}};
 expect(hasInvalidSelectionCounts([own])).toBe(true);
 expect(hasInvalidSelectionCounts([{...own,selection:{minSelected:1,maxSelected:20}}])).toBe(false);
 const {options:discarded,...catalog}=own;
 expect(discarded).toHaveLength(2);
 expect(hasInvalidSelectionCounts([{...catalog,source:{catalog:"catalog-id"},selection:{minSelected:20,maxSelected:20}}])).toBe(false);
});
it("checks only what the editor marks in the range and leaves the own option count to the server, as for a single choice",()=>{
 const own={...saved,type:"multiChoice" as const,required:false,selection:{minSelected:0,maxSelected:3}};
 expect(hasInvalidSelectionCounts([{...own,options:[]}])).toBe(false);
 expect(hasInvalidSelectionCounts([{...own,options:Array.from({length:21},(_,index)=>({localId:"o"+index,choiceId:null,label:{es:"Opción "+index}}))}])).toBe(false);
 expect(hasInvalidSelectionCounts([{...own,options:[],selection:{minSelected:null,maxSelected:3}}])).toBe(true);
 expect(hasInvalidSelectionCounts([{...own,required:true,options:[],selection:{minSelected:1,maxSelected:3}}])).toBe(true);
});

it("keeps a no-op unchanged and removes the range when switching an unsaved multi question back", () => {
  expect(changeQuestionMultiplicity(saved, false, "unused", () => "unused")).toBe(saved);
  const created = changeQuestionMultiplicity(saved, true, "new-field", () => crypto.randomUUID());
  const back = changeQuestionMultiplicity(created, false, "unused", () => { throw new Error("Already local."); });
  expect(back.type).toBe("choice");
  expect(back.localId).toBe(created.localId);
  expect(back.replacesFieldId).toBe(saved.fieldId);
  expect(back).not.toHaveProperty("selection");
});
