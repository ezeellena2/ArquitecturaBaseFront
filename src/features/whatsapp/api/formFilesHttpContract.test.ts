import {httpCohort} from "@/test/httpCohort";
import {expect,it} from "vitest";
import {http,HttpResponse} from "msw";
import {server} from "@/test/mocks/server";
import {getThread,type Thread} from "./chat";
const cohort=httpCohort("formFiles");
const raw=(name:string)=>cohort.bytes(name+".json").toString("utf8");
it("consumes the exact real draft and reply HTTP bodies exported with PostgreSQL and Azurite",async()=>{
 for(const [name,state,allowed] of [["reply-completed","Completed",true],["reply-reloaded","Completed",true],["reply-downloading","Downloading",true],["reply-without-read","Completed",false]] as const){
  const body=raw(name);const original=JSON.parse(body) as Thread;
  server.use(http.get(`/api/whatsapp/chats/${original.contact.id}/messages`,()=>new HttpResponse(body,{headers:{"content-type":"application/json"}})));
  const thread=await getThread(original.contact.id);const reply=thread.messages.find(m=>m.kind==="FlowReply")?.formReply;
  expect(reply?.state).toBe(state);
  if(reply?.state==="Completed"){
   expect(reply.values!==null).toBe(allowed);
   if(allowed){expect(reply.values?.map(v=>v.type)).toEqual(["photo","document","photo"]);expect(JSON.stringify(reply.values)).toContain("obra.jpg");}
  }else expect(reply?.values).toBeNull();
  expect(reply?.fileCount).toBe(2);expect(reply?.receivedAtUtc).toEqual(expect.any(String));
  if(reply?.state==="Completed"&&allowed)expect(reply.values?.[2]?.value).toEqual([]);
  expect(body).not.toContain("storageKey");expect(body).not.toContain("responses/");
 }
});
it("verifies all five exact file captures from the common run",()=>{
 const provenance=cohort.verify();
 expect(provenance.sources.some(source=>source.path.endsWith("WhatsAppFormFilesIntegrationTests.cs"))).toBe(true);
 expect(provenance.captures.map(entry=>entry.name).sort()).toEqual(["draft-created.json","reply-completed.json","reply-reloaded.json","reply-downloading.json","reply-without-read.json"].sort());
});
