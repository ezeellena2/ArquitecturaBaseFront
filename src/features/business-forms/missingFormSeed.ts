import {z} from "zod";
import {emptyForm} from "./editorModel";
import type {FormReadScope} from "./hooks/useFormQueries";
const seed=z.strictObject({formSeed:z.strictObject({ownerActorId:z.string(),name:z.string().trim().min(1).max(120)})});
export function missingFormInitial(scope:FormReadScope,formId:string,state:unknown){
 const parsed=seed.safeParse(state);
 if(formId||!scope.actorId||!parsed.success||parsed.data.formSeed.ownerActorId!==scope.actorId)return emptyForm(scope.culture);
 // A new form is written in the menu language, its original, whatever the topic's language.
 return {...emptyForm(scope.culture),name:{[scope.culture]:parsed.data.formSeed.name}};
}
