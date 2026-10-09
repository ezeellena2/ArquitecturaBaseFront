import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FilterBar } from "@/shared/ui/FilterBar";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { ChevronLeftIcon, CheckCheckIcon, CheckIcon, ClockIcon, SendIcon, UserIcon } from "@/shared/ui/icons";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { Page } from "@/shared/ui/Page";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import { AiSuggestionProposal } from "./AiSuggestionProposal";
import { initialContacts, type Contact } from "./proposalContacts";

type Scenario = "normal" | "loading" | "empty" | "error" | "readOnly" | "denied" | "disabled" | "expired" | "sendError" | "uncertain" | "aiError" | "aiMissing";
type Message = { id: string; text: string; direction: "in" | "out"; time: string; author?: "automatic" | "agent"; status?: "read" | "delivered" | "queued"; retained?: boolean };

const scenarios: Scenario[] = ["normal", "loading", "empty", "error", "readOnly", "denied", "disabled", "expired", "sendError", "uncertain", "aiError", "aiMissing"];

export function ContactDetails({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const { t } = useTranslation("chatProposal");
  const restoreFocus = useRestoreFocusOnClose(true);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent onCloseAutoFocus={restoreFocus}>
      <DialogHeader><DialogTitle>{contact.name}</DialogTitle><DialogDescription>{t("customer")}</DialogDescription></DialogHeader>
      <dl className="chat-contact-data">
        <dt>{t("profileName")}</dt><dd>{contact.id === "unknown" ? "—" : contact.name}</dd>
        <dt>{t("phone")}</dt><dd>{contact.phone ?? t("noPhone")}</dd>
        <dt>{t("account")}</dt><dd>{t(contact.linked ? "linked" : "unknown")}</dd>
        {contact.linked ? <><dt>{t("accountName")}</dt><dd>{contact.name}</dd><dt>{t("email")}</dt><dd>{contact.id === "martina" ? "martina@example.com" : t("noEmail")}</dd></> : null}
        <dt>{t("lastInbound")}</dt><dd>{t(contact.time === "yesterday" ? "yesterday" : "today")} {contact.time === "yesterday" ? "16:32" : contact.time}</dd>
      </dl>
      <DialogFooter><Button variant="outline" onClick={onClose}>{t("close")}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function ChatProposal() {
  const { t } = useTranslation("chatProposal");
  const [params] = useSearchParams();
  const [scenario, setScenario] = useState<Scenario>("normal");
  const [contacts, setContacts] = useState(initialContacts);
  const [selectedId, setSelectedId] = useState<string | null>(() => initialContacts.find(row => row.id === params.get("contact"))?.id ?? (matchMedia("(max-width: 767px)").matches ? null : "martina"));
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [additional, setAdditional] = useState<Record<string, Message[]>>({});
  const [sending, setSending] = useState(false);
  const [unconfirmedId, setUnconfirmedId] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [olderVisible, setOlderVisible] = useState(false);
  const [modes, setModes] = useState<Record<string, "bot" | "manual">>({ unknown: "bot" });
  const [nextMode, setNextMode] = useState<"bot" | "manual" | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const revealSuggestion = useCallback(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequence = useRef(0);
  const contact = contacts.find(row => row.id === selectedId) ?? null;
  const mode = contact ? modes[contact.id] ?? "manual" : "manual";
  const draft = contact ? drafts[contact.id] ?? "" : "";
  const visible = scenario === "empty" ? [] : contacts.filter(row =>
    (!unreadOnly || row.unread > 0) && `${row.name} ${row.phone ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const unreadCount = contacts.filter(row => row.unread > 0).length;
  const expired = scenario === "expired" || contact?.id === "javier";
  const unavailable = scenario === "denied" || scenario === "disabled";
  const restricted = expired || scenario === "readOnly" || mode === "bot";
  const currentAdditional = contact ? additional[contact.id] ?? [] : [];
  const guard = useUnsavedChangesGuard(Object.values(drafts).some(value => value.trim().length > 0) && !sending);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [selectedId, currentAdditional.length]);

  function selectContact(row: Contact) {
    setSelectedId(row.id);
    setFieldError(false);
    setOlderVisible(false);
    setNextMode(null);
    setContacts(previous => previous.map(item => item.id === row.id ? { ...item, unread: 0 } : item));
  }

  function changeScenario(value: Scenario) {
    if (timer.current) clearTimeout(timer.current);
    setSending(false);
    setScenario(value);
    setDetailsOpen(false);
    dismissNotification("chat-proposal-load");
    if (value === "error") notify({ id: "chat-proposal-load", kind: "error", message: t("loadCause") });
    if (value === "expired") setSelectedId("javier");
    if (value === "uncertain" || value === "sendError") {
      setSelectedId("martina");
      setDrafts(previous => ({ ...previous, martina: "Hola, Martina. Sí, atendemos hasta las 18." }));
    }
  }

  function clearFilters() { setSearch(""); setUnreadOnly(false); }
  function retryLoad() {
    setScenario("normal"); dismissNotification("chat-proposal-load");
    notify({ id: "chat-proposal-restored", kind: "success", message: t("restored") });
  }

  function appendMessage(contactId: string, message: Message) {
    setAdditional(previous => ({ ...previous, [contactId]: [...previous[contactId] ?? [], message] }));
  }

  function accepted(contactId: string, text: string) {
    appendMessage(contactId, { id: `out-${++sequence.current}`, text, direction: "out", time: "10:43", author: "agent", status: "queued" });
    setDrafts(previous => ({ ...previous, [contactId]: "" }));
    notify({ id: `chat-proposal-send-${contactId}`, kind: "success", message: t("success") });
  }

  function send() {
    if (!contact || sending || restricted || unconfirmedId === contact.id) return;
    if (!draft.trim()) { setFieldError(true); textarea.current?.focus(); return; }
    const contactId = contact.id;
    const text = draft.trim();
    setFieldError(false);
    setSending(true);
    timer.current = setTimeout(() => {
      setSending(false);
      if (scenario === "sendError") {
        notify({ id: `chat-proposal-send-${contactId}`, kind: "error", message: t("failed") });
      } else if (scenario === "uncertain") {
        setUnconfirmedId(contactId);
        notify({ id: `chat-proposal-send-${contactId}`, kind: "info", message: t("uncertainHelp"), action: { label: t("review"), onClick: () => reviewSend(contactId, text) } });
      } else accepted(contactId, text);
    }, 650);
  }

  function reviewSend(contactId: string, text: string) {
    setUnconfirmedId(null); setScenario("normal"); accepted(contactId, text);
  }

  function incoming() {
    const contactId = "federico";
    appendMessage(contactId, { id: `in-${++sequence.current}`, text: t("incomingText"), direction: "in", time: "10:44" });
    setContacts(previous => {
      const row = previous.find(item => item.id === contactId)!;
      return [{ ...row, time: "10:44", preview: "incomingText", unread: selectedId === contactId ? 0 : row.unread + 1 }, ...previous.filter(item => item.id !== contactId)];
    });
    notify({ id: "chat-proposal-incoming", kind: "info", message: t("arrived") });
  }

  const firstContact = initialContacts.find(row => row.id === selectedId);
  const messages: Message[] = !contact ? [] : contact.id === "martina" ? [
    { id: "m1", text: t("m1"), direction: "in", time: "10:40" },
    { id: "m2", text: t("m2"), direction: "out", time: "10:40", author: "automatic", status: "delivered" },
    { id: "m3", text: t("m3"), direction: "out", time: "10:41", author: "agent", status: "read" },
    { id: "m4", text: t("m4"), direction: "in", time: "10:42" },
    ...currentAdditional,
  ] : [{ id: `first-${contact.id}`, text: t(firstContact!.preview), direction: "in", time: firstContact!.time === "yesterday" ? "16:32" : firstContact!.time }, ...currentAdditional];

  return <Page title={t("title")} status={<span className="text-sm text-[var(--color-content-muted)]">{unavailable ? null : `${t("conversations", { count: scenario === "empty" ? 0 : contacts.length })} · ${t("unreadCount", { count: scenario === "empty" ? 0 : unreadCount })}`}</span>}>
    <div className="chat-lab-controls">
      <span className="text-sm text-[var(--color-content-muted)]">{t("lab")}</span>
      <div className="chat-lab-actions">
        <label className="sr-only" htmlFor="chat-scenario">{t("scenario")}</label>
        <div className="chat-lab-select"><NativeSelect id="chat-scenario" value={scenario} onChange={event => changeScenario(event.target.value as Scenario)} aria-label={t("scenario")}>
          {scenarios.map(value => <option key={value} value={value}>{t(value)}</option>)}
        </NativeSelect></div>
        <Button type="button" variant="outline" onClick={incoming} disabled={unavailable || scenario === "empty" || scenario === "loading" || scenario === "error"}>{t("incoming")}</Button>
      </div>
    </div>
    {unavailable ? <Surface><EmptyState embedded title={t(scenario === "denied" ? "deniedTitle" : "disabledTitle")} description={t(scenario === "denied" ? "deniedHelp" : "disabledHelp")} /></Surface> : <>
      <FilterBar>
        <div className="flex flex-wrap items-center gap-3">
          <div className="chat-search min-w-0 flex-1"><SearchInput value={search} onChange={setSearch} label={t("search")} /></div>
          <SegmentedControl aria-label={t("title")} options={[
            { key: "all", label: t("all"), pressed: !unreadOnly, onSelect: () => setUnreadOnly(false) },
            { key: "unread", label: `${t("unread")} (${unreadCount})`, pressed: unreadOnly, onSelect: () => setUnreadOnly(true) },
          ]} />
          {search || unreadOnly ? <Button type="button" variant="link" size="inline" onClick={clearFilters}>{t("clear")}</Button> : null}
        </div>
      </FilterBar>
      <div className="chat-board">
        <Surface>
          {scenario === "loading" ? <div className="chat-state" role="status"><Spinner /><p>{t("loadingLabel")}</p></div> : scenario === "error" ?
            <EmptyState embedded title={t("loadFailed")} description={t("loadFailedHelp")} action={<Button type="button" variant="outline" onClick={retryLoad}>{t("retry")}</Button>} /> :
          scenario === "empty" ? <EmptyState embedded title={t("none")} description={t("noneHelp")} /> :
          <div className={`chat-workspace ${contact ? "has-selection" : ""}`}>
            <section className="chat-inbox" aria-label={t("conversations", { count: visible.length })}>
              <div className="chat-panel-header">{t("conversations", { count: visible.length })}</div>
              <div className="chat-inbox-scroll">
                {!visible.length ? <EmptyState embedded title={t("noMatches")} action={<Button type="button" variant="link" onClick={clearFilters}>{t("clear")}</Button>} /> :
                visible.map(row => <button type="button" key={row.id} className={`chat-conversation ${contact?.id === row.id ? "selected" : ""}`} aria-pressed={contact?.id === row.id} onClick={() => selectContact(row)}>
                  <span className="chat-initial" aria-hidden="true">{row.initials}</span>
                  <span className="chat-conversation-content">
                    <span className="chat-conversation-line"><strong>{row.name}</strong><span>{row.time === "yesterday" ? t("yesterday") : row.time}</span></span>
                    <span className="chat-conversation-line"><span className={row.unread ? "chat-unread-text" : ""}>{t(row.preview)}</span>{row.unread ? <span className="chat-unread" aria-label={`${row.unread} ${t("unread")}`}>{row.unread}</span> : null}</span>
                    {drafts[row.id] ? <span className="chat-draft">{t("draft")}</span> : null}
                  </span>
                </button>)}
              </div>
            </section>
            <section className="chat-thread" aria-label={contact?.name ?? t("choose")}>
              {!contact ? <EmptyState embedded title={t("choose")} description={t("chooseHelp")} /> : <>
                <header className="chat-thread-header">
                  <div className="chat-mobile-back"><IconButton label={t("back")} onClick={() => setSelectedId(null)}><ChevronLeftIcon className="size-4" /></IconButton></div>
                  <span className="chat-initial" aria-hidden="true">{contact.initials}</span>
                  <div className="chat-thread-name"><h2>{contact.name}</h2><span>{contact.phone ?? t("noPhone")}</span></div>
                  <IconButton label={t("contact")} onClick={() => setDetailsOpen(true)}><UserIcon className="size-4" /></IconButton>
                </header>
                <div className="chat-mode-bar"><FormField label={t("mode")}><NativeSelect value={mode} disabled={scenario === "readOnly" || sending || unconfirmedId === contact.id} onChange={event => setNextMode(event.target.value as "bot" | "manual")}><option value="manual">{t("manual")}</option><option value="bot">{t("bot")}</option></NativeSelect></FormField></div>
                <div className="chat-messages" role="log" aria-label={t("title")} aria-live="polite" aria-relevant="additions text">
                  <div className="chat-history"><Button type="button" variant="link" onClick={() => setOlderVisible(true)} disabled={olderVisible}>{t("history")}</Button></div>
                  {olderVisible ? <><p className="chat-day">{t("olderDate")}</p><article className="chat-message in retained"><p>{t("retained")}</p><footer>09:10</footer></article></> : null}
                  <p className="chat-day">{t(contact.time === "yesterday" ? "yesterday" : "today")}</p>
                  {messages.map(message => <article key={message.id} className={`chat-message ${message.direction}`}>
                    <p>{message.text}</p>
                    <footer>{message.author ? <span>{t(message.author)}</span> : null}<span>{message.time}</span>
                      {message.status ? <span className="chat-delivery">{message.status === "queued" ? <ClockIcon className="size-3.5" /> : message.status === "read" ? <CheckCheckIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />}{t(message.status)}</span> : null}
                    </footer>
                  </article>)}
                  <div ref={bottom} />
                </div>
                <div className="chat-reply-state">
                  {restricted ? <p>{t(expired ? "windowClosedHelp" : scenario === "readOnly" ? "readOnlyHelp" : "botHelp")}</p> : unconfirmedId === contact.id ? <p role="status">{t("uncertainHelp")}</p> : <span><ClockIcon className="size-3.5" />{t("windowOpen")}<span className="chat-window-detail"> · {t("windowHelp")}</span></span>}
                </div>
                {mode === "bot" && !expired && scenario !== "readOnly" ? <div className="chat-composer"><Button variant="outline" onClick={() => setNextMode("manual")}>{t("takeOver")}</Button></div> : null}
                {!restricted ? <form className="chat-composer" onSubmit={event => { event.preventDefault(); send(); }}>
                  {!sending && unconfirmedId !== contact.id ? <AiSuggestionProposal key={contact.id} onReveal={revealSuggestion} fail={scenario === "aiError"} missing={scenario === "aiMissing"} onUse={text => { setDrafts(previous => ({ ...previous, [contact.id]: previous[contact.id]?.trim() ? `${previous[contact.id]}\n${text}` : text })); setFieldError(false); textarea.current?.focus(); notify({ id: "proposal-suggestion", kind: "info", message: t("aiAdded") }); }} /> : null}
                  <FormField label={t("reply")} error={fieldError ? t("required") : undefined}>
                    <Textarea ref={textarea} placeholder={t("placeholder")} value={draft} maxLength={4096} disabled={sending || unconfirmedId === contact.id}
                      onChange={event => { setDrafts(previous => ({ ...previous, [contact.id]: event.target.value })); setFieldError(false); }}
                      onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
                  </FormField>
                  <div className="chat-composer-footer"><span>{t("hint")}</span>
                    {unconfirmedId === contact.id ? <Button type="button" variant="outline" onClick={() => reviewSend(contact.id, draft)}>{t("review")}</Button> :
                      <Button type="submit" disabled={sending}><SendIcon className="size-4" />{t(sending ? "sending" : "send")}</Button>}
                  </div>
                </form> : null}
              </>}
            </section>
          </div>}
        </Surface>
      </div>
    </>}
    {detailsOpen && contact ? <ContactDetails contact={contact} onClose={() => setDetailsOpen(false)} /> : null}
    <ConfirmDialog open={nextMode !== null} onOpenChange={open => { if (!open) setNextMode(null); }} title={t("modeTitle")} description={t("modeHint")} confirmLabel={t("modeConfirm")} onConfirm={() => { if (contact && nextMode) setModes(previous => ({ ...previous, [contact.id]: nextMode })); setNextMode(null); notify({ id: "proposal-mode", kind: "success", message: t("modeSaved") }); }} />
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("leaveTitle")} description={t("leaveHint")} confirmLabel={t("discard")} cancelLabel={t("stay")} onConfirm={guard.leave} />
  </Page>;
}
