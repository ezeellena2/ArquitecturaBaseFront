import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDateInZone, formatDateTimeInZone, formatTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { MessageBubble, MessageDateDivider } from "@/shared/ui/MessageBubble";
import { MessageHistory } from "@/shared/ui/MessageHistory";
import type { Outgoing } from "../api/chat";
import { groupTimelineByDay, type TimelineItem } from "../lib/timeline";
import { accessSummary } from "../lib/messagePresentation";
import { useChatHistoryViewport } from "../hooks/useChatHistoryViewport";

export function ChatTimeline({ items, actor, timeZone, canSend, canReuse, reviewing, onReview, onReuse,
  atBottom, onAtBottomChange, hasOlder, loadingOlder, historyError, loadOlder }: {
  items: readonly TimelineItem[]; actor: string; timeZone?: string; canSend: boolean; canReuse: boolean;
  reviewing: boolean; onReview: (operation: Outgoing) => void; onReuse: (body: string) => void;
  atBottom: boolean; onAtBottomChange: (recent: boolean) => void;
  hasOlder: boolean; loadingOlder: boolean; historyError: boolean; loadOlder: () => Promise<unknown>;
}) {
  const { t, i18n } = useTranslation("whatsapp");
  const language = i18n.resolvedLanguage ?? "es";
  const groups = useMemo(() => groupTimelineByDay(items, timeZone), [items, timeZone]);
  const { viewport: viewportRef, onScroll, loadOlder: prependHistory } = useChatHistoryViewport(items, atBottom, onAtBottomChange);
  return <MessageHistory ref={viewportRef} label={t("history")} onScroll={onScroll}>
    {hasOlder ? <div className="mb-4 text-center"><Button variant="outline" size="sm" disabled={loadingOlder} onClick={() => void prependHistory(loadOlder)}>{t("older")}</Button></div> : null}
    {historyError ? <p className="mb-3 text-sm text-[var(--color-content-muted)]">{t("loadFailed")}</p> : null}
    {groups.map(group => <div key={group.date}>
      <MessageDateDivider date={group.date} label={formatDateInZone(group.items[0].occurredAtUtc, language, timeZone)} />
      {group.items.map(item => <MessageBubble key={item.key} direction={item.direction}
        text={item.purpose === "Access" ? accessSummary(t, item.accessEventKind) : item.body ?? t(item.kind === "Text" ? "textRemoved" : "unsupported", { kind: t(`kind.${item.kind}`, { defaultValue: t("kind.Other") }) })}
        timestamp={item.occurredAtUtc} timeLabel={formatTimeInZone(item.occurredAtUtc, language, timeZone)}
        dateLabel={formatDateTimeInZone(item.occurredAtUtc, language, timeZone)}
        author={item.purpose === "Access" ? t("access.label") : item.author ? t(item.author === "bot" ? "author.bot" : item.operatorUserId === actor ? "author.you" : "author.operator") : undefined}
        delivery={item.delivery ? { state: item.delivery.state, label: t(`status.${item.delivery.code}`) } : undefined}>
        {item.source === "outgoing" && item.operation.state === "Uncertain" ? <>
          <p>{t("review.description")}</p>
          {canSend && item.operation.operatorUserId === actor ? <Button variant="outline" size="sm" disabled={reviewing} onClick={() => onReview(item.operation)}>{t("review.action")}</Button> : null}
        </> : null}
        {item.delivery?.code === "Failed" && item.body && canSend ?
          <Button variant="muted-link" size="inline" disabled={!canReuse} onClick={() => onReuse(item.body!)}>{t("reuse")}</Button> : null}
      </MessageBubble>)}
    </div>)}
  </MessageHistory>;
}
