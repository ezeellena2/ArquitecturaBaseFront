import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import type { AssistantComposerState } from "../hooks/useAssistantSuggestion";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { useTranslation } from "react-i18next";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { FormIcon } from "@/shared/ui/icons";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Textarea } from "@/shared/ui/textarea";
import { SearchInput } from "@/shared/ui/SearchInput";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Pagination } from "@/shared/ui/Pagination";
import type { Chat, Outgoing } from "../api/chat";
import type { ChatDraft } from "./ChatComposer";
import { useFormComposer } from "../hooks/useFormComposer";
import { FormCatalogPreparation } from "./FormCatalogPreparation";
import { formOptionKey, formOptionName } from "../lib/formSendSession";

export function FormComposer({ contact, actor, canSend, outgoing, draft, updateDraft, timeZone, openRequest = 0, onAvailabilityChange, assistant, focusFallback }: { assistant?: AssistantComposerState; focusFallback?: RefObject<HTMLElement | null>; contact: Chat; actor: string; canSend: boolean; outgoing: Outgoing[]; draft: ChatDraft; updateDraft: (update: (value: ChatDraft) => ChatDraft) => void; timeZone?: string; openRequest?: number; onAvailabilityChange?: (canOpen: boolean) => void }) {
  const { t, i18n } = useTranslation("whatsapp");
  const state = useFormComposer(contact,actor,canSend,outgoing,draft,updateDraft);
  const assistantOpen = Boolean(assistant?.open);
  const busy = assistantOpen ? Boolean(assistant?.busy) : state.sending;
  useEffect(() => { onAvailabilityChange?.(state.canOpen && !assistant?.attempt && !assistantOpen); },[onAvailabilityChange,state.canOpen,assistant?.attempt,assistantOpen]);
  const openRequested = useEffectEvent(() => { if (!assistantOpen && !assistant?.attempt) state.show(); });
  useEffect(() => {if(openRequest>0)openRequested();},[openRequest]);
  const restoreFocus = useRestoreFocusOnClose(state.open || assistantOpen, focusFallback);
  const message = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(()=>{if(state.fieldError)message.current?.focus();},[state.fieldError]);
  useEffect(()=>{if(state.selectionError)list.current?.querySelector<HTMLButtonElement>('[role="radio"]')?.focus();},[state.selectionError]);
  const focusPage = useRef(false);
  useEffect(() => { if (focusPage.current && !state.forms.isFetching && state.forms.data) { focusPage.current = false; list.current?.querySelector<HTMLButtonElement>('[role="radio"]')?.focus(); } }, [state.forms.data, state.forms.isFetching]);
  const form = state.form;
  const selected = form?.selection;
  const items = state.mayReadOptions ? state.forms.data?.page.items ?? [] : [];
  const frozen = Boolean(form?.attempt);
  const offPage = Boolean(selected && !items.some(option => formOptionKey(option)===formOptionKey(selected)));
  const deadline = new Date(Date.parse(contact.lastInboundAtUtc)+24*60*60*1000).toISOString();
  const language = i18n.resolvedLanguage ?? "es";
  const name = contact.profileName ?? contact.linkedAccount?.displayName ?? t("unnamed");
  const presentationCulture = state.presentationCulture;
  const cta = presentationCulture && state.presentationReady ? t("forms.openForm",{lng:presentationCulture}) : undefined;
  return <>
    {canSend ? <div className="min-w-0">
      <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={Boolean(state.disabledReason)||state.denied||frozen||state.sending||Boolean(assistant?.attempt)||assistantOpen} onClick={state.show}><FormIcon />{t("forms.action")}</Button>
      {frozen&&!state.open ? <Button variant="outline" size="sm" disabled={state.checking||state.sending||state.denied||state.waiting} onClick={()=>void state.checkOutcome()}>{t("send.check")}</Button> : null}</div>
      {state.disabledReason&&state.disabledReason.startsWith("forms.") ? <p className="mt-2 text-xs text-[var(--color-content-muted)]">{t(state.disabledReason)}</p> : null}
    </div> : null}
    <Dialog open={state.open || assistantOpen} onOpenChange={open=>{if(!busy){if(assistantOpen)assistant?.setOpen(open);else state.setOpen(open);}}}>
      <DialogContent onCloseAutoFocus={restoreFocus} className="sm:max-w-[600px]" showCloseButton={!busy} onEscapeKeyDown={event=>{if(busy)event.preventDefault();}} onPointerDownOutside={event=>{if(busy)event.preventDefault();}}>
        <DialogHeader><DialogTitle>{t("forms.title",{name})}</DialogTitle><DialogDescription>{t(assistantOpen ? "assistant.dialogDescription" : "forms.description")}</DialogDescription></DialogHeader>
        {contact.mode === "Manual" ? <p className="text-sm text-[var(--color-content-muted)]">{t("mode.manualContinues")}</p> : null}
        {assistantOpen && assistant?.proposal ? <>
          <p className="break-words text-sm font-medium">{t("assistant.version", { name: assistant.proposal.name, version: assistant.proposal.versionNumber })}</p>
          <p className="text-sm text-[var(--color-content-muted)]">{t("forms.language",{language:t("forms.culture."+assistant.proposal.culture)})}</p>
          {assistant.proposal.fields.length ? <fieldset disabled={assistant.busy || Boolean(assistant.attempt)}>
            <legend className="mb-2 text-xs font-medium uppercase text-[var(--color-content-muted)]">{t("assistant.prefilledTitle")}</legend>
            {assistant.proposal.fields.map(field => <CheckboxField key={field.fieldId} label={field.label} description={field.displayValue} checked={assistant.selected.includes(field.fieldId)} disabled={assistant.busy || Boolean(assistant.attempt)} onCheckedChange={checked => assistant.setSelected(current => checked ? [...current, field.fieldId] : current.filter(id => id !== field.fieldId))} />)}
          </fieldset> : null}
          <p className="text-sm text-[var(--color-content-muted)]">{t("assistant.prefilledHelp", { name })}</p>
          {assistant.waiting ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("forms.waitingHint", { seconds: assistant.waitSeconds })}</p> : null}
          <DialogFooter>
            <Button variant="outline" disabled={assistant.busy} onClick={() => assistant.setOpen(false)}>{t("forms.cancel")}</Button>
            {assistant.attempt && assistant.recovery === "consult" ? <Button variant="outline" disabled={assistant.busy || assistant.waiting} onClick={() => void assistant.consult()}>{t("send.check")}</Button> : <Button disabled={assistant.busy || assistant.waiting || Boolean(state.disabledReason) || Boolean(draft.attempt)} onClick={() => void assistant.send()}>{t(assistant.busy ? "forms.saving" : assistant.attempt ? "send.retry" : "forms.action")}</Button>}
          </DialogFooter>
        </> : <>
        {state.mayReadOptions ? <div className="flex flex-col gap-3" ref={list}>
          <fieldset disabled={state.waiting}><SearchInput value={state.search} onChange={value=>{state.setSearch(value);state.setPage(1);}} label={t("forms.search")} /></fieldset>
          {state.forms.isPending ? <p className="text-sm text-[var(--color-content-muted)]">{t("forms.loading")}</p> : state.forms.isError ? <div className="flex items-center justify-between gap-2"><p className="text-sm text-[var(--color-content-muted)]">{t("forms.listUnavailable")}</p><Button variant="outline" size="sm" disabled={state.waiting} onClick={state.retryForms}>{t("retry")}</Button></div> : <RadioGroupField label={t("forms.formLabel")} variant="cards" value={selected&&!state.contextChanged?formOptionKey(selected):undefined} onValueChange={key=>{const option=items.find(value=>formOptionKey(value)===key);if(option)state.choose(option);}} error={state.selectionError} options={items.map(option=>({value:formOptionKey(option),label:formOptionName(option,selected&&formOptionKey(option)===formOptionKey(selected)&&presentationCulture?presentationCulture:form?.recipientCulture??"es"),description:t("forms.optionDescription",{version:option.versionNumber,count:option.questionCount}),disabled:frozen||state.sending||state.waiting||(form?.blocked==="formUnavailable"&&option.versionId===selected?.versionId)}))} />}
          {!state.forms.isPending&&!state.forms.isError&&!items.length ? <p className="text-sm text-[var(--color-content-muted)]">{t("forms.noResults")}</p> : null}
          {offPage&&selected&&!state.contextChanged ? <p className="text-sm text-[var(--color-content-muted)]">{t("forms.selected",{name:formOptionName(selected,presentationCulture??form?.recipientCulture??"es"),version:selected.versionNumber})}</p> : null}
          {state.forms.data ? <fieldset disabled={state.waiting}><Pagination {...state.forms.data.page} onPageChange={page=>{focusPage.current=true;state.setPage(page);}} /></fieldset> : null}
          {presentationCulture ? <p className="text-sm text-[var(--color-content-muted)]">{t("forms.language",{language:t("forms.culture."+presentationCulture)})}</p> : null}
        </div> : null}
        {state.mayReadOptions&&!state.contextChanged&&selected&&!frozen ? !state.presentationReady && state.preparation.isSuccess ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("forms.preparing")}</p> : <FormCatalogPreparation hasCatalogQuestions={selected.hasCatalogQuestions===true} query={state.preparation} waiting={state.waiting} /> : null}
        <FormField label={t("forms.messageLabel")} error={state.fieldError} hint={state.mayReadOptions&&selected&&presentationCulture&&state.presentationReady?t("forms.messageHelp",{cta,submitLabel:selected.submitLabel[presentationCulture]}):t("forms.messageRequiredInfo")}>
          <Textarea ref={message} value={form?.message??""} disabled={frozen||state.sending} rows={3} onChange={event=>{const text=event.target.value;state.updateForm(value=>({...value,message:text,messageEdited:true,touched:true}));state.setFieldError(undefined);}} />
        </FormField>
        <p className="text-right text-xs text-[var(--color-content-muted)]">{form?.message.length??0} / 1024</p>
        {!state.contextChanged&&!state.denied ? <p className="text-xs text-[var(--color-content-muted)]">{t("forms.deadline",{deadline:formatDateTimeInZone(deadline,language,timeZone)})}</p> : null}
        {state.blockedReason ? <p className="text-sm text-[var(--color-content-muted)]">{t(state.blockedReason)}</p> : null}
        {state.versionChanged ? <p className="text-sm text-[var(--color-content-muted)]">{t("forms.formUnavailable")}</p> : null}
        {state.waiting ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("forms.waitingHint",{seconds:state.waitSeconds})}</p> : null}
        <DialogFooter>
          <Button variant="outline" disabled={state.sending} onClick={()=>state.setOpen(false)}>{t("forms.cancel")}</Button>
          {frozen&&!form?.notStored&&!state.sending ? <Button variant="outline" disabled={state.checking||state.denied||state.waiting} onClick={()=>void state.checkOutcome()}>{t("send.check")}</Button> : <Button disabled={state.sending||state.checking||Boolean(state.blockedReason)||state.versionChanged||state.waiting||state.forms.isError||state.forms.isFetching||state.preparationBlocked||(!form?.notStored&&!selected)||form?.blocked==="formUnavailable"} onClick={()=>void state.submit()}>{t(state.sending?"forms.saving":form?.notStored?"send.retry":"forms.action")}</Button>}
        </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
