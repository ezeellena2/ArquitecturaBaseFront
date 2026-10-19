import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { chatKey, type Chat, type Outgoing } from "../api/chat";
import { listChatForms, prepareChatForm, recoverFormMessage, sendFormMessage, type ChatFormOption } from "../api/forms";
import type { ChatDraft } from "../components/ChatComposer";
import { freezeFormMessage, recipientChanged, selectedVersionChanged, type FormSendDraft } from "../lib/formSendSession";
import { formMessageIssue } from "../lib/formMessage";
import { replyDisabledReason } from "../lib/replyAvailability";

const conflictCodes = ["WhatsApp.Flow.RecipientContextChanged", "WhatsApp.Flow.FormUnavailable", "WhatsApp.Chat.WindowClosed", "WhatsApp.Chat.ManualRequired", "WhatsApp.Chat.RevisionConflict", "WhatsApp.Chat.SendPending", "WhatsApp.Chat.RequestConflict"];
export function useFormComposer(contact: Chat, actor: string, canSend: boolean, outgoing: Outgoing[], draft: ChatDraft, updateDraft: (update: (current: ChatDraft) => ChatDraft) => void) {
  const { t, i18n } = useTranslation("whatsapp");
  const { ready: englishReady } = useTranslation("whatsapp", { lng: "en", useSuspense: false });
  const { ready: spanishReady } = useTranslation("whatsapp", { lng: "es", useSuspense: false });
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [selectionError, setSelectionError] = useState<string>();
  const [forbidden, setForbidden] = useState(false);
  const [waitUntil, setWaitUntil] = useState(0);
  const waitDeadline = useRef(0);
  const beginWait = useCallback((seconds = 30) => { const deadline = Date.now() + Math.max(1, Math.min(86400, seconds)) * 1000; waitDeadline.current = deadline; setWaitUntil(deadline); }, []);
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef(false);
  const active = useRef(true);
  const current = useRef(draft);
  const permitted = useRef(canSend);
  const noticeId = "whatsapp:form:" + contact.id;
  const eligibility = contact.formEligibility;
  const form = draft.form;
  const changed = Boolean(form && recipientChanged(form, eligibility?.recipientContextRevision, eligibility?.recipientCulture));
  const denied = forbidden || !canSend;
  const commonReason = replyDisabledReason(contact, canSend, outgoing, now);
  const recipientReason = !eligibility ? "forms.unavailable" : eligibility.status === "NoLinkedAccount" ? "forms.noLinkedAccount" : eligibility.status === "InactiveAccount" ? "forms.inactiveAccount" : eligibility.status === "NoEligibleForms" ? "forms.noEligibleForms" : undefined;
  const disabledReason = commonReason ?? (!(eligibility?.recipientCulture === "en" ? englishReady : spanishReady) ? "forms.loading" : undefined) ?? (draft.attempt ? "send.pending" : recipientReason);
  const forms = useQuery({ queryKey: [...chatKey, actor, "forms", contact.id, eligibility?.recipientContextRevision, eligibility?.recipientCulture, page, search],
    queryFn: async ({signal}) => { try { return await listChatForms(contact.id, page, search, signal); } catch(error) { const feedback = errorFeedback(error); if(feedback.kind === "wait") beginWait(feedback.retryAfterSeconds); throw error; } }, enabled: open && !denied && !changed && eligibility?.status === "Eligible", retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false, meta: {errorOwner:"local"} });
  const preparationKey = useMemo(()=>[...chatKey,actor,"forms",contact.id,"preparation",eligibility?.recipientContextRevision,
    eligibility?.recipientCulture,form?.selection?.definitionId,form?.selection?.versionId,i18n.resolvedLanguage],
    [actor,contact.id,eligibility?.recipientContextRevision,eligibility?.recipientCulture,form?.selection?.definitionId,form?.selection?.versionId,i18n.resolvedLanguage]);
  const preparation = useQuery({queryKey:preparationKey,
    queryFn:async({signal})=>{
      try { return await prepareChatForm(contact.id,form!.selection!.definitionId,form!.selection!.versionId,signal); }
      catch(error){const feedback=errorFeedback(error);if(feedback.kind==="wait")beginWait(feedback.retryAfterSeconds);throw error;}
    }, enabled:open&&!denied&&!changed&&!!form?.selection&&!form.attempt,
    retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false,meta:{errorOwner:"local"}});
  const preparationNoticeId = "whatsapp:form-preparation:" + contact.id;
  const preparationError = preparation.error;
  useEffect(() => {
    if (!preparationError) { dismissNotification(preparationNoticeId); return; }
    const feedback = errorFeedback(preparationError);
    if (["session","forbidden","cancelled"].includes(feedback.kind)
      || preparationError instanceof ApiError && preparationError.status === 409) return;
    notify({id:preparationNoticeId,kind:"error",message:readErrorMessage(preparationError,t)});
  },[preparationError,preparationNoticeId,t]);
  useEffect(() => () => dismissNotification(preparationNoticeId),[preparationNoticeId]);
  useEffect(()=>()=>{queueMicrotask(()=>{const query=client.getQueryCache().find({queryKey:preparationKey,exact:true});
    if(query?.getObserversCount()===0){void client.cancelQueries({queryKey:preparationKey,exact:true});client.removeQueries({queryKey:preparationKey,exact:true});}});},[client,preparationKey]);
  if(preparation.error instanceof ApiError&&preparation.error.status===403&&!forbidden)setForbidden(true);
  const preparationChanged = Boolean(preparation.data&&(preparation.data.recipientContextRevision!==form?.recipientContextRevision));
  const { error: formsError, refetch: refetchForms } = forms;
  if (formsError instanceof ApiError && formsError.status === 403 && !forbidden) setForbidden(true);
  const versionChanged = Boolean(form?.selection && forms.data && selectedVersionChanged(form.selection, forms.data.page.items));
  const queryContextChanged = Boolean(form && forms.data && recipientChanged(form, forms.data.recipientContextRevision, forms.data.recipientCulture));
  const contextChanged = changed || preparationChanged || queryContextChanged || form?.blocked === "recipientChanged";
  const mayReadOptions = !denied && !(forms.error instanceof ApiError && forms.error.status === 403) && !changed && !queryContextChanged;
  const blockedReason = denied || form?.blocked === "forbidden" ? "send.forbidden" : contextChanged ? "forms.recipientChanged" : commonReason ?? (draft.attempt ? "send.pending" : recipientReason);
  useEffect(() => { current.current = draft; permitted.current = canSend; }, [draft,canSend]);
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(noticeId); }; }, [noticeId]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()),1000); return () => window.clearInterval(timer); },[]);
  useEffect(() => {
    if (!formsError) return;
    const feedback = errorFeedback(formsError);
    if (feedback.kind === "forbidden") { client.removeQueries({predicate:query=>query.queryKey[0]===chatKey[0]&&query.queryKey[1]===actor&&query.queryKey[2]==="forms"&&query.queryKey[3]===contact.id}); }
    if (feedback.kind !== "session" && feedback.kind !== "cancelled") notify({id:noticeId,kind:"error",message:feedback.detail ?? t("forms.loadFailed"),action:["forbidden","wait"].includes(feedback.kind)?undefined:{label:t("retry"),onClick:()=>{if(Date.now()>=waitDeadline.current)void refetchForms();}}});
  },[formsError,refetchForms,client,actor,contact.id,noticeId,t]);
  useEffect(() => { if (denied) client.removeQueries({predicate:query=>query.queryKey[0]===chatKey[0]&&query.queryKey[1]===actor&&query.queryKey[2]==="forms"&&query.queryKey[3]===contact.id}); }, [denied,client,actor,contact.id]);
  const updateForm = (update: (value: FormSendDraft) => FormSendDraft) => updateDraft(value => value.form ? {...value,form:update(value.form)} : value);
  const presentationCulture = !contextChanged && preparation.data ? preparation.data.culture : undefined;
  const presentationReady = Boolean(presentationCulture && (presentationCulture === "en" ? englishReady : spanishReady));
  const preparationBlocked = Boolean(form?.selection&&!form.attempt
    && (preparation.isPending||preparation.isFetching||preparation.isError||!preparation.data?.preparation.canSend||preparationChanged||!presentationReady));
  useEffect(() => {
    if (!open || !presentationCulture || !presentationReady || preparation.isFetching || preparation.isError || !form?.selection || form.attempt) return;
    const selectedKey = form.selection.definitionId + ":" + form.selection.versionId;
    const revision = form.recipientContextRevision;
    const text = t("forms.defaultMessage", { lng: presentationCulture });
    if (form.messageEdited || form.message === text) return;
    updateDraft(value => {
      const currentForm = value.form;
      if (!currentForm?.selection || currentForm.selection.definitionId + ":" + currentForm.selection.versionId !== selectedKey
        || currentForm.recipientContextRevision !== revision || currentForm.messageEdited || currentForm.attempt || currentForm.message === text) return value;
      return { ...value, form: { ...currentForm, message: text } };
    });
  }, [open,presentationCulture,presentationReady,preparation.isFetching,preparation.isError,form?.selection,form?.recipientContextRevision,form?.attempt,form?.message,form?.messageEdited,t,updateDraft]);
  const canOpen = !disabledReason && !denied && !form?.attempt && !sending && !checking && now >= waitUntil
    && !!eligibility?.recipientCulture && !!eligibility.recipientContextRevision;
  function show() {
    if (!canOpen || !eligibility?.recipientCulture || !eligibility.recipientContextRevision) return;
    const culture = eligibility.recipientCulture;
    const revision = eligibility.recipientContextRevision;
    updateDraft(value => ({...value, form:value.form ? {...value.form,recipientCulture:culture,recipientContextRevision:revision,modeRevision:contact.modeRevision,blocked:recipientChanged(value.form,revision,culture)?"recipientChanged":value.form.blocked} : {message:t("forms.defaultMessage",{lng:culture}),recipientCulture:culture,recipientContextRevision:revision,modeRevision:contact.modeRevision}}));
    setPage(1); setSearch(""); setOpen(true);
  }
  function choose(option: ChatFormOption) {
    if (!forms.data?.recipientCulture || !forms.data.recipientContextRevision || !mayReadOptions || form?.attempt) return;
    updateForm(value=>({...value,selection:option,recipientCulture:forms.data!.recipientCulture!,recipientContextRevision:forms.data!.recipientContextRevision!,modeRevision:contact.modeRevision,blocked:undefined,touched:true}));
    setSelectionError(undefined);
  }
  function confirmed(result: Outgoing) {
    updateDraft(value=>({...value,form:undefined}));
    if (!active.current || !permitted.current || Date.now() < waitDeadline.current) return;
    setOpen(false); dismissNotification(noticeId);
    client.setQueryData([...chatKey,actor,"outgoing",contact.id,result.requestId],result);
    void client.invalidateQueries({queryKey:chatKey});
  }
  async function submit() {
    if (pending.current || !canSend || denied || disabledReason || contextChanged || versionChanged || preparationBlocked || Date.now() < waitDeadline.current) return;
    const value = current.current.form;
    if (!value || (value.attempt && !value.notStored)) return;
    const issue = formMessageIssue(value.message);
    if (issue) { setFieldError(t("forms."+issue)); return; }
    if (!value.selection || value.blocked==="formUnavailable") {setSelectionError(t("forms.chooseRequired"));return;}
    const request = value.attempt ?? freezeFormMessage(value,crypto.randomUUID());
    pending.current = true; setSending(true); setFieldError(undefined);
    updateForm(old=>({...old,attempt:request,notStored:false}));
    try { confirmed(await sendFormMessage(contact.id,request,actor)); } catch(error) {
      const feedback=errorFeedback(error,{writing:true,fields:["message"],conflictCodes});
      const code=error instanceof ApiError?error.code:undefined;
      if (feedback.kind === "uncertain" || code === "WhatsApp.Chat.RequestConflict") {
        if (active.current) notify({id:noticeId,kind:"warning",message:t("forms.uncertain"),action:{label:t("send.check"),onClick:()=>void checkOutcome()}});
      } else {
        updateForm(old=>({...old,attempt:undefined,notStored:false,blocked:feedback.kind==="forbidden"?"forbidden":code==="WhatsApp.Flow.RecipientContextChanged"?"recipientChanged":code==="WhatsApp.Flow.FormUnavailable"?"formUnavailable":old.blocked}));
        if (active.current) {
          setFieldError(feedback.fields.message?.join(" "));
          if (code==="WhatsApp.Flow.FormUnavailable") setSelectionError(t("forms.formUnavailable"));
          if (feedback.kind==="forbidden") {setForbidden(true);client.removeQueries({predicate:query=>query.queryKey[0]===chatKey[0]&&query.queryKey[1]===actor&&query.queryKey[2]==="forms"&&query.queryKey[3]===contact.id});}
          if (feedback.kind==="wait") beginWait(feedback.retryAfterSeconds);
          if (feedback.kind!=="fields"&&feedback.kind!=="session") notify({id:noticeId,kind:feedback.kind==="conflict"?"warning":"error",message:feedback.kind==="forbidden"?t("send.forbidden"):feedback.detail??t("forms.sendFailed")});
          void client.invalidateQueries({queryKey:chatKey});
        }
      }
    } finally {pending.current=false;if(active.current)setSending(false);}
  }
  async function checkOutcome() {
    const request = current.current.form?.attempt;
    if (!request || pending.current || !permitted.current) return;
    pending.current=true;setChecking(true);
    try {confirmed(await recoverFormMessage(contact.id,request,actor));} catch(error) {
      if (error instanceof ApiError&&error.status===404) {updateForm(value=>({...value,notStored:true}));if(active.current&&permitted.current){setOpen(true);notify({id:noticeId,kind:"info",message:t("send.notStored")});}}
      else {const feedback=errorFeedback(error);if(active.current&&feedback.kind==="wait")beginWait(feedback.retryAfterSeconds);if(active.current&&feedback.kind!=="session")notify({id:noticeId,kind:"error",message:feedback.kind==="forbidden"?t("send.forbidden"):t("send.checkFailed"),action:["forbidden","wait"].includes(feedback.kind)?undefined:{label:t("send.check"),onClick:()=>void checkOutcome()}});if(feedback.kind==="forbidden"){setForbidden(true);client.removeQueries({predicate:query=>query.queryKey[0]===chatKey[0]&&query.queryKey[1]===actor&&query.queryKey[2]==="forms"&&query.queryKey[3]===contact.id});}}
    } finally {pending.current=false;if(active.current)setChecking(false);}
  }
  return {presentationCulture,presentationReady,canOpen,open,setOpen,page,setPage,search,setSearch,forms,preparation,preparationBlocked,form,show,choose,submit,checkOutcome,sending,checking,fieldError,setFieldError,selectionError,denied,mayReadOptions,contextChanged,versionChanged,disabledReason,blockedReason,waiting:now<waitUntil, waitSeconds:Math.max(0,Math.ceil((waitUntil-now)/1000)), retryForms:()=>{if(Date.now()>=waitDeadline.current&&!denied)void refetchForms();}, updateForm};
}
