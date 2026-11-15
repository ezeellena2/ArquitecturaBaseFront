import {http,HttpResponse} from "msw";
import {expect,it} from "vitest";
import {server} from "@/test/mocks/server";
import {readMissingRequests,readMissingTopic,fetchMissingRequests,discardMissingTopic,reviewMissingTopic} from "./missingRequests";
const id="11111111-1111-4111-8111-111111111111";
const topic={id,revision:2,name:"Materiales",description:"Pedir materiales para una obra.",originalCulture:"es",requestCount:3,personCount:2,lastRequestedAtUtc:"2026-10-17T12:00:00Z",state:"Pending",discardedBy:null,discardedAtUtc:null,reviewedBy:null,reviewedAtUtc:null};
const page={items:[topic],page:1,pageSize:20,totalCount:1,totalRequests:3,stateCounts:{pending:1,discarded:0},totalPages:1,hasPrevious:false,hasNext:false};
it("reads aggregate topics without requester identities or messages",()=>{expect(readMissingRequests(page)).toEqual(page);});
it.each(["stateCounts","totalRequests"])("rejects a page without required %s",key=>{const body={...page} as Record<string,unknown>;delete body[key];expect(()=>readMissingRequests(body)).toThrow("Invalid missing form requests contract.");});
it("rejects private requester data and unsupported states rather than hiding them",()=>{expect(()=>readMissingTopic({...topic,people:[{name:"Private person"}]})).toThrow();expect(()=>readMissingTopic({...topic,state:"Resolved"})).toThrow();});
it("sends only the expected revision to review a topic and rejects an answer that is not the reviewed pending topic",async()=>{
 let body:unknown;
 server.use(http.post("/api/forms/missing-requests/:id/review",async({request})=>{body=await request.json();return HttpResponse.json({...topic,revision:3,reviewedBy:{userId:id,displayName:"Ana"},reviewedAtUtc:"2026-10-17T13:00:00Z"});}));
 expect((await reviewMissingTopic(id,2)).reviewedAtUtc).toBe("2026-10-17T13:00:00Z");expect(body).toEqual({expectedRevision:2});
 server.use(http.post("/api/forms/missing-requests/:id/review",()=>HttpResponse.json({...topic,revision:3})));
 await expect(reviewMissingTopic(id,2)).rejects.toThrow("Invalid missing form requests contract.");
});
it("sends server search/state/order/page and freezes only the expected discard revision",async()=>{
 let query:URLSearchParams|undefined;let body:unknown;
 server.use(http.get("/api/forms/missing-requests",({request})=>{query=new URL(request.url).searchParams;return HttpResponse.json(page);}),http.post("/api/forms/missing-requests/:id/discard",async({request})=>{body=await request.json();return HttpResponse.json({...topic,revision:3,state:"Discarded",discardedBy:{userId:id,displayName:"Ana"},discardedAtUtc:"2026-10-17T13:00:00Z"});}));
 await fetchMissingRequests({page:2,pageSize:10,search:"obra",state:"Discarded",sort:"-lastRequestedAtUtc"});expect(Object.fromEntries(query!)).toEqual({page:"2",pageSize:"10",search:"obra",state:"Discarded",sort:"-lastRequestedAtUtc"});
 expect((await discardMissingTopic(id,2)).state).toBe("Discarded");expect(body).toEqual({expectedRevision:2});
});
