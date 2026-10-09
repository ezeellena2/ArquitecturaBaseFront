import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { IconButton } from "@/shared/ui/IconButton";
import { ChevronLeftIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { MessageBubble, MessageDateDivider } from "@/shared/ui/MessageBubble";
import { MessageHistory } from "@/shared/ui/MessageHistory";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";

type Scenario = "normal" | "missing" | "error" | "noAi" | "readOnly" | "denied" | "expired";
type ContactId = "martina" | "federico";
type SampleMessage = { id: number; text: string; outgoing: boolean };
const scenarios: Scenario[] = ["normal", "missing", "error", "noAi", "readOnly", "denied", "expired"];
const contacts: { id: ContactId; name: string; phone: string }[] = [
  { id: "martina", name: "Martina López", phone: "+54 9 351 555-1234" },
  { id: "federico", name: "Federico Ruiz", phone: "+54 9 351 555-5678" },
];

// Review board only: messages, permissions and suggestions are local sample data.
export function AiReviewChatProposal() {
  const { t } = useTranslation("aiReviewProposal");
  const [params] = useSearchParams();
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [selected, setSelected] = useState<ContactId | null>(() => contacts.find(item => item.id === params.get("contact"))?.id ?? (matchMedia("(max-width: 767px)").matches ? null : "martina"));
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<ContactId, string>>>({});
  const [messages, setMessages] = useState<Partial<Record<ContactId, SampleMessage[]>>>({});
  const guard = useUnsavedChangesGuard(Object.values(drafts).some(value => Boolean(value?.trim())));
  const sequence = useRef(0);
  const contact = contacts.find(item => item.id === selected);
  const filtered = unreadOnly ? [] : contacts.filter(item => `${item.name} ${item.phone}`.toLowerCase().includes(search.toLowerCase()));
  const unread = messages[selected ?? "martina"]?.filter(item => !item.outgoing) ?? [];

  return <Page title={t("title")}>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-[var(--color-content-muted)]">{t("lab")}</p>
      <div className="flex max-w-full flex-wrap gap-2">
        <label htmlFor="ai-review-scenario" className="sr-only">{t("scenario")}</label>
        <NativeSelect id="ai-review-scenario" value={scenario} onChange={event => setScenario(event.target.value as Scenario)}>
          {scenarios.map(value => <option key={value} value={value}>{t(value)}</option>)}
        </NativeSelect>
        <Button variant="outline" size="sm" disabled={!contact || scenario === "denied"} onClick={() => {
          if (contact) setMessages(current => ({ ...current, [contact.id]: [...current[contact.id] ?? [], { id: ++sequence.current, text: t("newMessage"), outgoing: false }] }));
        }}>{t("incoming")}</Button>
      </div>
    </div>
    <Surface>
      {scenario === "denied" ? <EmptyState embedded title={t("deniedTitle")} description={t("deniedHelp")} /> :
        <div className="grid min-h-[38rem] grid-cols-1 md:grid-cols-[280px_minmax(0,1fr)]">
          <aside className={cn("border-r border-[var(--color-border)]", contact ? "max-md:hidden" : "")}>
            <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-3">
              <label htmlFor="ai-review-search" className="sr-only">{t("search")}</label>
              <Input id="ai-review-search" value={search} placeholder={t("search")} onChange={event => setSearch(event.target.value)} />
              <div className="flex gap-2"><Button size="sm" variant={unreadOnly ? "outline" : "default"} onClick={() => setUnreadOnly(false)}>{t("all")}</Button>
                <Button size="sm" variant={unreadOnly ? "default" : "outline"} onClick={() => setUnreadOnly(true)}>{t("unread")}</Button></div>
            </div>
            {filtered.map(item => <div key={item.id} className={cn("border-b border-[var(--color-border)] p-2", selected === item.id ? "bg-[var(--color-surface-muted)]" : "")}>
              <Button variant="ghost" className="w-full justify-start text-left" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{item.name}</Button>
              <p className="truncate px-2 text-xs text-[var(--color-content-muted)]">{t(item.id === "martina" ? "first" : "stockQuestion")}</p>
            </div>)}
            {!filtered.length ? <EmptyState embedded title={t("noMatches")} action={<Button variant="link" onClick={() => { setSearch(""); setUnreadOnly(false); }}>{t("clear")}</Button>} /> : null}
          </aside>
          <section className={cn("flex min-w-0 flex-col", !contact ? "max-md:hidden" : "")}>
            {!contact ? <EmptyState embedded title={t("choose")} description={t("chooseHelp")} /> : <>
              <header className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] p-3">
                <div className="md:hidden"><IconButton label={t("back")} onClick={() => setSelected(null)}><ChevronLeftIcon className="size-4" /></IconButton></div>
                <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{contact.name}</h2><p className="text-xs text-[var(--color-content-muted)]">{contact.phone}</p></div>
                <span className="text-xs text-[var(--color-content-muted)]">{t("manual")}</span>
              </header>
              <div className="flex min-h-[15rem] flex-1 flex-col">
                <MessageHistory label={t("history")}>
                  <MessageDateDivider date="2026-10-02" label={t("today")} />
                  <MessageBubble direction="incoming" text={t(contact.id === "martina" ? "first" : "stockQuestion")} timestamp="2026-10-02T13:40:00Z" timeLabel="10:40" dateLabel={t("today")} />
                  {(messages[contact.id] ?? []).map(message => <MessageBubble key={message.id} direction={message.outgoing ? "outgoing" : "incoming"} text={message.text}
                    timestamp="2026-10-02T13:42:00Z" timeLabel="10:42" dateLabel={t("today")} author={message.outgoing ? t("you") : undefined}
                    delivery={message.outgoing ? { state: "delivered", label: t("delivered") } : undefined} />)}
                </MessageHistory>
              </div>
              <ReviewComposer key={`${contact.id}:${scenario}`} contactId={contact.id} revision={unread.length} scenario={scenario}
                draft={drafts[contact.id] ?? ""} updateDraft={text => setDrafts(current => ({ ...current, [contact.id]: text }))}
                onSend={text => setMessages(current => ({ ...current, [contact.id]: [...current[contact.id] ?? [], { id: ++sequence.current, text, outgoing: true }] }))} />
            </>}
          </section>
        </div>}
    </Surface>
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("leaveTitle")}
      description={t("leaveHint")} confirmLabel={t("leave")} cancelLabel={t("stay")} destructive onConfirm={guard.leave} />
  </Page>;
}

function ReviewComposer({ contactId, revision, scenario, draft, updateDraft, onSend }: {
  contactId: ContactId; revision: number; scenario: Scenario; draft: string; updateDraft: (text: string) => void; onSend: (text: string) => void;
}) {
  const { t } = useTranslation("aiReviewProposal");
  const [suggestion, setSuggestion] = useState<{ text: string; revision: number }>();
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [fieldError, setFieldError] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const noticeId = `proposal-ai-review:${contactId}`;
  const restricted = scenario === "readOnly" || scenario === "expired";
  const stale = Boolean(suggestion && suggestion.revision !== revision);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); dismissNotification(noticeId); }, [noticeId]);
  useEffect(() => { if (suggestion) panel.current?.scrollIntoView({ block: "nearest" }); }, [suggestion]);

  function generate() {
    if (timer.current) clearTimeout(timer.current);
    dismissNotification(noticeId);
    setBusy(true);
    timer.current = setTimeout(() => {
      setBusy(false);
      if (scenario === "error") notify({ id: noticeId, kind: "error", message: t("failed") });
      else setSuggestion({ text: t(contactId === "federico" ? "stockResult" : revision ? "updatedResult" : "result"), revision });
    }, 700);
  }
  function moveToDraft() {
    if (!suggestion || stale) return;
    updateDraft(suggestion.text); setSuggestion(undefined); setFieldError(false);
    dismissNotification(noticeId);
    editor.current?.focus();
    notify({ id: noticeId, kind: "info", message: t("added") });
  }
  function send() {
    if (restricted) return;
    if (!draft.trim()) { setFieldError(true); editor.current?.focus(); return; }
    onSend(draft.trim()); updateDraft(""); setSuggestion(undefined); setFieldError(false);
    if (timer.current) clearTimeout(timer.current);
    setBusy(false);
    notify({ id: noticeId, kind: "success", message: t("sent") });
  }
  return <div className="border-t border-[var(--color-border)] p-3">
    {restricted ? <p className="mb-2 text-xs text-[var(--color-content-muted)]">{t(scenario === "readOnly" ? "readOnlyHelp" : "expiredHelp")}</p> :
      scenario === "noAi" ? <p className="mb-2 text-xs text-[var(--color-content-muted)]">{t("noAiHelp")}</p> :
      scenario === "missing" ? <div className="mb-3 flex flex-wrap items-center gap-2"><p className="text-xs text-[var(--color-content-muted)]">{t("missingHelp")}</p><Button variant="link" size="inline" asChild><Link to="/configuracion/ia">{t("configure")}</Link></Button></div> :
      <div className="mb-3" ref={panel}>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={busy} onClick={generate}>{busy ? <Spinner /> : null}{t(busy ? "generating" : "suggest")}</Button>
          {busy ? <Button variant="muted-link" size="inline" onClick={() => { if (timer.current) clearTimeout(timer.current); setBusy(false); }}>{t("cancel")}</Button> : <span className="text-xs text-[var(--color-content-muted)]">{t("hint")}</span>}
        </div>
        <div aria-live="polite" aria-atomic="true" className="sr-only">{busy ? t("generating") : suggestion ? t("generated") : ""}</div>
        {suggestion ? <section aria-label={t("suggestion")} className="mt-3 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-1"><h3 className="text-sm font-semibold">{t("suggestion")}</h3><span className="text-xs text-[var(--color-content-muted)]">{t("review")}</span></div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{suggestion.text}</p>
          <details className="mt-3 text-xs text-[var(--color-content-muted)]"><summary className="cursor-pointer">{t("sources")}</summary>
            <p className="mt-2">{contactId === "martina" ? `${t("hoursSource")}. ${t("sampleHours")}` : t("stockSource")}</p><p className="mt-1">{t("historySource")}</p>
          </details>
          {stale ? <p className="mt-3 text-xs text-[var(--color-warning-700)]">{t("stale")}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy || stale} onClick={() => { if (draft.trim()) setReplacing(true); else moveToDraft(); }}>{t("use")}</Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={generate}>{t("regenerate")}</Button>
            <Button variant="muted-link" size="inline" disabled={busy} onClick={() => setSuggestion(undefined)}>{t("discard")}</Button>
          </div>
        </section> : null}
      </div>}
    <label htmlFor="ai-review-reply" className="sr-only">{t("reply")}</label>
    <Textarea id="ai-review-reply" ref={editor} rows={3} maxLength={4096} value={draft} disabled={restricted} placeholder={t("placeholder")}
      aria-invalid={fieldError} aria-describedby={fieldError ? "ai-review-reply-error" : undefined}
      onChange={event => { updateDraft(event.target.value); setFieldError(false); }}
      onKeyDown={event => { if (event.ctrlKey && event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
    {fieldError ? <p id="ai-review-reply-error" role="alert" className="mt-1 text-sm text-[var(--color-danger)]">{t("required")}</p> : null}
    <div className="mt-2 flex justify-end"><Button size="sm" disabled={restricted || !draft.trim()} onClick={send}>{t("send")}</Button></div>
    <ConfirmDialog open={replacing} onOpenChange={setReplacing} title={t("replaceTitle")} description={t("replaceHint")}
      confirmLabel={t("replace")} cancelLabel={t("keep")} onConfirm={moveToDraft} />
  </div>;
}
