import {expect,it} from "vitest";
import {http} from "msw";
import {z} from "zod";
import {httpCohort} from "@/test/httpCohort";
import {server} from "@/test/mocks/server";
import {getThread} from "./chat";
import {parseAssistantSuggestion,requestAssistantSuggestion,getAssistantSuggestion,sendAssistantSuggestion} from "./assistant";
const contactFrom=(body:unknown)=>z.object({contact:z.object({id:z.string().uuid()})}).parse(body).contact.id;
const requiredNames=[
 "suggestion-pending.json","suggestion-ready.json","suggestion-no-reply.json","suggestion-blocked.json","suggestion-discarded.json","suggestion-sent.json",
 "send-receipt.json","thread.json","thread-restricted.json","suggestion-always-ready.json","thread-always-ready.json","always-send-receipt.json",
];
it("qualifies all six manual states and the durable original operator receipt from unchanged C3 bytes",()=>{
 const cohort=httpCohort("whatsappAssistant");const provenance=cohort.verify();
 expect(provenance.captures.map(item=>item.name).sort()).toEqual([...requiredNames].sort());
 for(const source of ["WhatsAppAssistantHttpTests.cs","WhatsAppAssistantHttpTests.Suggestions.cs","WhatsAppAssistantCaptureFixture.cs","CapturingStructuredRecordPort.cs"])
  expect(provenance.sources.some(item=>item.path.endsWith(source)),source).toBe(true);
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
it("reads and confirms the authoritative Always flow receipt with no model proposal while AI is not installed",async()=>{
 const cohort=httpCohort("whatsappAssistant");const contactId=contactFrom(cohort.json("thread-always-ready.json"));
 const ready=parseAssistantSuggestion(cohort.json("suggestion-always-ready.json"),contactId);
 const path="/api/whatsapp/chats/"+contactId+"/assistant-suggestions/"+ready.requestId;
 let sendBody:unknown;
 server.use(
  http.get("/api/whatsapp/chats/"+contactId+"/messages",()=>cohort.response("thread-always-ready.json")),
  http.get(path,()=>cohort.response("suggestion-always-ready.json")),
  http.post(path+"/send",async({request})=>{sendBody=await request.json();return cohort.response("always-send-receipt.json",202);}),
 );
 const thread=await getThread(contactId);
 expect(thread.assistantAvailability.state).toBe("notInstalled");
 expect(thread.assistantSuggestion).toEqual({requestId:ready.requestId,sourceMessageId:ready.sourceMessageId,state:"Ready"});
 const source=thread.messages.find(message=>message.id===ready.sourceMessageId);
 expect(source?.kind).toBe("FlowReply");expect(source?.body).toBeNull();expect(source?.formReply?.state).toBe("Completed");
 expect(await getAssistantSuggestion(contactId,ready.requestId)).toEqual(ready);
 expect(ready.proposal?.proposalId).toBeNull();expect(ready.proposal?.fields).not.toHaveLength(0);
 const request={requestId:crypto.randomUUID(),includedFieldIds:ready.proposal!.fields.map(field=>field.fieldId)};
 const receipt=await sendAssistantSuggestion(contactId,ready.requestId,request);
 expect(sendBody).toEqual(request);expect(receipt).toEqual(cohort.json("always-send-receipt.json"));
 expect(receipt.origin).toBe("Conversation");expect(receipt.operatorUserId).toBeTruthy();
 expect(receipt.assistant?.proposedFields).toEqual(ready.proposal?.fields);
 expect(receipt.assistant?.reason).toBe(ready.proposal?.reason);
});
