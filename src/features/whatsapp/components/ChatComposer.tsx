import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { FormIcon } from "@/shared/ui/icons";
import { useAssistantSuggestion, type AssistantComposerContext } from "../hooks/useAssistantSuggestion";
import { Button } from "@/shared/ui/button";
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
  const client = useQueryClient();
  const [fieldError, setFieldError] = useState<string>();
  const [checking, setChecking] = useState(false);
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
  const sending = useMutation({ retry: false,
    onSettled: () => { sendingRef.current = false; },
    mutationFn: ({ requestId, body }: { requestId: string; body: string }) => sendText(contact.id, requestId, body),
    onSuccess: (_, variables) => accepted(variables.body),
    onError: error => {
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
    },
  });
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
    sending.mutate({ requestId, body });
  }
  const canAnalyze = !replyDisabledReason(contact, canSend, [], now) && contact.linkedAccount?.isActive === true && !!contact.formEligibility?.recipientCulture;
  const canReviewSuggestion = canSend && contact.mode === "Manual" && !!assistantContext?.available;
  const canSendSuggestion = !replyDisabledReason(contact, canSend, outgoing, now) && contact.formEligibility?.status === "Eligible" && !draft.attempt && !draft.form?.attempt;
  const assistant = useAssistantSuggestion(contact.id, contact.modeRevision, assistantContext, canReviewSuggestion, canAnalyze, canSendSuggestion);
  const disabledReason = replyDisabledReason(contact, canSend, outgoing, now) ?? (draft.form?.attempt || assistant.attempt ? "send.pending" : undefined);
  return (
    <div className="border-t border-[var(--color-border)] p-3">
      {assistant.proposal ? <section aria-label={t("assistant.suggestionLabel")} className="mb-2 flex flex-wrap items-start gap-2 rounded-[var(--radius-control)] border border-[var(--color-primary)] bg-[var(--color-surface-muted)] p-3">
        <FormIcon className="size-4 shrink-0" />
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{t("assistant.suggestion", { name: assistant.proposal.name })}</p>
          {assistant.proposal.fields.length ? <p className="mt-1 break-words text-sm text-[var(--color-content-muted)]">{t("assistant.prefilledSummary", { fields: assistant.proposal.fields.map(field => field.label + ": " + field.displayValue).join(" · ") })}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={assistant.busy || !!assistant.attempt || assistant.waiting} onClick={() => void assistant.discard()}>{t("assistant.discard")}</Button>
          <Button size="sm" disabled={assistant.busy || assistant.waiting || !!draft.attempt || !!draft.form?.attempt} onClick={() => assistant.setOpen(true)}>{t("assistant.review")}</Button></div>
      </section> : null}
      {disabledReason ? <p className="mb-2 text-sm text-[var(--color-content-muted)]">{t(disabledReason)}</p> : null}
      <label htmlFor="chat-reply" className="sr-only">{t("send.label")}</label>
      <Textarea id="chat-reply" value={draft.body} maxLength={4096} rows={3} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? "chat-reply-error" : undefined}
        disabled={Boolean(disabledReason) || sending.isPending || Boolean(draft.attempt)}
        placeholder={t("send.placeholder")} onChange={event => { updateDraft(current => ({ ...current, body: event.target.value, attempt: undefined })); setFieldError(undefined); }}
        onKeyDown={event => { if (event.ctrlKey && event.key === "Enter" && !disabledReason && !draft.attempt?.checking) { event.preventDefault(); submit(); } }} />
      {fieldError ? <p id="chat-reply-error" role="alert" className="mt-1 text-sm text-[var(--color-danger)]">{fieldError}</p> : null}
      <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
        <FormComposer assistant={assistant} focusFallback={focusFallback} onAvailabilityChange={onFormAvailabilityChange} openRequest={formOpenRequest} contact={contact} actor={actor} canSend={canSend} outgoing={outgoing} draft={draft} updateDraft={updateDraft} timeZone={timeZone} />
        {canSend ? <div className="ml-auto flex flex-wrap justify-end gap-2">
        {draft.attempt?.checking ? <Button variant="outline" size="sm" disabled={checking} onClick={() => void checkOutcome()}>{t("send.check")}</Button> :
          <Button size="sm" disabled={Boolean(disabledReason) || sending.isPending || !draft.body.trim()} onClick={submit}>{t(sending.isPending ? "send.sending" : draft.attempt?.notStored ? "send.retry" : "send.action")}</Button>}
        </div> : null}
      </div>
    </div>
  );
}
