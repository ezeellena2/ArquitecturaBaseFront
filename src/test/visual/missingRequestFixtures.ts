import type {MissingTopic} from "@/features/business-forms/api/missingRequests";
// Synthetic UI examples; real contracts come from forms-missing-requests-http.
export function createMissingRequestVisualFixtures(culture:"es"|"en"){
 const names=culture==="es"?["Reclamos de clientes","Pedidos de materiales","Horas extra","Devoluciones","Consultas"]:["Customer complaints","Material requests","Overtime","Returns","Questions"];
 const descriptions=culture==="es"?["Dejar asentado el reclamo de un cliente: qué pasó y qué pide.","Pedir materiales para una obra, con cantidades.","Registrar horas trabajadas fuera de horario."]:["Record a customer complaint: what happened and what they request.","Request materials for a site, including quantities.","Record hours worked outside the regular schedule."];
 let rows:MissingTopic[]=names.map((name,index)=>({id:"11111111-1111-4111-8111-"+String(index+1).padStart(12,"0"),revision:1,name,description:descriptions[index%3]!,originalCulture:culture,requestCount:[5,3,1,2,1][index]!,personCount:[3,2,1,1,1][index]!,lastRequestedAtUtc:"2026-10-"+String(17-index).padStart(2,"0")+"T12:00:00Z",state:index<3?"Pending":"Discarded",discardedBy:index<3?null:{userId:"22222222-2222-4222-8222-222222222222",displayName:"Ana Pérez"},discardedAtUtc:index<3?null:"2026-10-16T13:00:00Z"}));
 return async(request:Request):Promise<Response|undefined>=>{const url=new URL(request.url);const path=url.pathname;
  if(path==="/api/forms/missing-requests"&&request.method==="GET"){
   const search=(url.searchParams.get("search")??"").toLocaleLowerCase();const matching=rows.filter(row=>(row.name+" "+row.description).toLocaleLowerCase().includes(search));const selected=matching.filter(row=>row.state===(url.searchParams.get("state")??"Pending"));const page=Number(url.searchParams.get("page")??1);const pageSize=Number(url.searchParams.get("pageSize")??20);
   selected.sort((a,b)=>(url.searchParams.get("sort")==="lastRequestedAtUtc"?1:-1)*(Date.parse(a.lastRequestedAtUtc)-Date.parse(b.lastRequestedAtUtc)));
   return Response.json({items:selected.slice((page-1)*pageSize,page*pageSize),page,pageSize,totalCount:selected.length,totalRequests:selected.reduce((sum,row)=>sum+row.requestCount,0),stateCounts:{pending:matching.filter(row=>row.state==="Pending").length,discarded:matching.filter(row=>row.state==="Discarded").length},totalPages:Math.ceil(selected.length/pageSize),hasPrevious:page>1,hasNext:page*pageSize<selected.length});
  }
  const match=/^\/api\/forms\/missing-requests\/([^/]+)\/discard$/.exec(path);
  if(match&&request.method==="POST"){const body=await request.json() as {expectedRevision:number};const row=rows.find(item=>item.id===match[1]);if(!row||row.state!=="Pending"||row.revision!==body.expectedRevision)return Response.json({code:"Forms.MissingRequest.RevisionConflict"},{status:409});const discarded={...row,revision:row.revision+1,state:"Discarded" as const,discardedBy:{userId:"22222222-2222-4222-8222-222222222222",displayName:"Ana Pérez"},discardedAtUtc:"2026-10-17T13:00:00Z"};rows=rows.map(item=>item.id===row.id?discarded:item);return Response.json(discarded);}
  return undefined;
 };
}
