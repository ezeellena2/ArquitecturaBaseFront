import {expect,it} from "vitest";
import {missingFormInitial} from "./missingFormSeed";
const scope={actorId:"actor",culture:"en" as const,permissions:["formtemplates.read","formtemplates.manage"]};
const seed={formSeed:{ownerActorId:"actor",name:"Reclamos",originalCulture:"es"}};
it("seeds only the topic's original name into a normal new bilingual editor",()=>{const value=missingFormInitial(scope,"",seed);expect(value.name).toEqual({es:"Reclamos"});expect(value.draft.culture).toBe("es");expect(value.offerWhen).toBeNull();expect(value.draft.fields).toEqual([]);expect(value.prefix).toBe("");});
it.each([{...seed,formSeed:{...seed.formSeed,ownerActorId:"other"}},{...seed,formSeed:{...seed.formSeed,originalCulture:"fr"}},{...seed,formSeed:{...seed.formSeed,name:" "}},{...seed,formSeed:{...seed.formSeed,name:"a".repeat(121)}}])("ignores foreign or malformed navigation seeds",state=>{expect(missingFormInitial(scope,"",state).name).toEqual({en:""});});
it("never applies a navigation seed to an existing form",()=>{expect(missingFormInitial(scope,"existing",seed).name).toEqual({en:""});});
