import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {expect,it} from "vitest";
import {readFormCommit} from "./response";
it("reads the exact file draft saved by the real backend",()=>{
 const directory=resolve(process.env.FORM_FILES_HTTP_INPUT??"src/test/fixtures/form-files-http");
 const created=readFormCommit(JSON.parse(readFileSync(resolve(directory,"draft-created.json"),"utf8")) as unknown);
 expect(created.definition.draft.fields.map(f=>f.type)).toEqual(["photo","document"]);
});
