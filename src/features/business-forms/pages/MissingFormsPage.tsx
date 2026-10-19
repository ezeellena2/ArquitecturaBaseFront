import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from "react";
import {useQuery,useQueryClient,keepPreviousData} from "@tanstack/react-query";
import {useTranslation} from "react-i18next";
import {Link,useSearchParams} from "react-router";
import {useCurrentUser} from "@/auth/useCurrentUser";
import {ApiError} from "@/shared/api/ApiError";
import {errorFeedback,readErrorMessage} from "@/shared/api/errorFeedback";
import {useSystemPresentation} from "@/shared/api/presentation";
import {useCountdown} from "@/shared/hooks/useCountdown";
import {usePagination} from "@/shared/hooks/usePagination";
import {useQueryUpdate} from "@/shared/hooks/useQueryUpdate";
import {formatDateTimeInZone} from "@/shared/lib/dateTime";
import {Button} from "@/shared/ui/button";
import {ConfirmDialog} from "@/shared/ui/ConfirmDialog";
import {DataTable,type Column} from "@/shared/ui/DataTable";
import {FilterBar} from "@/shared/ui/FilterBar";
import {ForbiddenPage} from "@/shared/ui/ForbiddenPage";
import {Page} from "@/shared/ui/Page";
import {Pagination} from "@/shared/ui/Pagination";
import {PlusIcon} from "@/shared/ui/icons";
import {SearchInput} from "@/shared/ui/SearchInput";
import {SegmentedControl} from "@/shared/ui/SegmentedControl";
import {Surface} from "@/shared/ui/Surface";
import {dismissNotification,notify} from "@/shared/ui/notifications";
import {fetchMissingRequests,discardMissingTopic,type MissingRequestQuery,type MissingRequestsPage,type MissingTopic} from "../api/missingRequests";
import {useUnobservedQueryCleanup} from "../hooks/useUnobservedQueryCleanup";

export function MissingFormsPage(){
 const {data:user}=useCurrentUser();const {i18n}=useTranslation("forms");
 if(!user?.permissions.includes("formtemplates.manage"))return <ForbiddenPage/>;
 const culture=i18n.language.startsWith("en")?"en":"es";
 return <MissingForms key={JSON.stringify([user.id,culture,[...user.permissions].sort()])} actorId={user.id} culture={culture} permissionsKey={[...user.permissions].sort().join(",")} timeZoneId={user.timeZoneId} canCreate={user.permissions.includes("formtemplates.read")}/>;
}
function MissingForms({actorId,culture,permissionsKey,timeZoneId,canCreate}:{actorId:string;culture:"es"|"en";permissionsKey:string;timeZoneId?:string;canCreate:boolean}){
 const {t,i18n}=useTranslation("forms");const client=useQueryClient();const presentation=useSystemPresentation();
 const pagination=usePagination(presentation.data?.defaultPageSize,true);const [params]=useSearchParams();const update=useQueryUpdate();
 const state=params.get("state")==="Discarded"?"Discarded":"Pending";
 const query:MissingRequestQuery={page:Number.isSafeInteger(pagination.page)&&pagination.page>0?pagination.page:1,pageSize:Number.isSafeInteger(pagination.pageSize)&&pagination.pageSize>=1&&pagination.pageSize<=100?pagination.pageSize:presentation.data?.defaultPageSize??20,search:pagination.search,state,sort:pagination.sort==="lastRequestedAtUtc"||pagination.sort==="-lastRequestedAtUtc"?pagination.sort:undefined};
 const root=useMemo(()=>["form-missing-requests",actorId,culture,permissionsKey] as const,[actorId,culture,permissionsKey]);
 useUnobservedQueryCleanup(root);
 const [denied,setDenied]=useState(false);const [lastLoaded,setLastLoaded]=useState<MissingRequestsPage>();
 const list=useQuery({queryKey:[...root,query],queryFn:({signal})=>fetchMissingRequests(query,signal),enabled:pagination.ready&&!denied,placeholderData:keepPreviousData,gcTime:0,staleTime:0,retry:false,meta:{errorOwner:"local"}});
 if(list.data&&!list.isPlaceholderData&&!denied&&!list.error&&lastLoaded!==list.data)setLastLoaded(list.data);
 const data=list.data??lastLoaded;
 const [selected,setSelected]=useState<MissingTopic|null>(null);const [busy,setBusy]=useState(false);const [needsRefresh,setNeedsRefresh]=useState(false);
 const cooldown=useCountdown(0);const {setSearch:updateSearch}=pagination;
 const setSearch=useCallback((value:string)=>{if(!cooldown.isRunning)updateSearch(value);},[cooldown.isRunning,updateSearch]);
 const active=useRef(false);const controller=useRef<AbortController|null>(null);const search=useRef<HTMLInputElement>(null);
 const feedbackId="forms:missing:"+actorId+":"+culture;const writeId=feedbackId+":discard";
 useLayoutEffect(()=>{active.current=true;return()=>{active.current=false;controller.current?.abort();controller.current=null;dismissNotification(writeId);dismissNotification(feedbackId);};},[feedbackId,writeId]);
 const forbidden=denied||list.error instanceof ApiError&&(list.error.status===403||list.error.status===401);
 if(forbidden&&!denied){setDenied(true);setLastLoaded(undefined);setSelected(null);}
 useEffect(()=>{if(forbidden){controller.current?.abort();dismissNotification(writeId);dismissNotification(feedbackId);void client.cancelQueries({queryKey:root});client.removeQueries({queryKey:root});}},[forbidden,client,root,writeId,feedbackId]);
 const {error:listError}=list;const {restart}=cooldown;
 useEffect(()=>{
  if(!listError){dismissNotification(feedbackId);return;}
  const failure=errorFeedback(listError);if(["forbidden","session","cancelled"].includes(failure.kind))return;
  if(failure.kind==="wait")restart(failure.retryAfterSeconds??30);
  notify({id:feedbackId,kind:"error",message:readErrorMessage(listError,t)});
 },[listError,feedbackId,t,restart]);
 async function refresh(){if(cooldown.isRunning)return;const result=await list.refetch();if(active.current&&result.isSuccess)setNeedsRefresh(false);}
 async function discard(row:MissingTopic){
  if(busy||cooldown.isRunning||needsRefresh||forbidden)return;
  const pending=new AbortController();controller.current=pending;setBusy(true);dismissNotification(writeId);
  try{await discardMissingTopic(row.id,row.revision,pending.signal);if(!active.current||pending.signal.aborted)return;
   notify({id:writeId+":success",kind:"success",message:t("missing.discardedNotice")});await client.invalidateQueries({queryKey:root});
  }catch(error:unknown){
   if(!active.current||pending.signal.aborted)return;const failure=errorFeedback(error);
   if(failure.kind==="forbidden"||failure.kind==="session"){setDenied(true);return;}
   if(failure.kind==="cancelled")return;
   if(error instanceof ApiError&&error.status===409){setNeedsRefresh(true);notify({id:writeId,kind:"warning",message:t("missing.conflict"),action:{label:t("common:actions.retry"),onClick:()=>{if(active.current)void refresh();}}});await refresh();}
   else{if(failure.kind==="wait")cooldown.restart(failure.retryAfterSeconds??30);notify({id:writeId,kind:"error",message:readErrorMessage(error,t)});}
  }finally{if(active.current&&!pending.signal.aborted)setBusy(false);}
 }
 if(forbidden)return <ForbiddenPage/>;
 const date=(value:string)=>formatDateTimeInZone(value,i18n.language,timeZoneId);
 const columns:Column<MissingTopic>[]=[
  {id:"name",header:t("missing.topic"),cell:row=><div className="min-w-48 max-w-72 whitespace-normal"><p className="font-medium">{row.name}</p><p className="text-sm text-[var(--color-content-muted)]">{row.description}</p>{row.state==="Discarded"&&row.discardedAtUtc?<p className="mt-1 text-xs text-[var(--color-content-muted)]">{t("missing.discardedBy",{name:row.discardedBy?.displayName??"—",date:date(row.discardedAtUtc)})}</p>:null}</div>},
  {id:"requestCount",header:t("missing.requests"),align:"right",cell:row=>row.requestCount},
  {id:"personCount",header:t("missing.people"),align:"right",cell:row=>row.personCount},
  {id:"lastRequestedAtUtc",header:t("missing.lastRequest"),sortable:true,cell:row=>date(row.lastRequestedAtUtc)},
  {id:"actions",header:t("actionsColumn"),align:"right",cell:row=><div className="flex justify-end gap-2">{canCreate?<Button asChild size="sm" variant="outline"><Link to="/formularios/nuevo" state={{formSeed:{ownerActorId:actorId,name:row.name,originalCulture:row.originalCulture}}} aria-label={t("missing.createFor",{name:row.name})}><PlusIcon className="size-4"/>{t("missing.create")}</Link></Button>:null}{row.state==="Pending"?<Button type="button" size="sm" variant="outline" disabled={busy||cooldown.isRunning||needsRefresh||list.isPlaceholderData} aria-label={t("missing.discardFor",{name:row.name})} onClick={()=>setSelected(row)}>{t("missing.discard")}</Button>:null}</div>},
 ];
 const filtered=!!query.search;const globallyEmpty=data?.stateCounts.pending===0&&data.stateCounts.discarded===0;
 return <Page title={t("missing.title")}><div className="flex flex-col gap-4">
  <p className="text-sm text-[var(--color-content-muted)]">{t("missing.description")}</p>
  <fieldset disabled={cooldown.isRunning} className="min-w-0"><FilterBar><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 flex-wrap items-center gap-3"><div className="w-full sm:w-72" ref={node=>{search.current=node?.querySelector<HTMLInputElement>("input")??null;}}><SearchInput value={query.search??""} onChange={setSearch} label={t("missing.search")}/></div><div className="max-w-full overflow-x-auto"><SegmentedControl aria-label={t("missing.filter")} options={(["Pending","Discarded"] as const).map(key=>({key,pressed:key===state,label:t(key==="Pending"?"missing.pending":"missing.discarded")+" ("+(data?.stateCounts[key==="Pending"?"pending":"discarded"]??"…")+")",onSelect:()=>{setSelected(null);update({state:key==="Pending"?undefined:key,page:undefined});}}))}/></div></div>{data?<p className="text-xs text-[var(--color-content-muted)]">{t("missing.totals",{topics:t("missing.topicCount",{count:data.totalCount}),requests:t("missing.requestCount",{count:data.totalRequests})})}</p>:null}</div></FilterBar></fieldset>
  {cooldown.isRunning?<p role="status" className="text-sm text-[var(--color-content-muted)]">{t("wait",{count:cooldown.seconds})}</p>:null}
  {list.error&&data?<div><Button type="button" variant="outline" disabled={cooldown.isRunning} onClick={()=>void refresh()}>{t("common:actions.retry")}</Button></div>:null}
  <fieldset disabled={cooldown.isRunning} className="min-w-0"><Surface><DataTable columns={columns} rows={data?.items??[]} rowKey={row=>row.id} hasData={data!==undefined} isLoading={list.isPending} error={list.error?t("missing.loadFailed"):undefined} onRetry={cooldown.isRunning?undefined:()=>void refresh()} sort={query.sort} onSortChange={pagination.toggleSort} emptyTitle={t(filtered?"missing.noMatches":globallyEmpty?"missing.empty":state==="Pending"?"missing.noPending":"missing.noDiscarded")} emptyAction={filtered?<Button type="button" variant="outline" onClick={()=>update({search:undefined,page:undefined})}>{t("clearFilters")}</Button>:undefined}/>{data?<Pagination {...data} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}/>:null}</Surface></fieldset>
  <ConfirmDialog open={selected!==null} onOpenChange={open=>{if(!open)setSelected(null);}} focusFallback={search} title={t("missing.discardTitle")} description={t("missing.discardDescription",{name:selected?.name})} confirmLabel={t("missing.discard")} destructive onConfirm={()=>{if(selected)void discard(selected);}}/>
 </div></Page>;
}
