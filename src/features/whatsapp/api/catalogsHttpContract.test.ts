import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {http,HttpResponse} from "msw";
import {describe,it,expect} from "vitest";
import {server} from "@/test/mocks/server";
import {getThread,type Thread} from "./chat";
import {parseChatForms,parseChatFormPreparation} from "./forms";
const root=resolve("src/test/fixtures/whatsapp-catalogs-http");
const raw=(culture:string,name:string)=>readFileSync(resolve(root,culture,name+".json"),"utf8");
const json=(culture:string,name:string):unknown=>JSON.parse(raw(culture,name));
for(const culture of ["es","en"])describe("captured catalog HTTP "+culture,()=>{
  it("reads the recipient preparation and the matching selection without invented fields",()=>{
    const prepared=parseChatFormPreparation(json(culture,"preparation"));
    const choices=parseChatForms(json(culture,"choices"));
    expect(prepared.culture).toBe(culture);
    expect(prepared.recipientContextRevision).toBe(choices.recipientContextRevision);
    expect(prepared.preparation.canSend).toBe(true);
    expect(choices.page.items.some(option=>option.hasCatalogQuestions)).toBe(true);
    expect(prepared.preparation.catalogs[0]).toMatchObject({count:1});
    expect(Object.keys(prepared.preparation.catalogs[0]).sort()).toEqual(["count","fieldId","label"]);
  });
  it("preserves the historical reference after reload and hides it without record permission",async()=>{
    for(const name of ["reply-completed","reply-reloaded","reply-without-read"]){
      const original=JSON.parse(raw(culture,name)) as Thread;
      server.use(http.get("/api/whatsapp/chats/:id/messages",()=>new HttpResponse(raw(culture,name),{headers:{"Content-Type":"application/json"}})));
      const parsed=await getThread(original.contact.id);
      const card=parsed.messages.find(message=>message.formReply?.state==="Completed")!.formReply!;
      expect(card.state).toBe("Completed");
      if(card.state!=="Completed")throw new Error("Missing captured receipt.");
      if(name==="reply-without-read")expect(card.values).toBeNull();
      else expect(card.values!.find(row=>row.type==="choice")!.value).toMatchObject({label:"Pérez Hnos.",catalogName:culture==="es"?"Clientes":"Customers",detail:"Av. Colón 1234"});
    }
  });
  it("reads the safe inactive-option notice without a record number or selected value",async()=>{
    const original=JSON.parse(raw(culture,"reply-rejected")) as Thread;
    server.use(http.get("/api/whatsapp/chats/:id/messages",()=>new HttpResponse(raw(culture,"reply-rejected"),{headers:{"Content-Type":"application/json"}})));
    const parsed=await getThread(original.contact.id);
    const rejected=parsed.messages.find(message=>message.formReply?.state==="Rejected")!.formReply!;
    expect(rejected).toMatchObject({state:"Rejected",rejectionCode:"Forms.Record.CatalogItemInactive",rejectedQuestion:culture==="es"?"Tipo":"Type",values:null,recordId:null,number:null});
    expect(JSON.stringify(rejected)).not.toContain("Pérez Hnos.");
  });
});
it("keeps all exported HTTP bytes and their automatically generated provenance",()=>{
  const provenance=JSON.parse(readFileSync(resolve(root,"provenance.json"),"utf8")) as {captures:{name:string;length:number;sha256:string}[]};
  expect(provenance.captures.length).toBeGreaterThan(0);
  for(const capture of provenance.captures){const bytes=readFileSync(resolve(root,capture.name));expect(bytes.length).toBe(capture.length);expect(createHash("sha256").update(bytes).digest("hex")).toBe(capture.sha256);}
});
