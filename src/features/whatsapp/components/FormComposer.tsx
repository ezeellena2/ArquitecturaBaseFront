import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { useEffect, useEffectEvent, useId, useRef, type RefObject } from "react";
import type { AssistantComposerState } from "../hooks/useAssistantSuggestion";
import { useTranslation } from "react-i18next";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { DataList, type DataListItem } from "@/shared/ui/DataList";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormIcon } from "@/shared/ui/icons";
import { Spinner } from "@/shared/ui/Spinner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Picker, type PickerOption } from "@/shared/ui/Picker";
import { Textarea } from "@/shared/ui/textarea";
import type { Chat, Outgoing } from "../api/chat";
import type { ChatFormOption } from "../api/forms";
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
  useEffect(() => { onAvailabilityChange?.(state.canOpen && !assistant?.attempt && !assistantOpen); },[onAvailabilityChange,state.canOpen,assistant?.attempt,assistantOpen]);
  const openRequested = useEffectEvent(() => { if (!assistantOpen && !assistant?.attempt) state.show(); });
  useEffect(() => {if(openRequest>0)openRequested();},[openRequest]);
  const restoreFocus = useRestoreFocusOnClose(state.open || assistantOpen, focusFallback);
  const message = useRef<HTMLTextAreaElement>(null);
  const formField = useId();
  useEffect(()=>{if(state.fieldError)message.current?.focus();},[state.fieldError]);
  // A form to choose, or the chosen one that is no longer available, takes the focus to the field of the forms.
  useEffect(()=>{if(state.selectionError)document.getElementById(formField)?.focus();},[state.selectionError,formField]);
  const form = state.form;
  const selected = form?.selection;
  const frozen = Boolean(form?.attempt);
  const chosenKey = selected && !state.contextChanged ? formOptionKey(selected) : null;
  const deadline = new Date(Date.parse(contact.lastInboundAtUtc)+24*60*60*1000).toISOString();
  const language = i18n.resolvedLanguage ?? "es";
  // NI1-A (2026-11-03): «Le llega en …» names the language only when it is not the menu's.
  const menu = language.startsWith("en") ? "en" : "es";
  const name = contact.profileName ?? contact.linkedAccount?.displayName ?? t("unnamed");
  const presentationCulture = state.presentationCulture;
  const cta = presentationCulture && state.presentationReady ? t("forms.openForm",{lng:presentationCulture}) : undefined;
  // Each form says its version and questions in grey, and the chosen one goes in the language it will be sent in. One whose list
  // depends on another answer (CW7) or that is no longer available is off, with why (MA1-A).
  const formOption = (option: ChatFormOption): PickerOption => {
    const culture = selected && formOptionKey(option) === formOptionKey(selected) && presentationCulture ? presentationCulture : form?.recipientCulture ?? "es";
    const dependent = formOptionDependentQuestion(option, culture);
    const unavailable = form?.blocked === "formUnavailable" && option.versionId === selected?.versionId;
    return { id: formOptionKey(option), label: formOptionName(option, culture),
      description: dependent ? null : t("forms.optionDescription", { version: option.versionNumber, count: option.questionCount }),
      disabledReason: dependent ? t("forms.dependsOnAnswer", { question: dependent }) : unavailable ? t("forms.optionUnavailable") : null };
  };
  // Why a form cannot be sent (the account, the forms) and the wait of a 429 are the help of the disabled button, never a text beside it.
  // The reasons of the conversation (send.*) are told above the composer.
  const accountReason = state.disabledReason?.startsWith("forms.") ? t(state.disabledReason) : null;
  const waitReason = (working: boolean, waiting: boolean, seconds: number) => waiting && !working ? t("forms.waitingHint",{count:seconds}) : null;
  // A 429 of the list or of the preparation also turns off their Retry and the field of the forms, whose list searches and
  // pages, with the same reason. The field keeps the width of the dialog while it waits.
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
  // What goes out reads in two columns, the same in both branches (DL, 2026-11-11), never in loose paragraphs: the form and its
  // version where nothing else names them (in the list, the field of the forms does), the language only when it is not the menu's
  // (NI1-A) and until when it can be sent, in the profile's zone.
  const sendData = (culture: string | undefined, chosen?: { name: string; version: number }) => {
    const items: DataListItem[] = chosen ? [{ key: "form", label: t("forms.formLabel"), value: chosen.name }, { key: "version", label: t("forms.versionLabel"), value: chosen.version }] : [];
    if (culture && culture !== menu) items.push({ key: "language", label: t("common:language.label"), value: t("common:language." + culture) });
    if (!state.contextChanged && !state.denied) items.push({ key: "deadline", label: t("forms.deadlineLabel"), value: formatDateTimeInZone(deadline, language, timeZone) });
    return items.length ? <DataList items={items} /> : null;
  };
  return <>
    {canSend ? <div className="min-w-0">
      <div className="flex flex-wrap gap-2"><DisabledReason reason={accountReason}><Button variant="outline" size="sm" disabled={Boolean(state.disabledReason)||state.denied||frozen||state.sending||Boolean(assistant?.attempt)||assistantOpen} onClick={state.show}><FormIcon />{t("forms.action")}</Button></DisabledReason>
      {frozen&&!state.open ? <DisabledReason reason={waitReason(state.checking||state.sending, state.waiting, state.waitSeconds)}><Button variant="outline" size="sm" pending={state.checking} disabled={state.sending||state.denied||state.waiting} onClick={()=>void state.checkOutcome()}>{t(state.checking?"send.checking":"send.check")}</Button></DisabledReason> : null}</div>
    </div> : null}
    <Dialog open={state.open || assistantOpen} onOpenChange={open=>{if(!busy){if(assistantOpen)assistant?.setOpen(open);else state.setOpen(open);}}}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={restoreFocus} className="sm:max-w-150" showCloseButton={!busy} onEscapeKeyDown={event=>{if(busy)event.preventDefault();}} onPointerDownOutside={event=>{if(busy)event.preventDefault();}}>
        <DialogHeader><DialogTitle>{t("forms.title",{name})}</DialogTitle></DialogHeader>
        {assistantOpen && assistant?.proposal ? <>
          {sendData(assistant.proposal.culture, { name: assistant.proposal.name, version: assistant.proposal.versionNumber })}
          {/* The data the assistant proposes are chosen with the shared piece, several at a time (DS1-A): the field names the chosen
              ones and its list says each value in grey. The (i) of the field stays usable while the piece is off. */}
          {assistant.proposal.fields.length ? <FormField label={t("assistant.prefilledTitle")} help={t("assistant.prefilledHelp", { name })}>
            <Picker multiple label={t("assistant.prefilledTitle")} placeholder={t("assistant.prefilledNone")} disabled={assistant.busy || Boolean(assistant.attempt)}
              value={assistant.selected} onChange={next => assistant.setSelected([...next])}
              options={assistant.proposal.fields.map(field => ({ id: field.fieldId, label: field.label, description: field.displayValue }))} />
          </FormField> : null}
          <DialogFooter>
            <Button variant="outline" disabled={busy} onClick={() => assistant.setOpen(false)}>{t("forms.cancel")}</Button>
            <DisabledReason reason={waitReason(assistant.busy, assistant.waiting, assistant.waitSeconds)} className={footerReason}>{assistant.attempt && assistant.recovery === "consult" && !sendingSuggestion ? <Button variant="outline" pending={consulting} disabled={assistant.busy || assistant.waiting} onClick={() => void assistant.consult()}>{t(consulting ? "send.checking" : "send.check")}</Button> : <Button pending={sendingSuggestion} disabled={assistant.busy || assistant.waiting || Boolean(state.disabledReason) || Boolean(draft.attempt)} onClick={() => void assistant.send()}>{t(sendingSuggestion ? "forms.saving" : assistant.attempt ? "send.retry" : "forms.action")}</Button>}</DisabledReason>
          </DialogFooter>
        </> : <>
        {/* The forms go in the only piece to choose, from the server (2026-11-22): the search, «Mostrar N más», the wait and the
            failure with its Retry are said inside its list. The chosen one of another page stays first, chosen, and the field keeps
            its name (LR3-A). A 429 turns the field off with the wait as its reason. */}
        {state.mayReadOptions ? <FormField label={t("forms.formLabel")} htmlFor={formField} error={state.selectionError}>
          <DisabledReason reason={retryReason} className={regionReason}>
            <Picker label={t("forms.formLabel")} placeholder={t("forms.choose")} disabled={frozen||state.sending||state.waiting} value={chosenKey}
              options={state.formList.options.map(formOption)} selectedOptions={selected&&chosenKey ? [formOption(selected)] : undefined}
              search={state.search} onSearchChange={state.setSearch} total={state.formList.total} loading={state.formList.loading} failed={state.formList.failed}
              onRetry={state.retryForms} retryReason={retryReason} onLoadMore={state.formList.onLoadMore} loadingMore={state.formList.loadingMore} pageSize={state.formList.pageSize}
              onChange={key=>{if(key===chosenKey)return;const option=state.formList.options.find(value=>formOptionKey(value)===key);if(option)state.choose(option);}} />
          </DisabledReason>
        </FormField> : null}
        {sendData(state.mayReadOptions ? presentationCulture : undefined)}
        {recipientChanged ? <Banner tone="danger">{t("forms.recipientChanged")}</Banner>
          : state.mayReadOptions&&!state.contextChanged&&selected&&!frozen ? !state.presentationReady && state.preparation.isSuccess ? <div role="status" className="flex items-center gap-2 text-sm text-[var(--color-content-muted)]"><Spinner decorative />{t("forms.preparing")}</div> : <FormCatalogPreparation hasCatalogQuestions={selected.hasCatalogQuestions===true} query={state.preparation} waitReason={retryReason} recipientName={name} /> : null}
        {/* Required, without a legend under it: what the person reads above «Abrir formulario» goes in the (i). Its count is the
            datum of the field (DL, 2026-11-11), which an error replaces. */}
        <FormField label={t("forms.messageLabel")} required error={state.fieldError} hint={t("forms.messageLength",{length:form?.message.length??0})} help={state.mayReadOptions&&selected&&presentationCulture&&state.presentationReady?t("forms.messageHelp",{cta,submitLabel:selected.submitLabel[presentationCulture]}):undefined}>
          <Textarea ref={message} aria-required value={form?.message??""} disabled={frozen||state.sending} rows={3} onChange={event=>{const text=event.target.value;state.updateForm(value=>({...value,message:text,messageEdited:true,touched:true}));state.setFieldError(undefined);}} />
        </FormField>
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
