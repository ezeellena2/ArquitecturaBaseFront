import {httpCohort} from "@/test/httpCohort";
import {http,HttpResponse} from "msw";
import {describe,it,expect} from "vitest";
import {server} from "@/test/mocks/server";
import {getThread,type Thread} from "./chat";
import {parseChatForms,parseChatFormPreparation} from "./forms";
const cohort=httpCohort("whatsappCatalogs");
const raw=(culture:string,name:string)=>cohort.bytes(culture+"/"+name+".json").toString("utf8");
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
  it("reads the recipient block with the data the person lacks, without receiving options or private values",()=>{
    const captured=json(culture,"preparation-recipient-data-missing");
    const prepared=parseChatFormPreparation(captured);
    expect(prepared).toEqual(captured);
    expect(prepared.culture).toBe(culture);
    expect(prepared.preparation.canSend).toBe(false);
    expect(prepared.preparation.catalogs).toEqual([]);
    expect(prepared.preparation.issues).toHaveLength(1);
    expect(prepared.preparation.issues[0]).toMatchObject({code:"Forms.Record.RecipientDataMissing",label:culture==="es"?"Proveedor":"Supplier",catalogName:null,invalidOptionCount:null,missingData:culture==="es"?"Zona":"Zone"});
    expect(Object.keys(prepared.preparation).sort()).toEqual(["canSend","catalogs","issues"]);
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
it("verifies all twenty-eight exact catalog chat captures from the common run",()=>{
 const provenance=cohort.verify();
 expect(provenance.captures).toHaveLength(28);
 expect(provenance.sources.some(source=>source.path.endsWith("WhatsAppFormReplyAppPreviewTests.cs"))).toBe(true);
 expect(provenance.sources.some(source=>source.path.endsWith("WhatsAppCatalogRecipientSendingTests.cs"))).toBe(true);
 expect(provenance.captures.map(entry=>entry.name).sort()).toEqual(["es/choices.json","es/preparation.json","es/reply-completed.json","es/reply-reloaded.json","es/reply-without-read.json","es/reply-rejected.json","es/reply-pending.json","es/reply-unrecognized.json","es/reply-inbox-read.json","es/reply-inbox-without-read.json","es/reply-latest-page.json","es/reply-older-page.json","es/reply-all-states.json","en/choices.json","en/preparation.json","en/reply-completed.json","en/reply-reloaded.json","en/reply-without-read.json","en/reply-rejected.json","en/reply-pending.json","en/reply-unrecognized.json","en/reply-inbox-read.json","en/reply-inbox-without-read.json","en/reply-latest-page.json","en/reply-older-page.json","en/reply-all-states.json","es/preparation-recipient-data-missing.json","en/preparation-recipient-data-missing.json"].sort());
});
