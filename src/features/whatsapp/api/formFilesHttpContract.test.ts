import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {expect,it} from "vitest";
import {http,HttpResponse} from "msw";
import {server} from "@/test/mocks/server";
import {getThread,type Thread} from "./chat";
const directory=resolve(process.env.FORM_FILES_HTTP_INPUT??"src/test/fixtures/form-files-http");
const raw=(name:string)=>readFileSync(resolve(directory,name+".json"),"utf8");
it("consumes the exact real draft and reply HTTP bodies exported with PostgreSQL and Azurite",async()=>{
 for(const [name,state,allowed] of [["reply-completed","Completed",true],["reply-reloaded","Completed",true],["reply-downloading","Downloading",true],["reply-without-read","Completed",false]] as const){
  const body=raw(name);const original=JSON.parse(body) as Thread;
  server.use(http.get(`/api/whatsapp/chats/${original.contact.id}/messages`,()=>new HttpResponse(body,{headers:{"content-type":"application/json"}})));
  const thread=await getThread(original.contact.id);const reply=thread.messages.find(m=>m.kind==="FlowReply")?.formReply;
  expect(reply?.state).toBe(state);
  if(reply?.state==="Completed"){
   expect(reply.values!==null).toBe(allowed);
   if(allowed){expect(reply.values?.map(v=>v.type)).toEqual(["photo","document"]);expect(JSON.stringify(reply.values)).toContain("obra.jpg");}
  }else expect(reply?.values).toBeNull();
  expect(body).not.toContain("storageKey");expect(body).not.toContain("responses/");
 }
});
it("preserves the provenance and exact producer bytes",()=>{
 const provenance=JSON.parse(raw("provenance")) as {captures:{name:string;length:number;sha256:string}[]};
 expect(provenance.captures.length).toBe(5);
 for(const capture of provenance.captures){const bytes=readFileSync(resolve(directory,capture.name));expect(bytes.length).toBe(capture.length);expect(createHash("sha256").update(bytes).digest("hex")).toBe(capture.sha256);}
});
