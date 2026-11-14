import { Fragment, memo, useId, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDateInZone, formatDateTimeInZone, formatTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { CellText } from "@/shared/ui/CellText";
import { DataList } from "@/shared/ui/DataList";
import { MessageBubble, MessageDateDivider } from "@/shared/ui/MessageBubble";
import { MessageCard } from "@/shared/ui/MessageCard";
import { FormIcon } from "@/shared/ui/icons";
import { MessageHistory } from "@/shared/ui/MessageHistory";
import { ChatAudio } from "./ChatAudio";
import { ChatSpreadsheet } from "./ChatSpreadsheet";
import { ChatReceivedDocument, ChatReceivedDocumentNotRead } from "./ChatReceivedDocument";
import { ChatLocation } from "./ChatLocation";
import { ChatContact } from "./ChatContact";
import { FormReplyCard } from "./FormReplyCard";
import { LocationRequestCard } from "./LocationRequestCard";
import { AssistantEventLine, AssistantReplyWhy } from "./ChatAssistantReply";
import { SpreadsheetRowsWhy } from "./ChatSpreadsheetRows";
import type { Outgoing, PrefilledValue } from "../api/chat";
import { groupTimelineByDay, type TimelineEntry } from "../lib/timeline";
import { accessSummary } from "../lib/messagePresentation";
import { useChatHistoryViewport } from "../hooks/useChatHistoryViewport";

// Memoized: typing a reply redraws the composer, while the history formats a date and a time per message and stays as it
// was (performance review 26, 2026-11-07). Its owner keeps the items and callbacks with the same identity.
export const ChatTimeline = memo(function ChatTimeline({ items, contactId, readOwner, onAudioForbidden, actor, timeZone, canSend, canReuse, reviewing, onReview, onReuse,
  atBottom, onAtBottomChange, hasOlder, loadingOlder, historyError, loadOlder, formValuesRevoked = false, onResendForm, opensReceivedDocuments = false }: {
  contactId: string; readOwner: string; onAudioForbidden: () => void;
  /** The messages and outgoing, with the lines of what the assistant decided without a message (AS4). */
  items: readonly TimelineEntry[]; actor: string; timeZone?: string; canSend: boolean; canReuse: boolean;
  /** The id of the send whose review is being confirmed: that bubble shows the progress, and no other review starts meanwhile. */
  reviewing?: string; onReview: (operation: Outgoing) => void; onReuse: (body: string) => void;
  atBottom: boolean; onAtBottomChange: (recent: boolean) => void;
  hasOlder: boolean; loadingOlder: boolean; historyError: boolean; loadOlder: () => Promise<unknown>; formValuesRevoked?: boolean; onResendForm?: () => void;
  /** VC1-A: whether «Por qué lo propuso» of a spreadsheet links to «Documentos recibidos» (only for whoever can open it). */
  opensReceivedDocuments?: boolean;
}) {
  const { t, i18n } = useTranslation("whatsapp");
  useTranslation("whatsapp", { lng: "en", useSuspense: false });
  useTranslation("whatsapp", { lng: "es", useSuspense: false });
  const language = i18n.resolvedLanguage ?? "es";
  // DOC4: the line under a document that was not read describes its message, by an id of this history.
  const notReadId = useId();
  const groups = useMemo(() => groupTimelineByDay(items, timeZone), [items, timeZone]);
  const { viewport: viewportRef, onScroll, loadOlder: prependHistory, preserveViewport } = useChatHistoryViewport(items, atBottom, onAtBottomChange);
  return <MessageHistory ref={viewportRef} label={t("history")} onScroll={onScroll}>
    {hasOlder ? <div className="mb-4 text-center"><Button variant="outline" size="sm" pending={loadingOlder} onClick={() => void prependHistory(loadOlder)}>{t(loadingOlder ? "loadingOlder" : "older")}</Button></div> : null}
    {historyError ? <p className="mb-3 text-sm text-[var(--color-content-muted)]">{t("loadFailed")}</p> : null}
    {groups.map(group => <div key={group.date}>
      <MessageDateDivider date={group.date} label={formatDateInZone(group.items[0].occurredAtUtc, language, timeZone)} />
      {group.items.map(item => item.source === "event" ? <AssistantEventLine key={item.key} reply={item.reply} /> : <Fragment key={item.key}><MessageBubble direction={item.direction}
        text={item.purpose === "Access" ? accessSummary(t, item.accessEventKind) : item.origin === "FormAction" ? formValuesRevoked ? "" : item.body ?? "" : item.kind === "FlowReply" || item.kind === "Audio" || item.kind === "Spreadsheet" || item.kind === "ReceivedDocument" || item.kind === "Location" && item.location || item.kind === "Contact" && item.contact ? "" : item.body ?? t(item.kind === "Text" || item.kind === "Flow" && item.form ? "textRemoved" : "unsupported", { kind: t(`kind.${item.kind}`, { defaultValue: t("kind.Other") }) })}
        attachment={item.origin === "FormAction" ? <MessageCard icon={<FormIcon className="size-4" />} title={t("formActions.title")} description={t(item.kind === "Document" ? "formActions.document" : "formActions.notice")} /> : item.source === "message" && item.kind === "Audio" && item.audio && item.purpose !== "Access" ? <ChatAudio key={readOwner + ":" + item.messageId} owner={readOwner} contactId={contactId} messageId={item.messageId} audio={item.audio} body={item.body} onForbidden={onAudioForbidden} preserveViewport={preserveViewport}/> : item.source === "message" && item.kind === "Spreadsheet" && item.purpose !== "Access" ? <ChatSpreadsheet name={item.spreadsheetName} caption={item.body} /> : item.source === "message" && item.kind === "ReceivedDocument" && item.purpose !== "Access" ? <ChatReceivedDocument document={item.document} caption={item.body} /> : item.source === "message" && item.kind === "Contact" && item.contact && item.purpose !== "Access" ? <ChatContact contact={item.contact} /> : item.kind === "FlowReply" && item.purpose !== "Access" ? <FormReplyCard actor={actor} timeZone={timeZone} onResend={onResendForm} reply={item.formReply?.state === "Completed" ? { ...item.formReply, valuesRevoked: formValuesRevoked } : item.formReply ?? { state: "Unavailable", name: null }} preserveViewport={preserveViewport} /> : item.kind === "Location" && item.location && item.purpose !== "Access" ? <ChatLocation point={item.location} /> : item.kind === "LocationRequest" && item.form ? <LocationRequestCard form={item.form} /> : item.form ? <MessageCard icon={<FormIcon className="size-4" />} title={item.form.name[item.form.culture]} description={t("forms.cardDescription",{version:item.form.versionNumber,cta:t("forms.openForm",{lng:item.form.culture})})}>{item.prefill && !formValuesRevoked ? <PrefilledWith values={item.prefill} /> : null}</MessageCard> : item.quickReplies ? <ul aria-label={t("assistant.quickRepliesLabel")} className="mt-2 divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]">{item.quickReplies.map((title, index) => <li key={index} className="px-3 py-2 text-center text-sm text-[var(--color-primary)]">{title}</li>)}</ul> : undefined}
        timestamp={item.occurredAtUtc} timeLabel={formatTimeInZone(item.occurredAtUtc, language, timeZone)}
        dateLabel={formatDateTimeInZone(item.occurredAtUtc, language, timeZone)}
        author={item.purpose === "Access" ? t("access.label") : item.author ? t(item.author === "automatic" ? "author.automatic" : item.author === "assistant" ? "author.assistant" : item.operatorUserId === actor ? "author.you" : "author.operator") : undefined}
        delivery={item.delivery ? { state: item.delivery.state, label: /* H2: a reviewed send of the chat says who reviewed it; an older one keeps the general label. */
          item.source === "outgoing" && item.origin === "Conversation" && item.operation.state === "Reviewed" && item.operation.reviewedByUserId
            ? t(item.operation.reviewedByUserId === actor ? "review.byYou" : "review.byOther") : t(`status.${item.delivery.code}`) } : undefined}
        describedBy={item.notReadLine ? notReadId + item.key : undefined}>
        {item.assistant && !formValuesRevoked && item.purpose !== "Access" ? <section className="rounded-[var(--radius-control)] bg-[var(--color-surface-muted)] p-3 text-sm">
          <p className="font-medium">{t(item.origin === "Assistant" ? "assistant.whySent" : "assistant.whySuggested")}</p>
          {/* The body reads from the left, as «Por qué respondió esto» (AS4): the title follows the side of the message. */}
          <div className="text-left">
            <p className="mt-1 break-words">{item.assistant.reason}</p>
            {/* The proposed data in two columns (rule LR1), not «Cliente: Pérez Hnos.» glued in a line. */}
            {item.assistant.proposedFields.length ? <div className="mt-2"><DataList items={item.assistant.proposedFields.map(field => ({ key: field.fieldId, label: field.label, value: field.displayValue }))}/></div> : null}
          </div>
        </section> : null}
        {item.assistantReply && item.purpose !== "Access" ? <AssistantReplyWhy reply={item.assistantReply} /> : null}
        {item.spreadsheetRows && item.purpose !== "Access" ? <SpreadsheetRowsWhy rows={item.spreadsheetRows} linksInbox={opensReceivedDocuments} /> : null}
        {item.origin === "Conversation" && item.source === "outgoing" && item.operation.state === "Uncertain" ? <>
          <p>{t("review.description")}</p>
          {/* H2: any operator who can send reviews it, also another operator's: the chat does not wait for whoever sent it. */}
          {canSend ? <Button variant="outline" size="sm" disabled={Boolean(reviewing)} pending={reviewing === item.operation.id} onClick={() => onReview(item.operation)}>{t(reviewing === item.operation.id ? "review.confirming" : "review.action")}</Button> : null}
        </> : null}
        {item.delivery?.code === "Failed" && item.failureCode ? <FailureReason code={item.failureCode} /> : null}
        {item.origin === "Conversation" && item.delivery?.code === "Failed" && item.kind !== "Flow" && item.kind !== "LocationRequest" && item.body && canSend ?
          <Button variant="muted-link" size="inline" disabled={!canReuse} onClick={() => onReuse(item.body!)}>{t("reuse")}</Button> : null}
      </MessageBubble>
      {/* DOC4: why what a number without a linked account sent was not read, a line of the history under the last of its documents. */}
      {item.notReadLine ? <ChatReceivedDocumentNotRead id={notReadId + item.key} /> : null}</Fragment>)}
    </div>)}
  </MessageHistory>;
});

/** H9: the reason of a failed send by its stable code (`WhatsApp.Send.*`). */
const failureReasons: Readonly<Record<string, string>> = {
  "WhatsApp.Send.NotAllowed": "notAllowed", "WhatsApp.Send.WindowClosed": "windowClosed", "WhatsApp.Send.Undeliverable": "undeliverable",
  "WhatsApp.Send.RateLimited": "rateLimited", "WhatsApp.Send.TokenInvalid": "tokenInvalid", "WhatsApp.Send.PermissionMissing": "permissionMissing",
  "WhatsApp.Send.Unavailable": "unavailable", "WhatsApp.Send.Rejected": "rejected",
};

/** H9: why a send did not go out, so the operator knows which to repeat; another code keeps only «No se pudo enviar». Secondary, in gray. */
function FailureReason({ code }: { code: string }) {
  const { t } = useTranslation("whatsapp");
  const reason = failureReasons[code];
  return reason ? <p className="text-sm text-[var(--color-content-muted)]">{t(`failure.${reason}`)}</p> : null;
}

/** W3 (UC2, UC3): «Prellenado con» of a resend of the form, in its card: each question with what went into it, read like the values
 *  of a response (`FormReplyValues`, LR1): two columns from 640 px and, in the celular, each value under its question; a value keeps its
 *  groups whole (a phone breaks only at its spaces). It goes like «Por qué lo mandó»: only while the values of the responses can be read. */
function PrefilledWith({ values }: { values: readonly PrefilledValue[] }) {
  const { t } = useTranslation("whatsapp");
  const title = useId();
  return <div role="group" aria-labelledby={title} className="border-t border-[var(--color-border)] px-3 pt-2">
    <p id={title} className="text-xs font-semibold text-[var(--color-content-muted)]">{t("assistant.prefilled")}</p>
    <dl className="divide-y divide-[var(--color-border)] text-sm">{values.map((value, index) => <div key={index} className="grid min-w-0 grid-cols-1 gap-1 py-2 sm:grid-cols-2 sm:gap-3">
      <dt className="min-w-0 break-words text-[var(--color-content-muted)]">{value.label}</dt>
      <dd className="min-w-0 break-words"><CellText text={value.value} /></dd>
    </div>)}</dl>
  </div>;
}
