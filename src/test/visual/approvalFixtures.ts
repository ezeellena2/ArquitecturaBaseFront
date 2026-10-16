import {approvalTaskFixture,approvalTaskId} from "../approvalFixtures";
import {responseWorkflowFixture} from "../responseFixtures";
export function createApprovalVisualFixtures(language:"es"|"en") {
 const en=language==="en";const base=approvalTaskFixture();base.formName=en?"Delivery visit":"Visita de entrega";base.role.name=en?"Supervision":"Supervisión";
 const tasks=[base,{...base,id:"0199a0c0-0000-7000-8000-000000000071",number:"VIS-00002",author:{...base.author,displayName:"Luz"}},{...base,id:"0199a0c0-0000-7000-8000-000000000072",number:"VIS-00003",canDecide:false,cannotDecideReason:"OwnResponse" as const}];
 const writes:unknown[]=[];
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
 const rows=(url:URL)=>tasks.filter(task=>task.state==="Open"&&(url.searchParams.get("onlyMine")==="false"||task.canDecide));
 return {writes, async handle(request:Request):Promise<Response|null>{const url=new URL(request.url);const path=url.pathname;
  if(path.endsWith("/workflow")){const task=tasks[0];return json({...responseWorkflowFixture(),recordState:task.state==="Open"?"PendingApproval":task.state,ruleRevision:1,task:{id:task.id,roleId:task.role.id,roleName:task.role.name,revision:task.revision,state:task.state,decidedAtUtc:task.decidedAtUtc,decidedBy:task.decidedBy,reason:task.reason}});}
  if(!path.startsWith("/api/forms/approvals"))return null;
  if(path.endsWith("/count"))return json({count:rows(url).length});
  if(path.endsWith("/options"))return json({forms:rows(url).length?[{id:base.definitionId,name:base.formName}]:[]});
  if(path==="/api/forms/approvals"){const items=rows(url);return json({items,page:1,pageSize:20,totalCount:items.length,totalPages:items.length?1:0,hasPrevious:false,hasNext:false});}
  const task=tasks.find(task=>path.includes(task.id))??tasks.find(task=>task.id===approvalTaskId)!;
  if(request.method==="POST"){const body=await request.json() as {decision:"Approved"|"Rejected";reason?:string};writes.push(body);task.state=body.decision;task.revision++;task.canDecide=false;task.cannotDecideReason="AlreadyDecided";task.decidedAtUtc="2026-10-16T14:00:00Z";task.decidedBy={userId:base.author.userId,displayName:en?"Alex Smith":"Alex Pérez"};task.reason=body.reason??null;return json({taskId:task.id,recordId:task.recordId,revision:task.revision,state:task.state,decidedAtUtc:task.decidedAtUtc,decidedBy:task.decidedBy,reason:task.reason});}
  return json(task);
 }};
}
