import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { ApiError } from "@/shared/api/ApiError";
import { useChatThread } from "../hooks/useChatThread";
import { useChatThreadActions } from "../hooks/useChatThreadActions";
import { replyDisabledReason } from "../lib/replyAvailability";
import { buildTimeline } from "../lib/timeline";
import { ChatComposer, type ChatDraft } from "./ChatComposer";
import { ChatTimeline } from "./ChatTimeline";

export function ChatThread({ id, actor, readPermissions, timeZone, canSend, canManage, draft, updateDraft, onBack }: {
  id: string; actor: string; readPermissions: readonly string[]; timeZone?: string; canSend: boolean; canManage: boolean; draft: ChatDraft;
  updateDraft: (update: (current: ChatDraft) => ChatDraft) => void; onBack: () => void;
}) {
  const { t, i18n } = useTranslation("whatsapp");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  const [formOpenRequest, setFormOpenRequest] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const { latest, history, messages, read, formValuesRevoked } = useChatThread(id, { actor, culture: i18n.resolvedLanguage ?? "es", permissions: readPermissions }, atBottom);
  const { mode, setMode, review, setReview, changing, reviewing } = useChatThreadActions(id, latest.refetch);
  const items = useMemo(() => buildTimeline(messages, latest.data?.outgoing ?? []), [messages, latest.data?.outgoing]);
  const contact = latest.data?.contact;
  if (!contact) return <div className="p-5 text-sm text-[var(--color-content-muted)]">{t(latest.isError ? "loadFailed" : "loading")} {latest.isError ? <Button variant="outline" size="sm" onClick={() => void latest.refetch()}>{t("retry")}</Button> : null}</div>;
  const forbidden = latest.error instanceof ApiError && latest.error.status === 403;
  const linkedAccount = canSend ? contact.linkedAccount : undefined;
  const mayReadEmail = readPermissions.includes("users.read");
  const visibleEmail = mayReadEmail ? linkedAccount?.email : null;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] p-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="xl:hidden"><Button variant="outline" size="sm" onClick={onBack}>{t("back")}</Button></div>
          <div className="min-w-0"><h2 className="truncate text-base font-semibold">{contact.profileName ?? contact.phoneNumber ?? t("unnamed")}</h2><p className="text-xs text-[var(--color-content-muted)]">{contact.phoneNumber ?? t("send.noPhone")}</p>
            {linkedAccount === null ? <p className="text-xs text-[var(--color-content-muted)]">{t("forms.unlinkedHeader")}</p> : linkedAccount ? <p className="break-words text-xs text-[var(--color-content-muted)]">{t("forms.linkedHeader",{account:visibleEmail??linkedAccount.displayName})}{mayReadEmail&&!linkedAccount.email ? " · "+t("forms.noEmail") : ""}{!linkedAccount.isActive ? " · "+t("forms.inactive") : ""}</p> : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--color-content-muted)]">{t(`mode.${contact.mode}`)}</span>
          {canManage && contact.mode === "Bot" ? <Button variant="outline" size="sm" disabled={changing.isPending || forbidden || latest.isError}
            onClick={() => setMode({ mode: "Manual", revision: contact.modeRevision })}>{t("mode.take")}</Button> : null}
        </div>
      </div>
      {latest.isError ? <div className="flex items-center justify-between gap-2 p-3 text-sm text-[var(--color-content-muted)]"><span>{t(forbidden ? "send.forbidden" : "stale")}</span><Button size="sm" variant="outline" onClick={() => void latest.refetch()}>{t("retry")}</Button></div> : null}
      <ChatTimeline onResendForm={!replyDisabledReason(contact,canSend&&!latest.isError,latest.data?.outgoing??[],now)&&!draft.attempt&&!draft.form?.attempt ? ()=>setFormOpenRequest(value=>value+1) : undefined} items={items} formValuesRevoked={formValuesRevoked} actor={actor} timeZone={timeZone} canSend={canSend && !latest.isError}
        canReuse={!draft.attempt && !draft.form?.attempt && !draft.body} reviewing={reviewing.isPending} onReview={setReview}
        onReuse={body => updateDraft(value => ({ ...value, body, attempt: undefined }))} atBottom={atBottom} onAtBottomChange={setAtBottom}
        hasOlder={Boolean(history.data ? history.hasNextPage : latest.data?.beforeId)} loadingOlder={history.isFetchingNextPage}
        historyError={history.isError} loadOlder={() => history.fetchNextPage()} />
      {!atBottom ? <div className="p-2 text-center"><Button size="sm" variant="outline" onClick={() => setAtBottom(true)}>{t("latest")}</Button></div> : null}
      {read.isError ? <div className="p-2 text-sm text-[var(--color-content-muted)]">{t("readFailed")} <Button size="sm" variant="outline" onClick={() => read.reset()}>{t("retry")}</Button></div> : null}
      <ChatComposer formOpenRequest={formOpenRequest} contact={contact} actor={actor} canSend={canSend && !latest.isError} outgoing={latest.data?.outgoing ?? []} draft={draft} updateDraft={updateDraft} timeZone={timeZone} />
      <ConfirmDialog open={Boolean(mode)} onOpenChange={open => { if (!open) setMode(undefined); }} title={t("mode.take")}
        description={t("mode.manualDescription")} confirmLabel={t("confirm")} onConfirm={() => { if (mode) changing.mutate(mode); }} />
      <ConfirmDialog open={Boolean(review)} onOpenChange={open => { if (!open) setReview(undefined); }} title={t("review.title")} description={t("review.confirmDescription")}
        confirmLabel={t("review.confirm")} onConfirm={() => { if (review) reviewing.mutate(review); }} />
    </div>
  );
}
