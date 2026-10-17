import {httpCohort} from "@/test/httpCohort";
import {expect,it} from "vitest";
import {readFormCommit} from "./response";
it("reads the exact file draft saved by the real backend",()=>{
 const created=readFormCommit(httpCohort("formFiles").json("draft-created.json"));
 expect(created.definition.draft.fields.map(f=>f.type)).toEqual(["photo","document","photo"]);
 expect(created.definition.draft.fields[2]).toMatchObject({required:false,files:{minFiles:0,maxFiles:1}});
});
