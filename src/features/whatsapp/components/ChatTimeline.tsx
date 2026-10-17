import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDateInZone, formatDateTimeInZone, formatTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { MessageBubble, MessageDateDivider } from "@/shared/ui/MessageBubble";
import { MessageCard } from "@/shared/ui/MessageCard";
import { FormIcon } from "@/shared/ui/icons";
import { MessageHistory } from "@/shared/ui/MessageHistory";
import { ChatAudio } from "./ChatAudio";
import { FormReplyCard } from "./FormReplyCard";
import type { Outgoing } from "../api/chat";
import { groupTimelineByDay, type TimelineItem } from "../lib/timeline";
import { accessSummary } from "../lib/messagePresentation";
import { useChatHistoryViewport } from "../hooks/useChatHistoryViewport";

export function ChatTimeline({ items, contactId, readOwner, onAudioForbidden, actor, timeZone, canSend, canReuse, reviewing, onReview, onReuse,
  atBottom, onAtBottomChange, hasOlder, loadingOlder, historyError, loadOlder, formValuesRevoked = false, onResendForm }: {
  contactId: string; readOwner: string; onAudioForbidden: () => void;
  items: readonly TimelineItem[]; actor: string; timeZone?: string; canSend: boolean; canReuse: boolean;
  reviewing: boolean; onReview: (operation: Outgoing) => void; onReuse: (body: string) => void;
  atBottom: boolean; onAtBottomChange: (recent: boolean) => void;
  hasOlder: boolean; loadingOlder: boolean; historyError: boolean; loadOlder: () => Promise<unknown>; formValuesRevoked?: boolean; onResendForm?: () => void;
}) {
  const { t, i18n } = useTranslation("whatsapp");
  useTranslation("whatsapp", { lng: "en", useSuspense: false });
  useTranslation("whatsapp", { lng: "es", useSuspense: false });
  const language = i18n.resolvedLanguage ?? "es";
  const groups = useMemo(() => groupTimelineByDay(items, timeZone), [items, timeZone]);
  const { viewport: viewportRef, onScroll, loadOlder: prependHistory, preserveViewport } = useChatHistoryViewport(items, atBottom, onAtBottomChange);
  return <MessageHistory ref={viewportRef} label={t("history")} onScroll={onScroll}>
    {hasOlder ? <div className="mb-4 text-center"><Button variant="outline" size="sm" disabled={loadingOlder} onClick={() => void prependHistory(loadOlder)}>{t("older")}</Button></div> : null}
    {historyError ? <p className="mb-3 text-sm text-[var(--color-content-muted)]">{t("loadFailed")}</p> : null}
    {groups.map(group => <div key={group.date}>
      <MessageDateDivider date={group.date} label={formatDateInZone(group.items[0].occurredAtUtc, language, timeZone)} />
      {group.items.map(item => <MessageBubble key={item.key} direction={item.direction}
        text={item.purpose === "Access" ? accessSummary(t, item.accessEventKind) : item.origin === "FormAction" ? formValuesRevoked ? "" : item.body ?? "" : item.kind === "FlowReply" || item.kind === "Audio" ? "" : item.body ?? t(item.kind === "Text" || item.kind === "Flow" && item.form ? "textRemoved" : "unsupported", { kind: t(`kind.${item.kind}`, { defaultValue: t("kind.Other") }) })}
        attachment={item.origin === "FormAction" ? <MessageCard icon={<FormIcon className="size-4" />} title={t("formActions.title")} description={t(item.kind === "Document" ? "formActions.document" : "formActions.notice")} /> : item.source === "message" && item.kind === "Audio" && item.audio && item.purpose !== "Access" ? <ChatAudio key={readOwner + ":" + item.messageId} owner={readOwner} contactId={contactId} messageId={item.messageId} audio={item.audio} body={item.body} onForbidden={onAudioForbidden} preserveViewport={preserveViewport}/> : item.kind === "FlowReply" && item.purpose !== "Access" ? <FormReplyCard actor={actor} timeZone={timeZone} onResend={onResendForm} reply={item.formReply?.state === "Completed" ? { ...item.formReply, valuesRevoked: formValuesRevoked } : item.formReply ?? { state: "Unavailable", name: null }} preserveViewport={preserveViewport} /> : item.form ? <MessageCard icon={<FormIcon className="size-4" />} title={item.form.name[item.form.culture]} description={t("forms.cardDescription",{version:item.form.versionNumber,cta:t("forms.openForm",{lng:item.form.culture})})} /> : item.quickReplies ? <ul aria-label={t("assistant.quickRepliesLabel")} className="mt-2 divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]">{item.quickReplies.map((title, index) => <li key={index} className="px-3 py-2 text-center text-sm text-[var(--color-primary)]">{title}</li>)}</ul> : undefined}
        timestamp={item.occurredAtUtc} timeLabel={formatTimeInZone(item.occurredAtUtc, language, timeZone)}
        dateLabel={formatDateTimeInZone(item.occurredAtUtc, language, timeZone)}
        author={item.purpose === "Access" ? t("access.label") : item.author ? t(item.author === "automatic" ? "author.automatic" : item.author === "assistant" ? "author.assistant" : item.operatorUserId === actor ? "author.you" : "author.operator") : undefined}
        delivery={item.delivery ? { state: item.delivery.state, label: t(`status.${item.delivery.code}`) } : undefined}>
        {item.assistant && !formValuesRevoked && item.purpose !== "Access" ? <section className="rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-3 text-sm">
          <p className="font-medium">{t(item.origin === "Assistant" ? "assistant.whySent" : "assistant.whySuggested")}</p>
          <p className="mt-1 break-words">{item.assistant.reason}</p>
          {item.assistant.proposedFields.length ? <dl className="mt-2 space-y-1">{item.assistant.proposedFields.map(field => <div key={field.fieldId} className="flex flex-wrap gap-x-1"><dt className="font-medium">{field.label}:</dt><dd className="break-words">{field.displayValue}</dd></div>)}</dl> : null}
        </section> : null}
        {item.origin === "Conversation" && item.source === "outgoing" && item.operation.state === "Uncertain" ? <>
          <p>{t("review.description")}</p>
          {canSend && item.operation.operatorUserId === actor ? <Button variant="outline" size="sm" disabled={reviewing} onClick={() => onReview(item.operation)}>{t("review.action")}</Button> : null}
        </> : null}
        {item.origin === "Conversation" && item.delivery?.code === "Failed" && item.kind !== "Flow" && item.body && canSend ?
          <Button variant="muted-link" size="inline" disabled={!canReuse} onClick={() => onReuse(item.body!)}>{t("reuse")}</Button> : null}
        {item.delivery?.code === "Failed" && item.kind === "Flow" ? <p>{t("forms.failed")}</p> : null}
      </MessageBubble>)}
    </div>)}
  </MessageHistory>;
}
