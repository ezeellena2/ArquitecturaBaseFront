import {z} from "zod";
import {emptyForm} from "./editorModel";
import type {FormReadScope} from "./hooks/useFormQueries";
const seed=z.strictObject({formSeed:z.strictObject({ownerActorId:z.string(),name:z.string().trim().min(1).max(120),originalCulture:z.enum(["es","en"])})});
export function missingFormInitial(scope:FormReadScope,formId:string,state:unknown){
 const parsed=seed.safeParse(state);
 if(formId||!scope.actorId||!parsed.success||parsed.data.formSeed.ownerActorId!==scope.actorId)return emptyForm(scope.culture);
 const {name,originalCulture}=parsed.data.formSeed;
 return {...emptyForm(originalCulture),name:{[originalCulture]:name}};
}
