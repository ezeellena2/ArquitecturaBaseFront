import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDateInZone, formatDateTimeInZone, formatTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { MessageBubble, MessageDateDivider } from "@/shared/ui/MessageBubble";
import { MessageCard } from "@/shared/ui/MessageCard";
import { FormIcon } from "@/shared/ui/icons";
import { MessageHistory } from "@/shared/ui/MessageHistory";
import { FormReplyCard } from "./FormReplyCard";
import type { Outgoing } from "../api/chat";
import { groupTimelineByDay, type TimelineItem } from "../lib/timeline";
import { accessSummary } from "../lib/messagePresentation";
import { useChatHistoryViewport } from "../hooks/useChatHistoryViewport";

export function ChatTimeline({ items, actor, timeZone, canSend, canReuse, reviewing, onReview, onReuse,
  atBottom, onAtBottomChange, hasOlder, loadingOlder, historyError, loadOlder, formValuesRevoked = false, onResendForm }: {
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
        text={item.purpose === "Access" ? accessSummary(t, item.accessEventKind) : item.kind === "FlowReply" ? "" : item.body ?? t(item.kind === "Text" || item.kind === "Flow" && item.form ? "textRemoved" : "unsupported", { kind: t(`kind.${item.kind}`, { defaultValue: t("kind.Other") }) })}
        attachment={item.kind === "FlowReply" && item.purpose !== "Access" ? <FormReplyCard actor={actor} timeZone={timeZone} onResend={onResendForm} reply={item.formReply?.state === "Completed" ? { ...item.formReply, valuesRevoked: formValuesRevoked } : item.formReply ?? { state: "Unavailable", name: null }} preserveViewport={preserveViewport} /> : item.form ? <MessageCard icon={<FormIcon className="size-4" />} title={item.form.name[item.form.culture]} description={t("forms.cardDescription",{version:item.form.versionNumber,cta:t("forms.openForm",{lng:item.form.culture})})} /> : undefined}
        timestamp={item.occurredAtUtc} timeLabel={formatTimeInZone(item.occurredAtUtc, language, timeZone)}
        dateLabel={formatDateTimeInZone(item.occurredAtUtc, language, timeZone)}
        author={item.purpose === "Access" ? t("access.label") : item.author ? t(item.author === "bot" ? "author.bot" : item.operatorUserId === actor ? "author.you" : "author.operator") : undefined}
        delivery={item.delivery ? { state: item.delivery.state, label: t(`status.${item.delivery.code}`) } : undefined}>
        {item.source === "outgoing" && item.operation.state === "Uncertain" ? <>
          <p>{t("review.description")}</p>
          {canSend && item.operation.operatorUserId === actor ? <Button variant="outline" size="sm" disabled={reviewing} onClick={() => onReview(item.operation)}>{t("review.action")}</Button> : null}
        </> : null}
        {item.delivery?.code === "Failed" && item.kind !== "Flow" && item.body && canSend ?
          <Button variant="muted-link" size="inline" disabled={!canReuse} onClick={() => onReuse(item.body!)}>{t("reuse")}</Button> : null}
        {item.delivery?.code === "Failed" && item.kind === "Flow" ? <p>{t("forms.failed")}</p> : null}
      </MessageBubble>)}
    </div>)}
  </MessageHistory>;
}
