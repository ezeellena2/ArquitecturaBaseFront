import {z} from "zod";
import {api} from "@/shared/api/httpClient";
import {formId} from "./response";
const integer=z.number().int().nonnegative();
const topic=z.strictObject({id:z.string().uuid(),revision:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),name:z.string(),description:z.string(),originalCulture:z.enum(["es","en"]),requestCount:integer,personCount:integer,lastRequestedAtUtc:z.iso.datetime(),state:z.enum(["Pending","Discarded"]),discardedBy:z.strictObject({userId:z.string().uuid(),displayName:z.string().nullable()}).nullable(),discardedAtUtc:z.iso.datetime().nullable()});
const page=z.strictObject({items:z.array(topic),page:z.number().int().positive(),pageSize:z.number().int().min(1).max(100),totalCount:integer,totalRequests:integer,stateCounts:z.strictObject({pending:integer,discarded:integer}),totalPages:integer,hasPrevious:z.boolean(),hasNext:z.boolean()});
export type MissingTopic=z.infer<typeof topic>;
export type MissingRequestsPage=z.infer<typeof page>;
export interface MissingRequestQuery {page:number;pageSize:number;search?:string;sort?:"lastRequestedAtUtc"|"-lastRequestedAtUtc";state:"Pending"|"Discarded"|null}
function read<T>(schema:z.ZodType<T>,body:unknown):T {const parsed=schema.safeParse(body);if(!parsed.success)throw new Error("Invalid missing form requests contract.");return parsed.data;}
export const readMissingTopic=(body:unknown)=>read(topic,body);
export const readMissingRequests=(body:unknown)=>read(page,body);
export async function fetchMissingRequests(query:MissingRequestQuery,signal?:AbortSignal){
 const params=new URLSearchParams(Object.entries(query).filter(([,value])=>value!==undefined).map(([key,value])=>[key,value===null?"":String(value)]));
 return readMissingRequests(await api.get<unknown>("/api/forms/missing-requests?"+params,{signal,cache:"no-store"}));
}
export async function discardMissingTopic(id:string,expectedRevision:number,signal?:AbortSignal){
 const saved=readMissingTopic(await api.post<unknown>("/api/forms/missing-requests/"+formId(id)+"/discard",{expectedRevision},{signal}));
 if(saved.id!==id||saved.revision!==expectedRevision+1||saved.state!=="Discarded")throw new Error("Invalid missing form requests contract.");
 return saved;
}
