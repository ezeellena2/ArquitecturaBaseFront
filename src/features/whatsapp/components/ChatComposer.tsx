import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { ChatIcon, FormIcon } from "@/shared/ui/icons";
import { useAssistantSuggestion, type AssistantComposerContext } from "../hooks/useAssistantSuggestion";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Spinner } from "@/shared/ui/Spinner";
import { Textarea } from "@/shared/ui/textarea";
import { chatKey, findOutgoing, sendText, type Chat, type Outgoing } from "../api/chat";
import { replyDisabledReason } from "../lib/replyAvailability";
import { FormComposer } from "./FormComposer";
import type { FormSendDraft } from "../lib/formSendSession";

export interface ChatDraft {
  body: string;
  form?: FormSendDraft;
  attempt?: { requestId: string; body: string; checking: boolean; notStored: boolean };
}

interface ChatComposerProps {
  contact: Chat; actor: string; canSend: boolean; outgoing: Outgoing[]; draft: ChatDraft;
  updateDraft: (update: (current: ChatDraft) => ChatDraft) => void; timeZone?: string; formOpenRequest?: number; onFormAvailabilityChange?: (canOpen: boolean) => void;
  assistantContext?: AssistantComposerContext; focusFallback?: RefObject<HTMLElement | null>;
}
export function ChatComposer({ contact, actor, canSend, outgoing, draft, updateDraft, timeZone, formOpenRequest = 0, onFormAvailabilityChange, assistantContext, focusFallback }: ChatComposerProps) {
  const { t } = useTranslation("whatsapp");
  const { t: agent } = useTranslation("whatsappAssistant");
  const client = useQueryClient();
  const reply = useRef<HTMLTextAreaElement>(null);
  const [fieldError, setFieldError] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [sending, setSending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const draftRef = useRef(draft);
  const sendingRef = useRef(false);
  const checkingRef = useRef(false);
  useEffect(() => { draftRef.current = draft; }, [draft]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 15000); return () => window.clearInterval(timer); }, []);
  const noticeId = `whatsapp:send:${contact.id}`;
  useEffect(() => () => dismissNotification(noticeId), [noticeId]);
  const refresh = () => void client.invalidateQueries({ queryKey: chatKey });
  function accepted(body: string) {
    dismissNotification(noticeId);
    updateDraft(current => ({ ...current, body: current.body.trim() === body ? "" : current.body, attempt: undefined }));
    refresh();
  }
  async function send(requestId: string, body: string) {
    try {
      await sendText(contact.id, requestId, body);
      accepted(body);
    } catch (error) {
      const feedback = errorFeedback(error, { writing: true, fields: ["body"], conflictCodes: ["WhatsApp.Chat.ManualRequired", "WhatsApp.Chat.SendPending", "WhatsApp.Chat.WindowClosed", "WhatsApp.Chat.RequestConflict"] });
      if (feedback.kind === "uncertain") {
        updateDraft(current => ({ ...current, attempt: current.attempt ? { ...current.attempt, checking: true } : undefined }));
        notify({ id: noticeId, kind: "warning", message: t("send.uncertain"), action: { label: t("send.check"), onClick: () => void checkOutcome() } });
      } else {
        updateDraft(current => ({ ...current, attempt: undefined }));
        setFieldError(feedback.fields.body?.join(" "));
        if (feedback.kind !== "fields" && feedback.kind !== "session") notify({ id: noticeId, kind: "error", message: feedback.kind === "forbidden" ? t("send.forbidden") : feedback.detail ?? t("send.failed") });
        refresh();
      }
    } finally { sendingRef.current = false; setSending(false); }
  }
  async function checkOutcome() {
    const attempt = draftRef.current.attempt;
    // Notification actions retain their render closure; guards must read the current operation state.
    if (!attempt || checkingRef.current || sendingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    try {
      await client.fetchQuery({ queryKey: [...chatKey, actor, "outgoing", contact.id, attempt.requestId], staleTime: 0,
        queryFn: () => findOutgoing(contact.id, attempt.requestId), retry: false, meta: { errorOwner: "local" } });
      accepted(attempt.body);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        updateDraft(current => ({ ...current, attempt: current.attempt ? { ...current.attempt, checking: false, notStored: true } : undefined }));
        notify({ id: noticeId, kind: "info", message: t("send.notStored") });
      } else {
        const feedback = errorFeedback(error);
        if (feedback.kind !== "session") notify({ id: noticeId, kind: "error", message: t("send.checkFailed"), action: { label: t("send.check"), onClick: () => void checkOutcome() } });
      }
    } finally { checkingRef.current = false; setChecking(false); }
  }
  function submit() {
    if (sendingRef.current || draft.attempt?.checking || draftRef.current.form?.attempt) return;
    const body = draft.attempt?.body ?? draft.body.trim();
    if (!body || body.length > 4096) { setFieldError(t("send.validation")); return; }
    const requestId = draft.attempt?.requestId ?? crypto.randomUUID();
    updateDraft(current => ({ ...current, attempt: { requestId, body, checking: false, notStored: false } }));
    setFieldError(undefined);
    sendingRef.current = true;
    setSending(true);
    void send(requestId, body);
  }
  const canAnalyze = !!assistantContext?.available && !replyDisabledReason(contact, canSend, [], now) && contact.linkedAccount?.isActive === true && !!contact.formEligibility?.recipientCulture;
  const canReviewSuggestion = canSend && contact.mode === "Manual" && !!(assistantContext?.available || assistantContext?.pointer);
  const canSendSuggestion = !replyDisabledReason(contact, canSend, outgoing, now) && contact.formEligibility?.status === "Eligible" && !draft.attempt && !draft.form?.attempt;
  const assistant = useAssistantSuggestion(contact.id, contact.modeRevision, assistantContext, canReviewSuggestion, canAnalyze, canSendSuggestion);
  const disabledReason = replyDisabledReason(contact, canSend, outgoing, now) ?? (draft.form?.attempt || assistant.attempt ? "send.pending" : undefined);
  // La espera de un 429 es el motivo de «No, gracias» y «Revisar y enviar», como en el pie del diálogo.
  const suggestionWait = assistant.waiting && !assistant.busy ? t("forms.waitingHint", { count: assistant.waitSeconds }) : null;
  const discarding = assistant.busyAction === "discard";
  // «Usar como borrador» (AS4) writes in the composer: only when it can be written in and is empty, so it never replaces what the
  // operator wrote. Why it is off goes on the button (MA1-A).
  const drafting = assistant.busyAction === "draft";
  const draftReason = suggestionWait ?? (disabledReason ? t(disabledReason) : draft.body.trim() || draft.attempt ? t("assistant.draftInUse") : null);
  const putDraft = (text: string) => {
    updateDraft(current => ({ ...current, body: text, attempt: undefined }));
    setFieldError(undefined);
    reply.current?.focus();
  };
  return (
    <div className="border-t border-[var(--color-border)] p-3">
      {assistant.searching ? <div role="status" className="mb-2 flex items-center gap-2 text-sm text-[var(--color-content-muted)]"><Spinner decorative />{t(assistant.proposal || assistant.textProposal ? "send.checking" : "assistant.searching")}</div> : null}
      {assistant.textProposal ? <section aria-label={t("assistant.textSuggestionLabel")} className="mb-2 flex flex-wrap items-start gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-surface-muted)] p-3">
        <ChatIcon className="size-4 shrink-0" />
        {/* The content keeps a width of its own: where it does not fit next to the buttons, they go down, to the right. */}
        <div className="min-w-0 flex-1 basis-48"><p className="text-sm font-medium">{t("assistant.textSuggestion")}</p>
          {/* The text as it would go out, whole in its box (LR1); the case and what it used, in two columns. */}
          <p className="mt-2 rounded-[var(--radius-control)] border border-[var(--color-border)]/50 bg-[var(--color-surface)] px-2.5 py-1.5 text-sm break-words whitespace-pre-wrap">{assistant.textProposal.text}</p>
          <div className="mt-1"><DataList items={[
            { key: "case", label: t("assistantReply.case"), value: assistant.textProposal.caseSource === "Fallback" ? agent("cases.fallback") : assistant.textProposal.caseTitle?.trim() || "—" },
            ...(assistant.textProposal.used.length ? [{ key: "used", label: t("assistantReply.used"), value: <ul className="flex flex-col gap-1">{assistant.textProposal.used.map((item, index) => <li key={index}>{item}</li>)}</ul> }] : []),
          ]} /></div>
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2"><DisabledReason reason={suggestionWait}><Button variant="outline" size="sm" pending={discarding} disabled={assistant.busy || assistant.waiting} onClick={() => void assistant.discard()}>{t(discarding ? "assistant.discarding" : "assistant.discard")}</Button></DisabledReason>
          <DisabledReason reason={drafting ? null : draftReason}><Button size="sm" pending={drafting} disabled={assistant.busy || Boolean(draftReason)} onClick={() => void assistant.toDraft(putDraft)}>{t(drafting ? "assistant.usingAsDraft" : "assistant.useAsDraft")}</Button></DisabledReason></div>
      </section> : null}
      {assistant.proposal ? <section aria-label={t(assistant.proposal.proposalId === null ? "assistant.configuredSuggestionLabel" : "assistant.suggestionLabel")} className="mb-2 flex flex-wrap items-start gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-surface-muted)] p-3">
        <FormIcon className="size-4 shrink-0" />
        <div className="min-w-0 flex-1 basis-48"><p className="break-words text-sm font-medium">{t(assistant.proposal.proposalId === null ? "assistant.configuredSuggestion" : "assistant.suggestion", { name: assistant.proposal.name })}</p>
          {/* The prefilled data in two columns under their title (rule LR1), not as «Cliente: Ana · Fecha: …» in a sentence. */}
          {assistant.proposal.fields.length ? <div className="mt-2"><p className="text-sm text-[var(--color-content-muted)]">{t("assistant.prefilled")}</p><DataList items={assistant.proposal.fields.map(field => ({ key: field.fieldId, label: field.label, value: field.displayValue }))}/></div> : null}
        </div>
        <div className="ml-auto flex flex-wrap justify-end gap-2"><DisabledReason reason={suggestionWait}><Button variant="outline" size="sm" pending={discarding} disabled={assistant.busy || !!assistant.attempt || assistant.waiting} onClick={() => void assistant.discard()}>{t(discarding ? "assistant.discarding" : "assistant.discard")}</Button></DisabledReason>
          <DisabledReason reason={suggestionWait}><Button size="sm" disabled={assistant.busy || assistant.waiting || !!draft.attempt || !!draft.form?.attempt} onClick={() => assistant.setOpen(true)}>{t("assistant.review")}</Button></DisabledReason></div>
      </section> : null}
      {disabledReason ? <p className="mb-2 text-sm text-[var(--color-content-muted)]">{t(disabledReason)}</p> : null}
      <label htmlFor="chat-reply" className="sr-only">{t("send.label")}</label>
      <Textarea ref={reply} id="chat-reply" value={draft.body} maxLength={4096} rows={3} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "chat-reply-error" : undefined}
        disabled={Boolean(disabledReason) || sending || Boolean(draft.attempt)}
        placeholder={t("send.placeholder")} onChange={event => { updateDraft(current => ({ ...current, body: event.target.value, attempt: undefined })); setFieldError(undefined); }}
        onKeyDown={event => { if (event.ctrlKey && event.key === "Enter" && !disabledReason && !draft.attempt?.checking) { event.preventDefault(); submit(); } }} />
      {fieldError ? <p id="chat-reply-error" role="alert" className="mt-1 text-sm text-[var(--color-danger)]">{fieldError}</p> : null}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
        <FormComposer assistant={assistant} focusFallback={focusFallback} onAvailabilityChange={onFormAvailabilityChange} openRequest={formOpenRequest} contact={contact} actor={actor} canSend={canSend} outgoing={outgoing} draft={draft} updateDraft={updateDraft} timeZone={timeZone} />
        {canSend ? <div className="ml-auto flex flex-wrap justify-end gap-2">
        {draft.attempt?.checking ? <Button variant="outline" size="sm" pending={checking} onClick={() => void checkOutcome()}>{t(checking ? "send.checking" : "send.check")}</Button> :
          <Button size="sm" pending={sending} disabled={Boolean(disabledReason) || !draft.body.trim()} onClick={submit}>{t(sending ? "send.sending" : draft.attempt?.notStored ? "send.retry" : "send.action")}</Button>}
        </div> : null}
      </div>
    </div>
  );
}
