import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { useEffect, useEffectEvent, useId, useRef, type RefObject } from "react";
import type { AssistantComposerState } from "../hooks/useAssistantSuggestion";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { useTranslation } from "react-i18next";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormIcon } from "@/shared/ui/icons";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Spinner } from "@/shared/ui/Spinner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Textarea } from "@/shared/ui/textarea";
import { SearchInput } from "@/shared/ui/SearchInput";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Pagination } from "@/shared/ui/Pagination";
import type { Chat, Outgoing } from "../api/chat";
import type { ChatDraft } from "./ChatComposer";
import { useFormComposer } from "../hooks/useFormComposer";
import { FormCatalogPreparation } from "./FormCatalogPreparation";
import { formOptionDependentQuestion, formOptionKey, formOptionName } from "../lib/formSendSession";

export function FormComposer({ contact, actor, canSend, outgoing, draft, updateDraft, timeZone, openRequest = 0, onAvailabilityChange, assistant, focusFallback }: { assistant?: AssistantComposerState; focusFallback?: RefObject<HTMLElement | null>; contact: Chat; actor: string; canSend: boolean; outgoing: Outgoing[]; draft: ChatDraft; updateDraft: (update: (value: ChatDraft) => ChatDraft) => void; timeZone?: string; openRequest?: number; onAvailabilityChange?: (canOpen: boolean) => void }) {
  const { t, i18n } = useTranslation("whatsapp");
  const state = useFormComposer(contact,actor,canSend,outgoing,draft,updateDraft);
  const assistantOpen = Boolean(assistant?.open);
  // Sending freezes the dialog on purpose (no ×, Escape nor Cancel) until the answer. Checking a lost send is a read: the
  // dialog stays closable and the footer shows its progress.
  const busy = assistantOpen ? assistant?.busyAction === "send" : state.sending;
  const prefilledTitleId = useId();
  const prefilledHelpId = useId();
  useEffect(() => { onAvailabilityChange?.(state.canOpen && !assistant?.attempt && !assistantOpen); },[onAvailabilityChange,state.canOpen,assistant?.attempt,assistantOpen]);
  const openRequested = useEffectEvent(() => { if (!assistantOpen && !assistant?.attempt) state.show(); });
  useEffect(() => {if(openRequest>0)openRequested();},[openRequest]);
  const restoreFocus = useRestoreFocusOnClose(state.open || assistantOpen, focusFallback);
  const message = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(()=>{if(state.fieldError)message.current?.focus();},[state.fieldError]);
  useEffect(()=>{if(state.selectionError)list.current?.querySelector<HTMLButtonElement>('[role="radio"]')?.focus();},[state.selectionError]);
  const form = state.form;
  const selected = form?.selection;
  const items = state.mayReadOptions ? state.forms.data?.page.items ?? [] : [];
  const frozen = Boolean(form?.attempt);
  const offPage = Boolean(selected && !items.some(option => formOptionKey(option)===formOptionKey(selected)));
  // The chosen form of another page stays first in the list, with its chosen card (LR3-A, 2026-11-03); on its page, in its place.
  const listed = offPage&&selected&&!state.contextChanged ? [selected, ...items] : items;
  // Another page moves the focus to its first form, past the chosen one that stays on top.
  const pinned = listed.length - items.length;
  const focusPage = useRef(false);
  useEffect(() => { if (focusPage.current && !state.forms.isFetching && state.forms.data) { focusPage.current = false; list.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[pinned]?.focus(); } }, [state.forms.data, state.forms.isFetching, pinned]);
  const deadline = new Date(Date.parse(contact.lastInboundAtUtc)+24*60*60*1000).toISOString();
  const language = i18n.resolvedLanguage ?? "es";
  // NI1-A (2026-11-03): «Le llega en …» names the language only when it is not the menu's.
  const menu = language.startsWith("en") ? "en" : "es";
  const name = contact.profileName ?? contact.linkedAccount?.displayName ?? t("unnamed");
  const presentationCulture = state.presentationCulture;
  const cta = presentationCulture && state.presentationReady ? t("forms.openForm",{lng:presentationCulture}) : undefined;
  // Why a form cannot be sent (the account, the forms) and the wait of a 429 are the help of the disabled button, never a text beside it.
  // The reasons of the conversation (send.*) are told above the composer.
  const accountReason = state.disabledReason?.startsWith("forms.") ? t(state.disabledReason) : null;
  const waitReason = (working: boolean, waiting: boolean, seconds: number) => waiting && !working ? t("forms.waitingHint",{count:seconds}) : null;
  // A 429 of the list or of the preparation also turns off their Retry, the search, the form cards and the pagination, with
  // the same reason. Those regions keep the width of the dialog while they wait.
  const retryReason = waitReason(false, state.waiting, state.waitSeconds);
  const regionReason = "grid w-full";
  // On the phone the footer stacks its buttons at full width; the wrapper of a waiting one keeps that width.
  const footerReason = "max-sm:*:flex-1";
  // Why the form cannot be sent any more (permission, mode, the 24 hours, a pending send…) is the reason of the disabled
  // primary, not a paragraph above the footer (C4, 2026-11-01). A changed recipient asks to close and refresh: it goes in a
  // red notice, like the 409 of the preparation. While the primary works, it has no reason.
  const checkInFooter = frozen&&!form?.notStored&&!state.sending;
  const recipientChanged = state.blockedReason==="forms.recipientChanged";
  const blockedReason = state.blockedReason&&!recipientChanged ? t(state.blockedReason) : null;
  const primaryReason = waitReason(state.sending||state.checking, state.waiting, state.waitSeconds)
    ?? (state.sending||state.checking ? null : checkInFooter ? (state.denied ? blockedReason : null) : blockedReason);
  const consulting = assistant?.busyAction === "consult";
  const sendingSuggestion = assistant?.busyAction === "send";
  return <>
    {canSend ? <div className="min-w-0">
      <div className="flex flex-wrap gap-2"><DisabledReason reason={accountReason}><Button variant="outline" size="sm" disabled={Boolean(state.disabledReason)||state.denied||frozen||state.sending||Boolean(assistant?.attempt)||assistantOpen} onClick={state.show}><FormIcon />{t("forms.action")}</Button></DisabledReason>
      {frozen&&!state.open ? <DisabledReason reason={waitReason(state.checking||state.sending, state.waiting, state.waitSeconds)}><Button variant="outline" size="sm" pending={state.checking} disabled={state.sending||state.denied||state.waiting} onClick={()=>void state.checkOutcome()}>{t(state.checking?"send.checking":"send.check")}</Button></DisabledReason> : null}</div>
    </div> : null}
    <Dialog open={state.open || assistantOpen} onOpenChange={open=>{if(!busy){if(assistantOpen)assistant?.setOpen(open);else state.setOpen(open);}}}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={restoreFocus} className="sm:max-w-150" showCloseButton={!busy} onEscapeKeyDown={event=>{if(busy)event.preventDefault();}} onPointerDownOutside={event=>{if(busy)event.preventDefault();}}>
        <DialogHeader><DialogTitle>{t("forms.title",{name})}</DialogTitle></DialogHeader>
        {assistantOpen && assistant?.proposal ? <>
          <p className="break-words text-sm font-medium">{t("assistant.version", { name: assistant.proposal.name, version: assistant.proposal.versionNumber })}</p>
          {assistant.proposal.culture !== menu ? <p className="text-sm text-[var(--color-content-muted)]">{t("forms.language",{language:t("forms.culture."+assistant.proposal.culture)})}</p> : null}
          {assistant.proposal.fields.length ? <fieldset aria-labelledby={prefilledTitleId} aria-describedby={prefilledHelpId} disabled={assistant.busy || Boolean(assistant.attempt)}>
            {/* The (i) goes in the legend, next to its title: there it stays usable while the boxes are off. */}
            <legend className="mb-2 flex items-center gap-1 text-xs font-medium uppercase text-[var(--color-content-muted)]"><span id={prefilledTitleId}>{t("assistant.prefilledTitle")}</span><span className="-my-1 inline-flex"><InfoTip id={prefilledHelpId} text={t("assistant.prefilledHelp", { name })} label={t("common:actions.moreInfo", { label: t("assistant.prefilledTitle") })} /></span></legend>
            {assistant.proposal.fields.map(field => <CheckboxField key={field.fieldId} label={field.label} description={field.displayValue} checked={assistant.selected.includes(field.fieldId)} disabled={assistant.busy || Boolean(assistant.attempt)} onCheckedChange={checked => assistant.setSelected(current => checked ? [...current, field.fieldId] : current.filter(id => id !== field.fieldId))} />)}
          </fieldset> : null}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => assistant.setOpen(false)}>{t("forms.cancel")}</Button>
            <DisabledReason reason={waitReason(assistant.busy, assistant.waiting, assistant.waitSeconds)} className={footerReason}>{assistant.attempt && assistant.recovery === "consult" && !sendingSuggestion ? <Button variant="outline" pending={consulting} disabled={assistant.busy || assistant.waiting} onClick={() => void assistant.consult()}>{t(consulting ? "send.checking" : "send.check")}</Button> : <Button pending={sendingSuggestion} disabled={assistant.busy || assistant.waiting || Boolean(state.disabledReason) || Boolean(draft.attempt)} onClick={() => void assistant.send()}>{t(sendingSuggestion ? "forms.saving" : assistant.attempt ? "send.retry" : "forms.action")}</Button>}</DisabledReason>
          </DialogFooter>
        </> : <>
        {state.mayReadOptions ? <div className="flex flex-col gap-3" ref={list}>
          {/* Another search or page keeps the forms and the pagination in sight while it reads, with its progress beside the search. */}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1"><DisabledReason reason={retryReason} className={regionReason}><fieldset disabled={state.waiting}><SearchInput value={state.search} onChange={value=>{state.setSearch(value);state.setPage(1);}} label={t("forms.search")} /></fieldset></DisabledReason></div>
            {state.forms.isPlaceholderData ? <span role="status" className="inline-flex shrink-0"><Spinner decorative /><span className="sr-only">{t("forms.loading")}</span></span> : null}
          </div>
          {state.forms.isError || state.retryingForms ? <div className="flex items-center justify-between gap-2"><p className="text-sm text-[var(--color-content-muted)]">{t("forms.listUnavailable")}</p><DisabledReason reason={state.retryingForms ? null : retryReason}><Button variant="outline" size="sm" pending={state.retryingForms} disabled={state.waiting} onClick={state.retryForms}>{t(state.retryingForms ? "retrying" : "retry")}</Button></DisabledReason></div>
            : state.forms.isPending ? <div role="status" className="flex items-center gap-2 text-sm text-[var(--color-content-muted)]"><Spinner decorative />{t("forms.loading")}</div> : <DisabledReason reason={retryReason} className={regionReason}><fieldset className="min-w-0"><RadioGroupField label={t("forms.formLabel")} variant="cards" value={selected&&!state.contextChanged?formOptionKey(selected):undefined} onValueChange={key=>{const option=listed.find(value=>formOptionKey(value)===key);if(option)state.choose(option);}} error={state.selectionError} options={listed.map(option=>{const culture=selected&&formOptionKey(option)===formOptionKey(selected)&&presentationCulture?presentationCulture:form?.recipientCulture??"es";
                  // CW7: a list that depends on another answer is loaded in the app; the card says so and cannot be chosen.
                  const dependent=formOptionDependentQuestion(option,culture);
                  return {value:formOptionKey(option),label:formOptionName(option,culture),description:dependent?t("forms.dependsOnAnswer",{question:dependent}):t("forms.optionDescription",{version:option.versionNumber,count:option.questionCount}),disabled:!!dependent||frozen||state.sending||state.waiting||(form?.blocked==="formUnavailable"&&option.versionId===selected?.versionId)};})} /></fieldset></DisabledReason>}
          {!state.forms.isPending&&!state.forms.isError&&!items.length ? <p className="text-sm text-[var(--color-content-muted)]">{t("forms.noResults")}</p> : null}
          {state.forms.data ? <DisabledReason reason={retryReason} className={regionReason}><fieldset disabled={state.waiting}><Pagination {...state.forms.data.page} onPageChange={page=>{focusPage.current=true;state.setPage(page);}} /></fieldset></DisabledReason> : null}
          {presentationCulture && presentationCulture !== menu ? <p className="text-sm text-[var(--color-content-muted)]">{t("forms.language",{language:t("forms.culture."+presentationCulture)})}</p> : null}
        </div> : null}
        {recipientChanged ? <Banner tone="danger">{t("forms.recipientChanged")}</Banner>
          : state.mayReadOptions&&!state.contextChanged&&selected&&!frozen ? !state.presentationReady && state.preparation.isSuccess ? <div role="status" className="flex items-center gap-2 text-sm text-[var(--color-content-muted)]"><Spinner decorative />{t("forms.preparing")}</div> : <FormCatalogPreparation hasCatalogQuestions={selected.hasCatalogQuestions===true} query={state.preparation} waitReason={retryReason} recipientName={name} /> : null}
        {/* Required, without a legend under it: what the person reads above «Abrir formulario» goes in the (i). */}
        <FormField label={t("forms.messageLabel")} required error={state.fieldError} help={state.mayReadOptions&&selected&&presentationCulture&&state.presentationReady?t("forms.messageHelp",{cta,submitLabel:selected.submitLabel[presentationCulture]}):undefined}>
          <Textarea ref={message} aria-required value={form?.message??""} disabled={frozen||state.sending} rows={3} onChange={event=>{const text=event.target.value;state.updateForm(value=>({...value,message:text,messageEdited:true,touched:true}));state.setFieldError(undefined);}} />
        </FormField>
        <p className="text-right text-xs text-[var(--color-content-muted)]">{form?.message.length??0} / 1024</p>
        {!state.contextChanged&&!state.denied ? <p className="text-xs text-[var(--color-content-muted)]">{t("forms.deadline",{deadline:formatDateTimeInZone(deadline,language,timeZone)})}</p> : null}
        {state.versionChanged ? <p className="text-sm text-[var(--color-content-muted)]">{t("forms.formUnavailable")}</p> : null}
        <DialogFooter>
          <Button variant="outline" disabled={state.sending} onClick={()=>state.setOpen(false)}>{t("forms.cancel")}</Button>
          <DisabledReason reason={primaryReason} className={footerReason}>{checkInFooter ? <Button variant="outline" pending={state.checking} disabled={state.denied||state.waiting} onClick={()=>void state.checkOutcome()}>{t(state.checking?"send.checking":"send.check")}</Button> : <Button pending={state.sending} disabled={state.checking||Boolean(state.blockedReason)||state.versionChanged||state.waiting||state.forms.isError||state.forms.isFetching||state.preparationBlocked||(!form?.notStored&&!selected)||form?.blocked==="formUnavailable"} onClick={()=>void state.submit()}>{t(state.sending?"forms.saving":form?.notStored?"send.retry":"forms.action")}</Button>}</DisabledReason>
        </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
