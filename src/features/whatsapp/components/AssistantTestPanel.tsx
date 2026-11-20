import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/auth/usePermissions";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { useSettledValue } from "@/shared/hooks/useSettledValue";
import { formatDateTimeInZone, formatTimeInZone } from "@/shared/lib/dateTime";
import { Badge } from "@/shared/ui/badge";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { Dialog, DialogContent, DialogTitle } from "@/shared/ui/dialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { FormIcon, UserIcon } from "@/shared/ui/icons";
import { InfoTip } from "@/shared/ui/InfoTip";
import { MessageBubble } from "@/shared/ui/MessageBubble";
import { MessageCard } from "@/shared/ui/MessageCard";
import { MessageHistory } from "@/shared/ui/MessageHistory";
import { Picker } from "@/shared/ui/Picker";
import { Spinner } from "@/shared/ui/Spinner";
import { StepList } from "@/shared/ui/StepList";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import { assistantAgentKey, fetchAssistantTestRecipients, type AgentTestAction, type AgentTestRecipient } from "../api/assistantAgent";
import { useAssistantAgentTests, type AgentTestRun } from "../hooks/useAssistantAgentTests";
import { handoffReasonText, testMessages, testMessagesIssue } from "../lib/assistantAgentDraft";
import { AssistantActionTag } from "./AssistantActionTag";

/** What the panel keeps while the page is open: the account and the messages, so testing again after saving does not start over. */
export interface AgentTestDraft { recipient: AgentTestRecipient | null; messages: string }
const recipientOption = (recipient: AgentTestRecipient) => ({ id: recipient.contactId, label: recipient.name, description: recipient.email });

/**
 * Probar (AS3): a panel at the side that does not leave the tab. It tests as if a linked account wrote, with what is saved, and
 * shows what the assistant would do, in order and why, and how the person would see it. The results pile up, the last one on
 * top, and are forgotten when it closes. Nothing is sent.
 */
export function AssistantTestPanel({ actor, timeZone, unsaved, unavailable, draft, onDraftChange, onClose, onForbidden }: {
  actor: string; timeZone: string; unsaved: boolean; unavailable: string | null; draft: AgentTestDraft; onDraftChange: (draft: AgentTestDraft) => void;
  onClose: () => void; onForbidden: () => void;
}) {
  const { t } = useTranslation("whatsappAssistant");
  const restore = useRestoreFocusOnClose();
  const tests = useAssistantAgentTests(onForbidden);
  const [search, setSearch] = useState("");
  const settled = useSettledValue(search.trim());
  const recipients = useQuery({ queryKey: [...assistantAgentKey, actor, "test-recipients", settled], queryFn: ({ signal }) => fetchAssistantTestRecipients(settled, signal),
    placeholderData: keepPreviousData, retry: false, refetchOnWindowFocus: false, meta: { errorOwner: "local" } });
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<{ recipient?: string; messages?: string }>({});
  const issue = testMessagesIssue(testMessages(draft.messages));
  const recipientError = (attempted && !draft.recipient ? t("test.recipientRequired") : undefined) ?? serverErrors.recipient;
  const messagesError = (attempted && issue ? t(issue.key, issue.values) : undefined) ?? serverErrors.messages;
  // The accounts are searched in the server, with what is typed in the search of the list after its wait; while another search reads,
  // the list says so instead of the accounts of the search before, and a failure offers «Reintentar» inside it.
  const failed = recipients.isError && !recipients.isFetching;
  const waiting = !failed && (search.trim() !== settled || !recipients.data || recipients.isPlaceholderData || recipients.isError);
  const reason = unavailable ?? (tests.waitSeconds > 0 ? t("test.wait", { count: tests.waitSeconds }) : null);
  const run = async () => {
    setServerErrors({});
    if (!draft.recipient || issue) {
      setAttempted(true);
      document.getElementById(!draft.recipient ? "agent-test-recipient" : "agent-test-messages")?.focus();
      return;
    }
    const result = await tests.start(draft.recipient.contactId, draft.recipient.name, testMessages(draft.messages));
    if (!result.ok) setServerErrors({ recipient: result.recipient, messages: result.messages });
  };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent placement="right" aria-describedby={undefined} onCloseAutoFocus={restore} className="gap-0 overflow-hidden p-0 sm:max-w-xl">
      <div className="flex min-h-14 shrink-0 items-center gap-1 border-b border-[var(--color-border)] py-2 pr-12 pl-4">
        <DialogTitle>{t("test.title")}</DialogTitle>
        <span className="-my-1 inline-flex"><InfoTip text={t("test.help")} label={t("common:actions.moreInfo", { label: t("test.title") })} /></span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4"><div className="flex flex-col gap-4">
        {unsaved ? <Banner tone="warning">{t("test.unsaved")}</Banner> : null}
        <FormField label={t("test.recipient")} help={t("test.recipientHelp")} required error={recipientError}>
          <Picker id="agent-test-recipient" label={t("test.recipient")} value={draft.recipient?.contactId ?? null} placeholder={t("test.recipientPlaceholder")}
            options={waiting || failed ? [] : (recipients.data ?? []).map(recipientOption)} selectedOptions={draft.recipient ? [recipientOption(draft.recipient)] : undefined}
            search={search} onSearchChange={setSearch} loading={waiting} failed={failed} onRetry={() => void recipients.refetch()}
            onChange={id => { const recipient = recipients.data?.find(item => item.contactId === id); if (recipient) { onDraftChange({ ...draft, recipient }); setServerErrors(previous => ({ ...previous, recipient: undefined })); } }} />
        </FormField>
        <FormField label={t("test.messages")} help={t("test.messagesHelp")} required error={messagesError}
          beside={<DisabledReason reason={reason}><Button type="button" disabled={!!reason} pending={tests.busy} onClick={() => void run()}>{t(tests.busy ? "test.running" : "test.run")}</Button></DisabledReason>}>
          <Textarea id="agent-test-messages" rows={3} className="min-w-0 flex-1" placeholder={t("test.messagesPlaceholder")} value={draft.messages}
            onChange={event => { onDraftChange({ ...draft, messages: event.target.value }); setServerErrors(previous => ({ ...previous, messages: undefined })); }} />
        </FormField>
        {tests.runs.map(item => <TestResult key={item.requestId} run={item} timeZone={timeZone} onCheck={() => tests.check(item.requestId)} />)}
      </div></div>
    </DialogContent>
  </Dialog>;
}

/** A test: what was written, as the person sees it on the phone, and the actions in order, each with why and how it would arrive. */
function TestResult({ run, timeZone, onCheck }: { run: AgentTestRun; timeZone: string; onCheck: () => void }) {
  const { t, i18n } = useTranslation("whatsappAssistant");
  const language = i18n.resolvedLanguage ?? "es";
  const at = (instant: string) => ({ timestamp: instant, timeLabel: formatTimeInZone(instant, language, timeZone), dateLabel: formatDateTimeInZone(instant, language, timeZone) });
  return <article aria-label={t("test.result", { name: run.recipient })}><Surface>
    <div aria-label={t("test.written")} role="group" className="flex flex-col px-3 pt-3">
      {run.messages.map((message, index) => <MessageBubble key={index} direction="outgoing" text={message} {...at(run.startedAtUtc)} />)}
    </div>
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] p-3">
      {run.state === "pending" && !run.checking ? <div role="status" className="flex items-center gap-2 text-sm text-[var(--color-content-muted)]"><Spinner decorative />{t("test.running")}</div> : null}
      {run.state === "failed" ? <p role="alert" className="text-sm text-[var(--color-danger)]">{t(run.failureCode === "WhatsApp.Assistant.Unavailable" ? "test.unavailable" : "test.notFinished")}</p> : null}
      {run.state === "lost" || run.checking ? <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm">{t("test.lost")}</p>
        <Button type="button" variant="outline" size="sm" pending={run.checking} onClick={onCheck}>{t(run.checking ? "test.checking" : "test.check")}</Button>
      </div> : null}
      {run.state === "completed" ? <>
        <h3 className="text-[length:var(--text-caption)] font-semibold tracking-[0.06em] uppercase text-[var(--color-content-muted)]">{t("test.actions", { count: run.actions.length })}</h3>
        <StepList steps={run.actions.map((action, index) => ({ key: String(index), icon: <span className="text-xs font-semibold">{index + 1}</span>,
          content: <TestAction action={action} time={at(run.finishedAtUtc ?? run.startedAtUtc)} /> }))} />
      </> : null}
    </div>
  </Surface></article>;
}

function TestAction({ action, time }: { action: AgentTestAction; time: { timestamp: string; timeLabel: string; dateLabel: string } }) {
  const { t } = useTranslation("whatsappAssistant");
  // Without reading responses the server leaves out what the model wrote and what a form would fill (H4): it says why there.
  const hidden = !usePermissions().has("formrecords.read");
  const label = action.kind === "SendForm" && action.form ? t("cases.sendNamed", { form: action.form.name }) : t("actions." + action.kind);
  const attachment = action.form ? <MessageCard icon={<FormIcon className="size-4" />} title={action.form.name} description={t("test.openForm")}>
    {action.form.fields.length ? <div className="border-t border-[var(--color-border)] px-3"><DataList items={action.form.fields.map((field, index) => ({ key: String(index), label: field.label, value: field.value ?? "—" }))} /></div>
      : hidden ? <p className="border-t border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-content-muted)]">{t("test.recordsHidden")}</p> : null}
  </MessageCard> : action.buttons?.length ? <ul aria-label={t("test.quickReplies")} className="mt-2 divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)]">
    {action.buttons.map((title, index) => <li key={index} className="px-3 py-2 text-center text-sm text-[var(--color-primary)]">{title}</li>)}
  </ul> : undefined;
  const preview = action.kind !== "NoReply" && (action.text || attachment || action.kind === "Handoff" || (hidden && action.kind === "DraftedReply"));
  return <div className="flex min-w-0 flex-col gap-2">
    <div><AssistantActionTag kind={action.kind} label={label} /></div>
    <DataList items={[
      { key: "case", label: t("test.case"), value: action.caseSource === "Fallback" ? t("cases.fallback") : action.caseTitle || "—" },
      { key: "why", label: t("test.why"), value: action.reason || (hidden ? t("test.recordsHidden") : "—") },
      { key: "used", label: t("test.used"), value: action.used.length ? <ul className="flex flex-col gap-1">{action.used.map((item, index) => <li key={index}>{item}</li>)}</ul> : "—" },
    ]} />
    {preview ? <MessageHistory label={t("test.preview")}>
      {action.kind === "Handoff" ? <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="warning"><UserIcon className="size-3" />{t("test.needsPerson")}</Badge>
        <span>{handoffReasonText(t, action.handoffReasonCode, action.handoffReason)}</span>
      </p> : null}
      {action.text || attachment ? <MessageBubble direction="incoming" text={action.text ?? ""} attachment={attachment} {...time} /> : null}
      {hidden && action.kind === "DraftedReply" && !action.text ? <p className="text-sm text-[var(--color-content-muted)]">{t("test.recordsHidden")}</p> : null}
    </MessageHistory> : null}
  </div>;
}
