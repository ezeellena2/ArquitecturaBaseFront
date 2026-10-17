import type {Chat,Thread,Outgoing} from "@/features/whatsapp/api/chat";
import type {ChatFormOption} from "@/features/whatsapp/api/forms";
import type {FormMessageRequest} from "@/features/whatsapp/lib/formSendSession";
const guid=(n:number)=>"01990000-0000-7000-8000-"+String(n).padStart(12,"0");
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{"Content-Type":"application/json"}});
export function createChatFormFixtures(language:"es"|"en",scenario:string){
 const recipientCulture=scenario==="forms-chat-recipient-en"?"en":"es";
 const contact:Chat={id:guid(600),profileName:"Juan Gómez",phoneNumber:"+54 9 351 555-1234",mode:"Manual",modeRevision:7,lastInboundAtUtc:new Date().toISOString(),lastInboundSequence:1,unreadCount:0,preview:language==="es"?"Hola, ya terminé la visita.":"Hello, I finished the visit.",linkedAccount:{userId:guid(601),displayName:"Juan Gómez",email:"juan@example.com",isActive:true},formEligibility:{status:"Eligible",recipientCulture,recipientContextRevision:"fixture-context-1"}};
 if(scenario==="forms-chat-unlinked"){contact.linkedAccount=null;contact.formEligibility={status:"NoLinkedAccount",recipientCulture:null,recipientContextRevision:null};}
 if(scenario==="forms-chat-no-email")contact.linkedAccount!.email=null;
 if(scenario==="forms-chat-read"){contact.linkedAccount=null;contact.formEligibility=null;}
 const options:ChatFormOption[]=Array.from({length:9},(_,i)=>({definitionId:guid(620+i),versionId:guid(640+i),versionNumber:1,prefix:"VIS",name:{es:i===0?"Registrar visita":"Formulario "+(i+1),en:i===0?"Register visit":"Form "+(i+1)},questionCount:4,submitLabel:{es:"Confirmar visita",en:"Confirm visit"}}));
 const catalogScenario=scenario.startsWith("forms-chat-catalog");
 if(catalogScenario)options[0].hasCatalogQuestions=true;
 const offers=[{fieldId:guid(701),label:"Cliente",count:2},{fieldId:guid(710),label:"Supervisor",count:7}];
 const problem=scenario.endsWith("unavailable")?"CatalogUnavailable":scenario.endsWith("large")?"CatalogTooLarge":scenario.endsWith("empty")?"CatalogEmpty":undefined;
 const preparation={culture:recipientCulture,recipientContextRevision:"fixture-context-1",preparation:{catalogs:problem?[]:offers,
   issues:problem?[{fieldId:guid(701),label:"Cliente",code:"Forms.Record."+problem,catalogName:null,invalidOptionCount:null}]:[],canSend:!problem}};
 const thread:Thread={ assistantAvailability: { state: "notInstalled" },contact,messages:[{ origin: "Conversation" as const,id:guid(602),direction:"Inbound",kind:"Text",body:contact.preview,occurredAtUtc:contact.lastInboundAtUtc,inboundSequence:1,operatorUserId:null,status:null,errorCode:null,purpose:"Business"}],outgoing:[],beforeId:null,beforeAtUtc:null};
 if(catalogScenario&&["completed","no-values","inactive","inactive-read"].some(value=>scenario.endsWith(value))){
   const rejected=scenario.includes("inactive");
   const deniedValues=scenario.endsWith("no-values");
   thread.canReadFormRecords=!deniedValues;
   thread.messages.push({ origin: "Conversation" as const,id:guid(730),direction:"Inbound",kind:"FlowReply",body:null,occurredAtUtc:contact.lastInboundAtUtc,inboundSequence:2,
     operatorUserId:null,status:null,errorCode:null,purpose:"Business",formReply:rejected?
       {state:"Rejected",definitionId:options[0].definitionId,versionId:options[0].versionId,versionNumber:1,name:language==="es"?"Registrar visita":"Register visit",
        recordId:null,number:null,values:null,rejectionCode:"Forms.Record.CatalogItemInactive",rejectedQuestion:"Cliente"}:
       {state:"Completed",definitionId:options[0].definitionId,versionId:options[0].versionId,versionNumber:1,name:language==="es"?"Registrar visita":"Register visit",
        recordId:guid(731),number:"VIS-000031",values:deniedValues?null:[{fieldId:guid(701),key:"client",type:"choice",label:language==="es"?"Cliente":"Client",
         value:{choiceId:guid(703),label:"Pérez Hnos.",catalogId:guid(702),catalogName:"Clientes",detail:"Av. Colón 1234"}}]}});
 }
 if(scenario==="forms-chat-catalog-inactive-read"){contact.linkedAccount=null;contact.formEligibility=null;}
 if(scenario.startsWith("forms-chat-actions")){
  thread.canReadFormRecords=scenario!=="forms-chat-actions-no-values";contact.preview=language==="es"?"Acción del formulario":"Form action";
  for(const [index,kind] of (["Text","Document"] as const).entries())thread.messages.push({id:guid(750+index),direction:"Outbound",origin:"FormAction",kind,body:language==="es"?(index?"Se aprobó VIS-000024. Acá tenés tu comprobante.":"Recibimos VIS-000024."):(index?"VIS-000024 was approved. Here is your receipt.":"We received VIS-000024."),occurredAtUtc:contact.lastInboundAtUtc,inboundSequence:0,operatorUserId:null,status:"Delivered",errorCode:null,purpose:"Business"});
  thread.outgoing.push(...(["Uncertain","Failed"] as const).map((state,index)=>({id:guid(760+index),requestId:guid(770+index),operatorUserId:null,origin:"FormAction" as const,kind:"Text" as const,body:language==="es"?"Aviso de VIS-000024.":"Notice for VIS-000024.",requestedAtUtc:contact.lastInboundAtUtc,state,waMessageId:null})));
 }
 const attempts:FormMessageRequest[]=[];const calls:{method:string;path:string;search:string}[]=[];
 const makeReceipt=(request:FormMessageRequest):Outgoing=>{const option=options.find(value=>value.versionId===request.versionId)!;return {id:guid(610),requestId:request.requestId,operatorUserId:"visual-test",body:request.message.trim(),requestedAtUtc:new Date().toISOString(),state:"Pending",waMessageId:null,kind:"Flow",origin:"Conversation",recoveryPath:"/api/whatsapp/chats/"+contact.id+"/outgoing/"+request.requestId,form:{definitionId:option.definitionId,versionId:option.versionId,versionNumber:option.versionNumber,name:option.name,culture:recipientCulture}};};
 if(scenario==="forms-chat-states")for(const [i,state] of (["Failed","Uncertain","Reviewed"] as const).entries()){const r=makeReceipt({requestId:guid(680+i),definitionId:options[i].definitionId,versionId:options[i].versionId,expectedModeRevision:7,expectedRecipientContextRevision:"fixture-context-1",message:language==="es"?"Completá este formulario.":"Please complete this form."});thread.outgoing.push({...r,id:guid(690+i),state});}
 async function handle(request:Request){const url=new URL(request.url);const path=url.pathname;calls.push({method:request.method,path,search:url.search});
 if(path==="/api/whatsapp/chats")return json({page:{items:[contact],page:1,pageSize:20,totalPages:1,totalCount:1},allCount:1,unreadCount:0});
 if(path.endsWith("/read"))return new Response(null,{status:204});
 if(request.method==="GET"&&path.endsWith("/messages"))return json(thread);
 if(request.method==="GET"&&path.endsWith("/preparation"))return json(preparation);
 if(request.method==="GET"&&path.endsWith("/forms")){const search=(url.searchParams.get("search")??"").toLowerCase(),page=Number(url.searchParams.get("page")??1);const matching=options.filter(o=>o.name[recipientCulture].toLowerCase().includes(search));return json({page:{items:matching.slice((page-1)*4,page*4),page,pageSize:4,totalCount:matching.length,totalPages:Math.ceil(matching.length/4),hasPrevious:page>1,hasNext:page*4<matching.length},recipientCulture:contact.formEligibility!.recipientCulture,recipientContextRevision:contact.formEligibility!.recipientContextRevision});}
 if(request.method==="POST"&&path.endsWith("/form-messages")){const input=await request.json() as FormMessageRequest;attempts.push(input);if(scenario==="forms-chat-forbidden")return json({code:"General.Forbidden"},403);if(scenario==="forms-chat-conflict")return json({code:"WhatsApp.Flow.RecipientContextChanged"},409);if(scenario==="forms-chat-uncertain"&&attempts.length===1)throw new TypeError("Simulated lost HTTP response");const result=makeReceipt(input);thread.outgoing=[result];return json(result,202);}
 if(request.method==="GET"&&path.includes("/outgoing/"))return json({code:"WhatsApp.Chat.OutgoingNotFound"},404);
 if(request.method==="POST"&&path.endsWith("/review")){const requestId=path.split("/").at(-2)!;thread.outgoing=thread.outgoing.map(o=>o.requestId===requestId?{...o,state:"Reviewed"}:o);return new Response(null,{status:204});}
 return json({code:"General.NotFound"},404);
 }
 return {handle,attempts,calls,contact,revokeValues:()=>{thread.canReadFormRecords=false;}};
}
