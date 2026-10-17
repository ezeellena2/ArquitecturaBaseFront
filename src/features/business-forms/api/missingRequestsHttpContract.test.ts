import {expect,it} from "vitest";
import {http} from "msw";
import {httpCohort} from "@/test/httpCohort";
import {server} from "@/test/mocks/server";
import {readMissingRequests,fetchMissingRequests,discardMissingTopic} from "./missingRequests";
it("qualifies aggregate topics and discard history in both original languages from intact H7 bytes",()=>{
 const cohort=httpCohort("missingRequests");const provenance=cohort.verify();expect(provenance.sources.some(source=>source.path.endsWith("FormMissingRequestHttpTests.cs"))).toBe(true);
 for(const culture of ["es","en"] as const){const pending=readMissingRequests(cohort.json("pending-"+culture+".json"));const discarded=readMissingRequests(cohort.json("discarded-"+culture+".json"));
 expect(pending.items).toHaveLength(1);expect(pending.totalRequests).toBe(3);const row=pending.items[0]!;expect(row).toMatchObject({originalCulture:culture,state:"Pending",requestCount:3,personCount:2,revision:3});
 expect(discarded.items[0]).toMatchObject({id:row.id,state:"Discarded",revision:4});expect(discarded.items[0]?.discardedBy?.userId).toBeTruthy();expect(discarded.items[0]?.discardedAtUtc).toBeTruthy();
 }
});
it("uses unchanged H7 page, conflict and forbidden HTTP bodies through the real adapters",async()=>{
 const cohort=httpCohort("missingRequests");const pending=readMissingRequests(cohort.json("pending-es.json"));const topic=pending.items[0]!;
 server.use(http.get("/api/forms/missing-requests",({request})=>cohort.response(new URL(request.url).searchParams.get("state")==="Discarded"?"discarded-es.json":"pending-es.json")),http.post("/api/forms/missing-requests/"+topic.id+"/discard",()=>cohort.response("conflict.json",409)));
 expect(await fetchMissingRequests({page:1,pageSize:20,state:"Pending"})).toEqual(pending);expect(await fetchMissingRequests({page:1,pageSize:20,state:"Discarded"})).toEqual(readMissingRequests(cohort.json("discarded-es.json")));
 await expect(discardMissingTopic(topic.id,topic.revision)).rejects.toMatchObject({status:409,code:"Forms.MissingRequest.RevisionConflict"});server.use(http.get("/api/forms/missing-requests",()=>cohort.response("forbidden.json",403)));
 await expect(fetchMissingRequests({page:1,pageSize:20,state:"Pending"})).rejects.toMatchObject({status:403});
});
