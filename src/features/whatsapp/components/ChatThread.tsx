import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Banner } from "@/shared/ui/Banner";
import { Badge } from "@/shared/ui/badge";
import { ApiError } from "@/shared/api/ApiError";
import { useChatAudioTranscription } from "../hooks/useChatAudioTranscription";
import { useChatThread } from "../hooks/useChatThread";
import { useChatThreadActions } from "../hooks/useChatThreadActions";
import { buildTimeline } from "../lib/timeline";
import { ChatComposer, type ChatDraft } from "./ChatComposer";
import { ChatTimeline } from "./ChatTimeline";

export function ChatThread({ id, actor, readPermissions, timeZone, canSend, canConfigureAssistant, draft, updateDraft, onBack }: {
  id: string; actor: string; readPermissions: readonly string[]; timeZone?: string; canSend: boolean; canConfigureAssistant: boolean; draft: ChatDraft;
  updateDraft: (update: (current: ChatDraft) => ChatDraft) => void; onBack: () => void;
}) {
  const { t, i18n } = useTranslation("whatsapp");
  const heading = useRef<HTMLHeadingElement>(null);
  const modeTrigger = useRef<HTMLButtonElement | null>(null);
  const [canOpenForm, setCanOpenForm] = useState(false);
  const [formOpenRequest, setFormOpenRequest] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const { latest, history, messages, read, formValuesRevoked, denyRead } = useChatThread(id, { actor, culture: i18n.resolvedLanguage ?? "es", permissions: readPermissions }, atBottom);
  const readOwner = JSON.stringify([actor, id, i18n.resolvedLanguage, [...new Set(readPermissions)].sort()]);
  useChatAudioTranscription({ owner: readOwner, contactId: id, enabled: readPermissions.includes("whatsapp.read") && latest.data?.contact.mode === "Manual", messages, onForbidden: denyRead });
  const { mode, setMode, review, setReview, changing, reviewing } = useChatThreadActions(id, latest.refetch);
  const items = useMemo(() => buildTimeline(messages, latest.data?.outgoing ?? []), [messages, latest.data?.outgoing]);
  const contact = latest.data?.contact;
  const availability = latest.data?.assistantAvailability.state;
  const canEnableAssistant = canConfigureAssistant && availability === "available" && !latest.isError;
  if (mode && !(mode.mode === "Manual" ? canSend : canEnableAssistant)) setMode(undefined);
  useEffect(() => {
    if (modeTrigger.current && !modeTrigger.current.isConnected && document.activeElement === document.body) heading.current?.focus();
  }, [contact?.mode]);
  const readForbidden = latest.error instanceof ApiError && latest.error.status === 403;
  if (!contact) return <div className="p-5 text-sm text-[var(--color-content-muted)]">{t(readForbidden ? "readForbidden" : latest.isError ? "loadFailed" : "loading")} {latest.isError && !readForbidden ? <Button variant="outline" size="sm" onClick={() => void latest.refetch()}>{t("retry")}</Button> : null}</div>;
  const forbidden = latest.error instanceof ApiError && latest.error.status === 403;
  const linkedAccount = canSend ? contact.linkedAccount : undefined;
  const latestSource = [...messages].filter(message => message.direction === "Inbound" && ["Text", "Audio", "FlowReply"].includes(message.kind) && message.purpose !== "Access").sort((a, b) => b.inboundSequence - a.inboundSequence)[0];
  const source = latestSource?.kind === "Text" || latestSource?.kind === "Audio" && latestSource.audio?.state === "Completed" && latestSource.body || latestSource?.kind === "FlowReply" && latestSource.formReply?.state === "Completed" ? latestSource : undefined;
  const pointer = latest.data?.assistantSuggestion ?? null;
  const sourceMessageId = pointer?.sourceMessageId ?? source?.id;
  const assistantOwner = JSON.stringify([actor, id, i18n.resolvedLanguage, [...new Set(readPermissions)].sort(), contact.modeRevision, sourceMessageId, contact.formEligibility?.recipientContextRevision]);
  const assistantContext = sourceMessageId ? { owner: assistantOwner, sourceMessageId, pointer: pointer?.sourceMessageId === sourceMessageId ? pointer : null, available: availability === "available" } : undefined;
  const mayReadEmail = readPermissions.includes("users.read");
  const visibleEmail = mayReadEmail ? linkedAccount?.email : null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="xl:hidden"><Button variant="outline" size="sm" onClick={onBack}>{t("back")}</Button></div>
          <div className="min-w-0"><h2 ref={heading} tabIndex={-1} className="truncate text-base font-semibold">{contact.profileName ?? contact.phoneNumber ?? t("unnamed")}</h2><p className="text-xs text-[var(--color-content-muted)]">{contact.phoneNumber ?? t("send.noPhone")}</p>
            {linkedAccount === null ? <p className="text-xs text-[var(--color-content-muted)]">{t("forms.unlinkedHeader")}</p> : linkedAccount ? <p className="break-words text-xs text-[var(--color-content-muted)]">{t("forms.linkedHeader",{account:visibleEmail??linkedAccount.displayName})}{mayReadEmail&&!linkedAccount.email ? " · "+t("forms.noEmail") : ""}{!linkedAccount.isActive ? " · "+t("forms.inactive") : ""}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{t(`mode.${contact.mode}`)}</Badge>
          {contact.mode === "Manual" && canEnableAssistant ? <Button variant="outline" size="sm" disabled={changing.isPending || forbidden} onClick={event => { modeTrigger.current = event.currentTarget; setMode({ mode: "Assistant", revision: contact.modeRevision }); }}>{t("mode.enable")}</Button> : null}
        </div>
      </header>
      {canConfigureAssistant && availability && availability !== "available" && availability !== "notInstalled" ? <div className="border-b border-[var(--color-border)] p-3"><Banner tone="warning"><span>{t(`mode.availability.${availability}`)}</span>{contact.mode === "Manual" ? <><br/><span>{t("mode.manualContinues")}</span></> : null}</Banner></div> : null}
      {latest.isError ? <div className="flex items-center justify-between gap-2 p-3 text-sm text-[var(--color-content-muted)]"><span>{t(forbidden ? "send.forbidden" : "stale")}</span><Button size="sm" variant="outline" onClick={() => void latest.refetch()}>{t("retry")}</Button></div> : null}
      <ChatTimeline contactId={id} readOwner={readOwner} onAudioForbidden={denyRead} onResendForm={canOpenForm&&canSend&&!latest.isError ? ()=>setFormOpenRequest(value=>value+1) : undefined} items={items} formValuesRevoked={formValuesRevoked} actor={actor} timeZone={timeZone} canSend={canSend && !latest.isError}
        canReuse={!draft.attempt && !draft.form?.attempt && !draft.body} reviewing={reviewing.isPending} onReview={setReview}
        onReuse={body => updateDraft(value => ({ ...value, body, attempt: undefined }))} atBottom={atBottom} onAtBottomChange={setAtBottom}
        hasOlder={Boolean(history.data ? history.hasNextPage : latest.data?.beforeId)} loadingOlder={history.isFetchingNextPage}
        historyError={history.isError} loadOlder={() => history.fetchNextPage()} />
      {!atBottom ? <div className="p-2 text-center"><Button size="sm" variant="outline" onClick={() => setAtBottom(true)}>{t("latest")}</Button></div> : null}
      {read.isError ? <div className="p-2 text-sm text-[var(--color-content-muted)]">{t("readFailed")} <Button size="sm" variant="outline" onClick={() => read.reset()}>{t("retry")}</Button></div> : null}
      {contact.mode === "Assistant" ? <section aria-label={t("mode.Assistant")} className="border-t border-[var(--color-border)] p-3"><Banner action={canSend ? <Button disabled={changing.isPending || forbidden} onClick={event => { modeTrigger.current = event.currentTarget; setMode({ mode: "Manual", revision: contact.modeRevision }); }}>{t("mode.take")}</Button> : undefined}>{t("mode.assistantControlDescription")}</Banner>{!canSend ? <p className="mt-2 text-sm text-[var(--color-content-muted)]">{t("send.readOnly")}</p> : null}</section> : null}
      <div hidden={contact.mode === "Assistant"}><ChatComposer assistantContext={assistantContext} focusFallback={heading} onFormAvailabilityChange={setCanOpenForm} formOpenRequest={formOpenRequest} contact={contact} actor={actor} canSend={canSend && !latest.isError} outgoing={latest.data?.outgoing ?? []} draft={draft} updateDraft={updateDraft} timeZone={timeZone} /></div>
      <ConfirmDialog focusFallback={heading} open={Boolean(mode)} onOpenChange={open => { if (!open) setMode(undefined); }} title={t(mode?.mode === "Assistant" ? "mode.enable" : "mode.take")}
        description={t(mode?.mode === "Assistant" ? "mode.assistantDescription" : "mode.manualDescription", { name: contact.profileName ?? contact.phoneNumber ?? t("unnamed") })} confirmLabel={t(mode?.mode === "Assistant" ? "mode.enableConfirm" : "mode.take")} onConfirm={() => { if (mode && !forbidden && (mode.mode === "Manual" ? canSend : canEnableAssistant)) changing.mutate(mode); }} />
      <ConfirmDialog open={Boolean(review)} onOpenChange={open => { if (!open) setReview(undefined); }} title={t("review.title")} description={t("review.confirmDescription")}
        confirmLabel={t("review.confirm")} onConfirm={() => { if (review) reviewing.mutate(review); }} />
    </div>
  );
}
