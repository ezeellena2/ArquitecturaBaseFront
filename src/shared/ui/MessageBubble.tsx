import { Children, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircleIcon, CheckCheckIcon, CheckIcon, ClockIcon, InfoIcon } from "./icons";

export type MessageDeliveryState = "pending" | "sent" | "delivered" | "read" | "failed" | "uncertain" | "reviewed" | "unknown";

const deliveryIcons = {
  pending: ClockIcon, sent: CheckIcon, delivered: CheckCheckIcon, read: CheckCheckIcon,
  failed: AlertCircleIcon, uncertain: AlertCircleIcon, reviewed: InfoIcon, unknown: InfoIcon,
} satisfies Record<MessageDeliveryState, typeof ClockIcon>;

// Presentation only: the caller supplies localized content and the delivery stage it can confirm.
export function MessageBubble({ direction, text, timestamp, timeLabel, dateLabel, author, delivery, children }: {
  direction: "incoming" | "outgoing";
  text: string;
  timestamp: string;
  timeLabel: string;
  dateLabel: string;
  author?: string;
  delivery?: { state: MessageDeliveryState; label: string };
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const Icon = delivery ? deliveryIcons[delivery.state] : undefined;
  const details = Children.toArray(children);
  return <article className="message-item" data-direction={direction} aria-label={t(`messages.${direction}`)}>
    <div className="message-bubble"><p>{text}</p></div>
    <div className="message-metadata">
      {author ? <span>{author} ·</span> : null}
      <time dateTime={timestamp} aria-label={dateLabel}>{timeLabel}</time>
      {delivery && Icon ? <span className="message-delivery" data-state={delivery.state}><Icon className="size-3.5" /><span>{delivery.label}</span></span> : null}
    </div>
    {details.length ? <div className="message-details" data-state={delivery?.state}>{details}</div> : null}
  </article>;
}

export function MessageDateDivider({ date, label }: { date: string; label: string }) {
  return <div className="message-date"><time dateTime={date}>{label}</time></div>;
}
