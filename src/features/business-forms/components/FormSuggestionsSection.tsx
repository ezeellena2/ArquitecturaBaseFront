import { FormConditionsEditor } from "./FormConditionsEditor";
import { useCallback,useEffect,useId,useLayoutEffect,useRef,useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback,operationalErrorMessage,readErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Pagination } from "@/shared/ui/Pagination";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import { PencilIcon,TrashIcon } from "@/shared/ui/icons";
import { dismissNotification,notify } from "@/shared/ui/notifications";
import { fetchFormSuggestions,fetchSuggestionHistory,fetchSuggestionOptions,fetchSuggestionRevision,saveFormSuggestions,type FormSuggestionSet } from "../api/suggestions";
import { administrativeName, localizedValue } from "../editorModel";
import { formScopeKey,usePrivateQueryCleanup,type FormReadScope } from "../hooks/useFormQueries";
import type { FormCulture } from "../model";
import { responseFilterLabels,type ResponseColumn } from "../responses";
import { mappingTargets,newSuggestion,prepareSuggestions,suggestionFieldErrors,type FormSuggestion,type SuggestionMapping } from "../suggestions";
export interface FormSuggestionsSectionProps { readonly definitionId:string;readonly definitionRevision:number;readonly publishedVersionId?:string|null;readonly scope:FormReadScope;readonly contentCulture:FormCulture;readonly timeZoneId?:string;readonly onDirtyChange:(dirty:boolean)=>void }
export function FormSuggestionsSection(props:FormSuggestionsSectionProps) {
  const {t}=useTranslation("forms");
  const owner=JSON.stringify([...formScopeKey(props.scope),props.definitionId]);
  const [denied,setDenied]=useState<string|null>(null);
  const onDenied=useCallback(()=>setDenied(owner),[owner]);
  if(!props.scope.actorId||!props.scope.permissions.includes("formsuggestions.manage"))return null;
  if(denied===owner)return <Surface title={t("suggestions.title")} padded><p>{t("suggestions.noPermission")}</p></Surface>;
  return <SuggestionsEditor key={owner} {...props} onDenied={onDenied}/>;
}
function SuggestionsEditor({definitionId,definitionRevision,publishedVersionId,scope,contentCulture,timeZoneId,onDirtyChange,onDenied}:FormSuggestionsSectionProps&{onDenied:()=>void}) {
  const {t,i18n}=useTranslation("forms");
  const root=[...formScopeKey(scope),"suggestions",definitionId];
  usePrivateQueryCleanup(root);
  const query=useQuery({queryKey:[...root,"editor",definitionRevision,publishedVersionId??null],queryFn:async({signal})=>{
    const [current,options]=await Promise.all([fetchFormSuggestions(definitionId,signal),fetchSuggestionOptions(definitionId,signal).catch(failure=>{if(failure instanceof ApiError&&failure.code==="Forms.Suggestion.SourceNotPublished")return null;throw failure;})]);
    return {current,options};
  },placeholderData:previous=>previous,gcTime:0});
  const [page,setPage]=useState(1);
  const history=useQuery({queryKey:[...root,"history",page],queryFn:({signal})=>fetchSuggestionHistory(definitionId,page,signal),gcTime:0});
  const [baseline,setBaseline]=useState<FormSuggestionSet|null>(null);
  const [suggestions,setSuggestions]=useState<readonly FormSuggestion[]|null>(null);
  const [expanded,setExpanded]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [apiErrors,setApiErrors]=useState<Record<string,string[]>>({});
  const [conflict,setConflict]=useState(false);
  const [current,setCurrent]=useState<FormSuggestionSet|null>(null);
  const [revisionView,setRevisionView]=useState<FormSuggestionSet|null>(null);
  const cooldown=useCountdown(0);
  const host=useRef<HTMLDivElement>(null);
  const pendingFocus=useRef<string|null>(null);
  const active=useRef(true);
  const operation=useRef<AbortController|null>(null);
  const notices=useRef(new Set<string>());
  const notificationRoot="forms:suggestions:"+JSON.stringify(root);
  const hintId=useId();
  const revisionTrigger=useRef<HTMLButtonElement|null>(null);
  const restoreRevisionFocus=useRestoreFocusOnClose(revisionView!==null);
  useEffect(()=>()=>{for(const kind of notices.current)dismissNotification(notificationRoot+":"+kind);},[notificationRoot]);
  useEffect(()=>{active.current=true;return()=>{active.current=false;operation.current?.abort();onDirtyChange(false);};},[onDirtyChange]);
  useEffect(()=>{if([query.error,history.error].some(failure=>failure instanceof ApiError&&failure.status===403))onDenied();},[query.error,history.error,onDenied]);
  useLayoutEffect(()=>{if(pendingFocus.current){host.current?.querySelector<HTMLElement>(pendingFocus.current)?.focus();pendingFocus.current=null;}},[suggestions,expanded]);
  if(query.data&&baseline===null){setBaseline(query.data.current);setSuggestions(query.data.current.suggestions);}
  const dirty=!!baseline&&suggestions!==null&&JSON.stringify(baseline.suggestions)!==JSON.stringify(suggestions);
  useEffect(()=>onDirtyChange(dirty),[dirty,onDirtyChange]);
  const options=query.data?.options;
  const columns:ResponseColumn[]=options?.source.questions.map(question=>({fieldId:question.fieldId,type:question.type,label:localizedValue(question.label,contentCulture,options.source.originalCulture),introducedInVersion:1,options:options.conditionChoices[question.fieldId]??(question.type==="choice"||question.type==="multiChoice"?question.options??[]:[]).map(choice=>({id:choice.choiceId,label:localizedValue(choice.label,contentCulture,options.source.originalCulture)}))}))??[];
  const ready=options?prepareSuggestions(suggestions??[],options.source,options.destinations,columns):null;
  const blocked=busy||cooldown.isRunning;
  const change=(next:readonly FormSuggestion[])=>{if(!blocked){setSuggestions(next);setApiErrors({});}};
  const changeOne=(index:number,next:FormSuggestion)=>change((suggestions??[]).map((row,position)=>position===index?next:row));
  const run=async(kind:"save"|"reread"|"revision",action:(signal:AbortSignal)=>Promise<void>)=>{
    if(blocked)return;
    const controller=new AbortController();operation.current=controller;
    setBusy(true);setApiErrors({});notices.current.delete(kind);dismissNotification(notificationRoot+":"+kind);
    try{await action(controller.signal);}catch(failure){
      if(!active.current||errorFeedback(failure).kind==="cancelled")return;
      const binding=kind==="save"&&failure instanceof ApiError?suggestionFieldErrors(failure.errors??{},suggestions??[]):null;
      const normalized=binding&&failure instanceof ApiError&&failure.errors?new ApiError(failure.status,{...failure.problem,errors:binding.errors},failure.isNetworkError):failure;
      if(binding){setApiErrors(binding.errors);if(binding.firstSuggestionId&&binding.firstPath){setExpanded(binding.firstSuggestionId);requestAnimationFrame(()=>{if(!active.current||controller.signal.aborted)return;const target=host.current?.querySelector<HTMLElement>('[data-suggestion-id="'+binding.firstSuggestionId+'"] [data-suggestion-field="'+binding.firstPath+'"]');(target?.querySelector<HTMLElement>('[role="radio"][data-state="checked"]')??target)?.focus();});}}
      if(failure instanceof ApiError&&failure.status===403){onDenied();return;}
      if(kind==="save"&&failure instanceof ApiError&&failure.code==="Forms.Suggestion.RevisionConflict"){setConflict(true);setCurrent(null);return;}
      if(failure instanceof ApiError&&failure.status===429)cooldown.restart(failure.retryAfterSeconds??60);
      if(!["cancelled","session","forbidden","fields"].includes(errorFeedback(normalized,{fields:binding?.fields}).kind)){notices.current.add(kind);notify({id:notificationRoot+":"+kind,kind:"error",message:kind==="save"?operationalErrorMessage(normalized,t,"save"):readErrorMessage(normalized,t)});}
    }finally{if(active.current)setBusy(false);}
  };
  const fieldError=(path:string)=>{const issue=ready?.issues.find(issue=>issue.path===path);return apiErrors[path]?.[0]??(issue?t("suggestions.errors."+issue.key):undefined);};
  if([query.error,history.error].some(failure=>failure instanceof ApiError&&failure.status===403))return <Surface title={t("suggestions.title")} padded><p>{t("suggestions.noPermission")}</p></Surface>;
  if(query.data?.options===null)return <Surface title={t("suggestions.title")} padded><p>{t("suggestions.publishFirst")}</p></Surface>;
  if(query.isPending||!baseline||suggestions===null||!options||!ready)return <Surface title={t("suggestions.title")} padded>{query.isPending?<Spinner/>:<EmptyState embedded title={t("common:states.loadFailed")} action={<Button variant="outline" onClick={()=>void query.refetch()}>{t("common:actions.retry")}</Button>}/>}</Surface>;
  const label=(fieldId:string)=>columns.find(column=>column.fieldId===fieldId)?.label??t("suggestions.missingQuestion");
  const unavailable=(row:FormSuggestion)=>options.unavailableDestinations.find(form=>form.definitionId===row.destinationDefinitionId);
  const name=(row:FormSuggestion)=>{const destination=options.destinations.find(form=>form.definitionId===row.destinationDefinitionId);return !destination?unavailable(row)?administrativeName(unavailable(row)!.name,contentCulture):t("suggestions.destinationUnavailable"):row.destinationVersionId&&destination.versionId!==row.destinationVersionId?t("suggestions.historicalDestination"):localizedValue(destination.name,contentCulture,destination.originalCulture);};
  const summary=(row:FormSuggestion,historical=false)=><div className="space-y-1 text-sm"><p className="font-medium">{name(row)} {unavailable(row)?<Badge variant="outline">{t(unavailable(row)?.state==="Deleted"?"suggestions.deleted":"suggestions.deactivated")}</Badge>:<Badge variant="outline">{t("suggestions.modes."+row.mode)}</Badge>}{!row.isActive&&!unavailable(row)?<Badge variant="outline">{t("suggestions.inactive")}</Badge>:null}</p>{row.mode==="Assistant"&&row.when?<p>{t("suggestions.when")}: {row.when}</p>:null}{row.conditions.length?<p>{historical?t("suggestions.historyConditions",{count:row.conditions.length}):<>{t("rules.if")}: {responseFilterLabels({page:1,pageSize:1,conditions:row.conditions},columns,t,i18n.language,timeZoneId).map(item=>item.label).join("; ")}</>}</p>:null}{row.mappings.length?<p className="text-xs text-[var(--color-content-muted)]">{historical?t("suggestions.historyMappings",{count:row.mappings.length}):<>{t("suggestions.mappings")}: {row.mappings.map(mapping=>mapping.source.kind==="RecordNumber"?t("suggestions.recordNumber"):label(mapping.source.fieldId??"")).join(", ")}</>}</p>:null}</div>;
  const saveReason=busy?t("rules.saveBusy"):cooldown.isRunning?t("responses.wait",{count:cooldown.seconds}):conflict?t("rules.saveConflict"):ready.issues.length?t("rules.saveInvalid"):!dirty?t("rules.saveUnchanged"):null;
  const resolve=(keep:boolean)=>{if(!current||blocked)return;setBaseline(current);if(!keep){setSuggestions(current.suggestions);setExpanded(null);}setCurrent(null);setConflict(false);setApiErrors({});};
  return <div ref={host} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
    <Surface title={t("suggestions.title")} actions={<>{dirty?<Badge variant="outline">{t("dirty")}</Badge>:<span className="text-xs">{t("rules.revision",{revision:baseline.revision})}</span>}<Button disabled={!!saveReason} aria-describedby={saveReason?hintId:undefined} onClick={()=>void run("save",async signal=>{const saved=await saveFormSuggestions(definitionId,{expectedRevision:baseline.revision,suggestions:ready.suggestions},signal);if(!active.current)return;setBaseline(saved);setSuggestions(saved.suggestions);setCurrent(null);void history.refetch();notify({id:notificationRoot+":save",kind:"success",message:t("suggestions.saved")});})}>{t(busy?"suggestions.saving":"suggestions.save")}</Button>{saveReason?<p id={hintId} role={blocked?"status":undefined} className="basis-full text-xs text-[var(--color-content-muted)]">{saveReason}</p>:null}</>}>
      <p className="border-b border-[var(--color-border)] p-4 text-sm">{t("suggestions.independent")}</p>
      {conflict?<div className="space-y-2 border-b border-[var(--color-border)] p-4"><p role="alert">{t("suggestions.conflict")}</p><Button variant="outline" disabled={blocked} onClick={()=>void run("reread",async signal=>{const fresh=await fetchFormSuggestions(definitionId,signal);if(active.current)setCurrent(fresh);})}>{t("suggestions.reread")}</Button>{current?<><p className="text-sm">{t("suggestions.keepMineHint",{revision:current.revision})}</p><Button variant="outline" disabled={blocked} onClick={()=>resolve(false)}>{t("rules.useCurrent")}</Button><Button variant="outline" disabled={blocked} onClick={()=>resolve(true)}>{t("keepMine")}</Button></>:null}</div>:null}
      {suggestions.length===0?<p className="p-4 text-sm text-[var(--color-content-muted)]">{t("suggestions.empty")}</p>:null}
      {suggestions.map((row,index)=>{const destination=options.destinations.find(form=>form.definitionId===row.destinationDefinitionId);const deactivated=!!unavailable(row);const path="suggestions."+index;return <section key={row.id} data-suggestion-id={row.id} aria-label={t("suggestions.row",{number:index+1})} className="border-b border-[var(--color-border)] p-4">
        <div className="flex items-start gap-2"><div className="min-w-0 flex-1">{expanded!==row.id||deactivated?summary(row):<p className="font-medium">{name(row)}</p>}</div>{!deactivated?<IconButton data-edit-suggestion={row.id} label={t("suggestions.edit",{number:index+1})} disabled={blocked} aria-expanded={expanded===row.id} onClick={()=>setExpanded(expanded===row.id?null:row.id)}><PencilIcon className="size-4"/></IconButton>:null}<IconButton data-remove-suggestion={row.id} label={t("suggestions.remove",{number:index+1})} disabled={blocked} onClick={()=>{const neighbor=suggestions[index+1]??suggestions[index-1];pendingFocus.current=neighbor?'[data-'+(unavailable(neighbor)?'remove':'edit')+'-suggestion="'+neighbor.id+'"]':"[data-add-suggestion]";change(suggestions.filter(item=>item.id!==row.id));if(expanded===row.id)setExpanded(null);}}><TrashIcon className="size-4"/></IconButton></div>
        {deactivated?<p className="mt-2 text-sm text-[var(--color-danger)]">{t(unavailable(row)?.state==="Deleted"?"suggestions.deletedHint":"suggestions.deactivatedHint")}</p>:null}
        {expanded===row.id&&!deactivated?<div className="mt-3 space-y-4">
          <div className="grid items-start gap-4 sm:grid-cols-2"><FormField label={t("suggestions.destination")} hint={t("suggestions.publishedOnly")} error={fieldError(path+".destinationDefinitionId")}><NativeSelect data-suggestion-field={path+".destinationDefinitionId"} disabled={blocked} value={row.destinationDefinitionId} onChange={event=>{const target=options.destinations.find(form=>form.definitionId===event.target.value);changeOne(index,{...row,destinationDefinitionId:event.target.value,destinationVersionId:target?.versionId??null,mappings:[]});}}><option value="">{t("suggestions.chooseDestination")}</option>{row.destinationDefinitionId&&!destination?<option value={row.destinationDefinitionId}>{t("suggestions.destinationUnavailable")}</option>:null}{options.destinations.map(form=><option key={form.definitionId} value={form.definitionId}>{localizedValue(form.name,contentCulture,form.originalCulture)}</option>)}</NativeSelect></FormField><div data-suggestion-field={path+".mode"} className="space-y-1.5"><p className="text-sm font-medium">{t("suggestions.mode")}</p><RadioGroupField label={t("suggestions.mode")} variant="cards" error={fieldError(path+".mode")} value={row.mode} options={(["Assistant","Always"] as const).map(mode=>({value:mode,label:t("suggestions.modes."+mode),description:t("suggestions.modeHints."+mode),disabled:blocked}))} onValueChange={mode=>changeOne(index,{...row,mode:mode as FormSuggestion["mode"]})}/></div></div>
          {row.mode==="Assistant"?<FormField label={t("suggestions.when")} hint={t("suggestions.whenHint")} error={fieldError(path+".when")}><Textarea data-suggestion-field={path+".when"} disabled={blocked} maxLength={1000} value={row.when??""} onChange={event=>changeOne(index,{...row,when:event.target.value||null})}/></FormField>:null}
          <CheckboxField label={t("suggestions.active")} checked={row.isActive} disabled={blocked} onCheckedChange={isActive=>changeOne(index,{...row,isActive})}/>
          <div className="space-y-3"><h3 className="text-sm font-medium">{t("rules.ifOptional")}</h3><FormConditionsEditor missingQuestionLabel={t("suggestions.missingQuestion")} fieldPath={path+".conditions"} conditions={row.conditions} columns={columns} blocked={blocked} error={fieldError(path+".conditions")} onChange={conditions=>changeOne(index,{...row,conditions})}/></div>
          <div className="space-y-2"><h3 className="text-sm font-medium">{t("suggestions.mappings")}</h3>{row.mappings.map((mapping,position)=>{const targets=mappingTargets(mapping.source,options.source.questions,destination?.questions??[]);const sourceValue=mapping.source.kind==="RecordNumber"?"RecordNumber":mapping.source.fieldId??"";const update=(next:SuggestionMapping)=>changeOne(index,{...row,mappings:row.mappings.map((value,p)=>p===position?next:value)});return <div key={position} className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><FormField label={t("suggestions.sourceData",{number:position+1})} error={fieldError(path+".mappings."+position+".source")}><NativeSelect data-suggestion-field={path+".mappings."+position+".source"} disabled={blocked} value={sourceValue} data-mapping-position={position} onChange={event=>update({source:event.target.value==="RecordNumber"?{kind:"RecordNumber",fieldId:null}:{kind:"Field",fieldId:event.target.value},destinationFieldId:""})}>{mapping.source.kind==="Field"&&!options.source.questions.some(field=>field.fieldId===mapping.source.fieldId)?<option value={sourceValue}>{t("suggestions.missingQuestion")}</option>:null}<option value="RecordNumber">{localizedValue(options.source.name,contentCulture,options.source.originalCulture)} · {t("suggestions.recordNumber")}</option>{options.source.questions.filter(field=>field.type!=="photo"&&field.type!=="document"&&field.type!=="multiChoice").map(field=><option key={field.fieldId} value={field.fieldId}>{label(field.fieldId)}</option>)}</NativeSelect></FormField><FormField label={t("suggestions.destinationQuestion",{number:position+1})} error={fieldError(path+".mappings."+position+".destinationFieldId")}><NativeSelect data-suggestion-field={path+".mappings."+position+".destinationFieldId"} disabled={blocked} value={mapping.destinationFieldId} onChange={event=>update({...mapping,destinationFieldId:event.target.value})}><option value="">{t("suggestions.chooseQuestion")}</option>{mapping.destinationFieldId&&!targets.some(field=>field.fieldId===mapping.destinationFieldId)?<option value={mapping.destinationFieldId}>{t("suggestions.missingQuestion")}</option>:null}{targets.map(field=><option key={field.fieldId} value={field.fieldId}>{localizedValue(field.label,contentCulture,destination?.originalCulture??options.source.originalCulture)}</option>)}</NativeSelect></FormField><IconButton className="sm:mt-6" label={t("suggestions.removeMapping",{number:position+1})} disabled={blocked} onClick={()=>{pendingFocus.current=row.mappings.length>1?'[data-suggestion-id="'+row.id+'"] [data-mapping-position="'+Math.min(position,row.mappings.length-2)+'"]':'[data-add-mapping="'+row.id+'"]';changeOne(index,{...row,mappings:row.mappings.filter((_,p)=>p!==position)});}}><TrashIcon className="size-4"/></IconButton></div>;})}{fieldError(path+".mappings")?<p id={hintId+"-mapping-"+row.id} role="alert" className="text-sm text-[var(--color-danger)]">{fieldError(path+".mappings")}</p>:null}<Button data-suggestion-field={path+".mappings"} aria-invalid={!!fieldError(path+".mappings")} aria-describedby={fieldError(path+".mappings")?hintId+"-mapping-"+row.id:undefined} data-add-mapping={row.id} variant="outline" disabled={blocked||!destination||row.mappings.length>=40} onClick={()=>changeOne(index,{...row,mappings:[...row.mappings,{source:{kind:"RecordNumber",fieldId:null},destinationFieldId:""}]})}>{t("suggestions.addMapping")}</Button><p className="text-xs text-[var(--color-content-muted)]">{t("suggestions.mappingHint")}</p></div>
          <div className="flex justify-end"><Button variant="outline" disabled={blocked} onClick={()=>{pendingFocus.current='[data-edit-suggestion="'+row.id+'"]';setExpanded(null);}}>{t("done")}</Button></div>
        </div>:null}
      </section>;})}
      <div className="p-4"><Button data-add-suggestion variant="outline" disabled={blocked||suggestions.length>=20} onClick={()=>{const row=newSuggestion();change([...suggestions,row]);setExpanded(row.id);}}>{t("suggestions.add")}</Button></div>
    </Surface>
    <Surface title={t("suggestions.history")} padded>{history.isPending?<Spinner/>:!history.data?<EmptyState embedded title={t("common:states.loadFailed")} action={<Button variant="outline" onClick={()=>void history.refetch()}>{t("common:actions.retry")}</Button>}/>:<><ol className="space-y-3">{history.data.items.map(revision=><li key={revision.id} className="border-b border-[var(--color-border)] pb-3"><Button variant="link" disabled={blocked} onClick={event=>{revisionTrigger.current=event.currentTarget;void run("revision",async signal=>{const view=await fetchSuggestionRevision(definitionId,revision.revision,signal);if(active.current)setRevisionView(view);});}}>{t("rules.revision",{revision:revision.revision})}</Button>{revision.revision===baseline.revision?<Badge variant="outline">{t("rules.current")}</Badge>:null}<p className="text-xs">{formatDateTimeInZone(revision.createdAtUtc,scope.culture,timeZoneId)} · {revision.author?.displayName??t("responses.unknownPerson")}</p><p className="text-xs text-[var(--color-content-muted)]">{[revision.changes.addedSuggestions?t("suggestions.historyAdded",{count:revision.changes.addedSuggestions}):null,revision.changes.updatedSuggestions?t("suggestions.historyUpdated",{count:revision.changes.updatedSuggestions}):null,revision.changes.removedSuggestions?t("suggestions.historyRemoved",{count:revision.changes.removedSuggestions}):null,revision.changes.orderChanged?t("rules.historyOrderChanged"):null].filter(Boolean).join(" · ")||t("rules.historyUnchanged")}</p></li>)}</ol>{history.data.totalPages>1?<Pagination {...history.data} onPageChange={setPage}/>:null}<p className="mt-3 text-xs text-[var(--color-content-muted)]">{t("suggestions.historyHint")}</p></>}</Surface>
    {revisionView?<Dialog open onOpenChange={open=>{if(!open)setRevisionView(null);}}><DialogContent onCloseAutoFocus={event=>{const target=revisionTrigger.current;if(target?.isConnected&&!target.disabled){event.preventDefault();target.focus();}else restoreRevisionFocus(event);}} className="max-h-[90svh] overflow-y-auto"><DialogHeader><DialogTitle>{t("rules.revision",{revision:revisionView.revision})}</DialogTitle><DialogDescription>{t("suggestions.historyHint")}</DialogDescription></DialogHeader><ol className="space-y-4">{revisionView.suggestions.map(row=><li key={row.id}>{summary(row,revisionView.sourceVersionId!==options.source.versionId)}</li>)}</ol></DialogContent></Dialog>:null}
  </div>;
}
