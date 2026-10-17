import {expect,it} from "vitest";
import {http} from "msw";
import {z} from "zod";
import {httpCohort} from "@/test/httpCohort";
import {server} from "@/test/mocks/server";
import {getThread} from "./chat";
import {parseAssistantSuggestion,requestAssistantSuggestion,getAssistantSuggestion,sendAssistantSuggestion} from "./assistant";
const contactFrom=(body:unknown)=>z.object({contact:z.object({id:z.string().uuid()})}).parse(body).contact.id;
it("qualifies all six manual states and the durable original operator receipt from unchanged C3 bytes",()=>{
 const cohort=httpCohort("whatsappAssistant");const provenance=cohort.verify();
 expect(provenance.sources.some(item=>item.path.endsWith("WhatsAppAssistantHttpTests.cs"))).toBe(true);
 const contactId=contactFrom(cohort.json("thread.json"));
 for(const [name,state] of [["pending","Pending"],["ready","Ready"],["no-reply","NoReply"],["blocked","Blocked"],["discarded","Discarded"],["sent","Sent"]] as const){
  const parsed=parseAssistantSuggestion(cohort.json("suggestion-"+name+".json"),contactId);
  expect(parsed.state).toBe(state);expect(parsed.proposal!==null).toBe(state==="Ready");expect(parsed.outgoing!==null).toBe(state==="Sent");
 }
 const ready=parseAssistantSuggestion(cohort.json("suggestion-ready.json"),contactId);
 const sent=parseAssistantSuggestion(cohort.json("suggestion-sent.json"),contactId);
 expect(sent.requestId).toBe(ready.requestId);expect(sent.sourceMessageId).toBe(ready.sourceMessageId);
 expect(sent.outgoing).toEqual(cohort.json("send-receipt.json"));
 expect(sent.outgoing?.origin).toBe("Conversation");expect(sent.outgoing?.operatorUserId).toBeTruthy();
 expect(sent.outgoing?.assistant?.proposedFields).toEqual(ready.proposal?.fields);
});
it("passes original request, preview, send, shared result and private thread bytes through actual adapters",async()=>{
 const cohort=httpCohort("whatsappAssistant");const contactId=contactFrom(cohort.json("thread.json"));
 const pending=parseAssistantSuggestion(cohort.json("suggestion-pending.json"),contactId);
 const ready=parseAssistantSuggestion(cohort.json("suggestion-ready.json"),contactId);
 const path="/api/whatsapp/chats/"+contactId+"/assistant-suggestions";let current="suggestion-ready.json";let restricted=false;
 server.use(http.post(path,()=>cohort.response("suggestion-pending.json",202)),http.get(path+"/"+pending.requestId,()=>cohort.response(current)),http.post(path+"/"+pending.requestId+"/send",()=>cohort.response("send-receipt.json",202)),http.get("/api/whatsapp/chats/"+contactId+"/messages",()=>cohort.response(restricted?"thread-restricted.json":"thread.json")));
 expect(await requestAssistantSuggestion(contactId,{requestId:pending.requestId,sourceMessageId:pending.sourceMessageId,expectedModeRevision:0})).toEqual(pending);
 expect(await getAssistantSuggestion(contactId,pending.requestId)).toEqual(ready);
 const receipt=await sendAssistantSuggestion(contactId,pending.requestId,{requestId:crypto.randomUUID(),includedFieldIds:ready.proposal!.fields.map(field=>field.fieldId)});
 current="suggestion-sent.json";expect((await getAssistantSuggestion(contactId,pending.requestId)).outgoing).toEqual(receipt);
 const thread=await getThread(contactId);expect(thread.canReadFormRecords).toBe(true);
 const outbound=thread.messages.find(message=>message.direction==="Outbound"&&message.assistant!==null);
 expect(outbound?.assistant).toEqual(receipt.assistant);expect(outbound?.operatorUserId).toBe(receipt.operatorUserId);expect(outbound?.origin).toBe("Conversation");
 restricted=true;const hidden=await getThread(contactId);expect(hidden.canReadFormRecords).toBe(false);
 expect([...hidden.messages,...hidden.outgoing].every(item=>item.assistant===null)).toBe(true);
});
