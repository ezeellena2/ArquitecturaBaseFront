import { useMemo, useState } from "react";
import { AssistantRuntimeProvider, ThreadListPrimitive, useExternalStoreRuntime, type ThreadMessageLike } from "@assistant-ui/react";
import { useTranslation } from "react-i18next";
import { AssistantThread } from "@/shared/ui/assistant/AssistantThread";
import { AssistantComposer } from "@/shared/ui/assistant/AssistantComposer";
import { AssistantMessage } from "@/shared/ui/assistant/AssistantMessage";
import { AssistantSuggestions } from "@/shared/ui/assistant/AssistantSuggestions";
import { AssistantWelcome } from "@/features/artificial-intelligence/components/assistant/AssistantWelcome";
import { Page } from "@/shared/ui/Page";
import { Button } from "@/shared/ui/button";
import { IconButton } from "@/shared/ui/IconButton";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Pagination } from "@/shared/ui/Pagination";
import { Spinner } from "@/shared/ui/Spinner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon } from "@/shared/ui/icons";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { calendarDateInZone, formatTimeInZone } from "@/shared/lib/dateTime";
import { copy } from "./copy";
import { ConversationGroups } from "./ConversationRow";
import { ConversationActions } from "./conversationActions";

type Scene = keyof typeof copy.es.states;
type Conversation = { id: string; title: string; date: string; messages: ThreadMessageLike[]; restriction?: "blocked" | "expired" };
const zone = "America/Argentina/Buenos_Aires";
const referenceNow = "2026-10-04T15:00:00Z";
const timestamp = "2026-10-04T12:00:00Z";
const params = new URLSearchParams(location.search);
const initialScene = (params.get("scene") ?? "empty") as Scene;
const scenes = Object.keys(copy.es.states) as Scene[];

function PreviewUserMessage() {
  const { t, i18n } = useTranslation("assistant");
  return <AssistantMessage role="user" label={t("you")} timestamp={timestamp} timeLabel={formatTimeInZone(timestamp, i18n.language, zone)} />;
}
function PreviewAnswerMessage() {
  const { t, i18n } = useTranslation(["assistant", "conversationPreview"]);
  return <AssistantMessage role="assistant" label={t("assistant")} timestamp={timestamp} timeLabel={formatTimeInZone(timestamp, i18n.language, zone)} copyLabel={t("copy")}>
    <p className="mt-4 text-sm text-[var(--color-content-muted)]">{t("conversationPreview:source")} · {t("conversationPreview:observed", { time: formatTimeInZone(timestamp, i18n.language, zone) })}</p>
    <Button variant="link">{t("conversationPreview:viewUsers")}</Button>
  </AssistantMessage>;
}

export function ConversationsBoard() {
  const { t, i18n } = useTranslation(["conversationPreview", "assistant", "common"]);
  const english = i18n.language.startsWith("en");
  const text = copy[english ? "en" : "es"];
  const [scene, setScene] = useState<Scene>(scenes.includes(initialScene) ? initialScene : "empty");
  const [open, setOpen] = useState(params.get("panel") !== "closed");
  const [mobileOpen, setMobileOpen] = useState(false);
  const restoreDrawer = useRestoreFocusOnClose(mobileOpen);
  const [draft, setDraft] = useState("");
  const [decision, setDecision] = useState<{ id: string | null } | null>(null);
  const restoreDecision = useRestoreFocusOnClose(!!decision);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(params.get("page") === "2" ? 2 : 1);
  const [items, setItems] = useState<Conversation[]>(() => scene === "noHistory" ? [] : text.sampleTitles.map((title, index) => ({
    id: `sample-${index}`, title,
    date: index < 2 ? `2026-10-04T${String(12 - index).padStart(2, "0")}:00:00Z` : index < 4 ? `2026-10-03T${String(12 - index).padStart(2, "0")}:00:00Z` : `2026-09-${30 - index}T12:00:00Z`,
    messages: [
      { id: `sample-${index}:user`, role: "user", content: [{ type: "text", text: title }] },
      { id: `sample-${index}:assistant`, role: "assistant", content: [{ type: "text", text: index === 0 ? text.sampleAnswer : text.sampleReply }] },
    ],
    restriction: (scene === "blocked" || scene === "expired") && index === 0 ? scene : undefined,
  })));
  const [selected, setSelected] = useState<string | null>(["answer", "blocked", "expired", "active"].includes(initialScene) ? "sample-0" : null);
  const [pendingMessages, setPendingMessages] = useState<ThreadMessageLike[]>([]);
  const active = scene === "active";
  const uncertain = scene === "uncertain";
  const selectedItem = items.find(item => item.id === selected);
  const pageSize = 6; // Small fixture pages; the product plan keeps the existing page size of 20.
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleItems = useMemo(() => items.slice((currentPage - 1) * pageSize, currentPage * pageSize), [items, currentPage]);
  const threadRows = useMemo(() => visibleItems.map(item => ({ id: item.id, status: "regular" as const, title: item.restriction ? t("generic") : item.title })), [visibleItems, t]);
  const messages = selectedItem?.messages ?? pendingMessages;
  const runtime = useExternalStoreRuntime({
    messages, convertMessage: message => message, isRunning: false,
    adapters: { threadList: {
      threadId: selected ?? undefined,
      threads: threadRows,
      onSwitchToThread: id => choose(id), onSwitchToNewThread: () => choose(null),
    } },
    onNew: async message => {
      // A real acceptance returns asynchronously; let the native submit event finish first.
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      const question = message.content.filter(part => part.type === "text").map(part => part.text).join("\n");
      const id = selected ?? `sample-new-${items.length}`;
      const next: ThreadMessageLike[] = [...messages,
        { id: `${id}:user-${messages.length}`, role: "user", content: [{ type: "text", text: question }] },
        { id: `${id}:assistant-${messages.length}`, role: "assistant", content: [{ type: "text", text: text.sampleReply }] },
      ];
      setItems(previous => selected ? previous.map(item => item.id === selected ? { ...item, messages: next } : item)
        : [{ id, title: question.trim().replace(/\s+/g, " ").slice(0, 80), date: referenceNow, messages: next }, ...previous]);
      setSelected(id); setPendingMessages([]); setDraft(""); setScene("answer");
    },
  });
  function go(id: string | null) {
    setSelected(id); setDraft(""); setPendingMessages([]); setMobileOpen(false); setDecision(null);
    setScene(id ? items.find(item => item.id === id)?.restriction ?? "answer" : "empty");
  }
  function choose(id: string | null) {
    if (uncertain || id === selected && id !== null) return;
    if (draft.trim() || active) setDecision({ id }); else go(id);
  }
  function changeScene(value: Scene) {
    const next = new URLSearchParams(location.search); next.set("scene", value);
    location.assign(`${location.pathname}?${next}`);
  }
  function changePage(value: number) {
    setPage(value);
    const next = new URLSearchParams(location.search); next.set("page", String(value));
    history.replaceState(null, "", `${location.pathname}?${next}`);
  }
  const groups = [
    { label: t("today"), matches: (item: Conversation) => calendarDateInZone(item.date, zone) === calendarDateInZone(referenceNow, zone) },
    { label: t("yesterday"), matches: (item: Conversation) => calendarDateInZone(item.date, zone) === "2026-10-03" },
    { label: t("previous"), matches: (item: Conversation) => calendarDateInZone(item.date, zone) < "2026-10-03" },
  ];
  function renderList(drawer: boolean) {
    return <ThreadListPrimitive.Root className="conversation-panel-body">
      {!drawer ? <div className="conversation-panel-heading"><h2>{t("conversations")}</h2><IconButton label={t("hide")} onClick={() => setOpen(false)}><ChevronLeftIcon /></IconButton></div> : null}
      <div className="conversation-new"><ThreadListPrimitive.New asChild disabled={uncertain}><Button className="w-full justify-start gap-2" variant="ghost"><PencilIcon />{t("newConversation")}</Button></ThreadListPrimitive.New></div>
      <div className="conversation-list" aria-label={t("conversations")}>
        {scene === "loading" ? <div className="conversation-list-status" role="status"><Spinner />{t("loading")}</div>
          : scene === "error" ? <EmptyState embedded title={t("loadFailed")} action={<Button variant="outline" onClick={() => setScene("empty")}>{t("retry")}</Button>} />
          : scene === "noHistory" || !items.length ? <p className="conversation-empty-history">{t("emptyHistory")}</p>
          : <ConversationGroups groups={groups.map(group => ({ label: group.label, ids: visibleItems.filter(group.matches).map(item => item.id) }))} />}
      </div>
      {!["loading", "error", "noHistory"].includes(scene) && items.length ? <div className="conversation-pagination"><Pagination page={currentPage} pageSize={pageSize} totalCount={items.length} totalPages={totalPages} hasPrevious={!uncertain && currentPage > 1} hasNext={!uncertain && currentPage < totalPages} onPageChange={changePage} /></div> : null}
    </ThreadListPrimitive.Root>;
  }
  return <AssistantRuntimeProvider runtime={runtime}><ConversationActions.Provider value={{ disabled: uncertain, requestDelete: setDeleteId }}><Page viewport title={t("common:home.title")}>
    <div className="conversation-lab-controls" data-review={params.get("review") === "1"}>
      <span>{t("preview")}</span>
      <label>{t("state")}<NativeSelect value={scene} onChange={event => changeScene(event.target.value as Scene)}>{scenes.map(value => <option value={value} key={value}>{t(`states.${value}`)}</option>)}</NativeSelect></label>
      <label>{t("language")}<NativeSelect value={english ? "en" : "es"} onChange={event => { const next = new URLSearchParams(location.search); next.set("lang", event.target.value); location.assign(`${location.pathname}?${next}`); }}><option value="es">Español</option><option value="en">English</option></NativeSelect></label>
    </div>
    {scene === "denied" ? <ForbiddenPage /> : <div className="conversation-workspace" data-open={open}>
      {open ? <aside className="conversation-desktop-panel" aria-label={t("conversations")}>{renderList(false)}</aside> : null}
      <div className="conversation-main">
        <div className="conversation-thread-toolbar">
          <div className="conversation-desktop-trigger">{!open ? <IconButton label={t("show")} onClick={() => setOpen(true)}><ChevronRightIcon /></IconButton> : null}</div>
          <div className="conversation-mobile-trigger"><IconButton label={t("show")} onClick={() => setMobileOpen(true)}><ChevronRightIcon /></IconButton></div>
          <span>{selectedItem?.restriction ? t("generic") : selectedItem?.title ?? t("current")}</span>
        </div>
        {scene === "blocked" || scene === "expired" ? <div className="conversation-content-status"><EmptyState embedded title={t(scene)} action={<Button variant="outline" onClick={() => go(null)}>{t("newConversation")}</Button>} /></div>
          : <>
            <AssistantThread label={t("assistant:thread")} UserMessage={PreviewUserMessage} AssistantMessage={PreviewAnswerMessage}
              welcome={<AssistantWelcome />}
              suggestions={<AssistantSuggestions items={text.sampleTitles.slice(0, 3).map((question, index) => ({ id: String(index), question }))} disabled={active || uncertain} onChoose={setDraft} />}
              operation={active ? <div role="status" className="conversation-operation"><Spinner />{t("querying")}<Button variant="link" onClick={() => setScene("answer")}>{t("cancel")}</Button></div> : undefined}
              availability={uncertain ? <div className="conversation-uncertain" role="status"><p>{t("uncertain")}</p><p>{t("uncertainHelp")}</p><Button variant="link" onClick={() => setScene("empty")}>{t("check")}</Button></div> : undefined}
              composer={<AssistantComposer value={draft} onValueChange={setDraft} label={t("assistant:question")} hint={t("assistant:keyboardHelp")} placeholder={t("assistant:placeholder")} sendLabel={t("assistant:send")} disabled={active || uncertain} />}
            />
          </>}
      </div>
    </div>}
    <Dialog open={mobileOpen} onOpenChange={setMobileOpen}><DialogContent className="conversation-drawer" onCloseAutoFocus={restoreDrawer}><DialogHeader><DialogTitle>{t("conversations")}</DialogTitle><DialogDescription className="sr-only">{t("emptyHistory")}</DialogDescription></DialogHeader>{renderList(true)}</DialogContent></Dialog>
    <Dialog open={!!decision} onOpenChange={value => { if (!value) setDecision(null); }}><DialogContent onCloseAutoFocus={restoreDecision}><DialogHeader><DialogTitle>{t("discardTitle")}</DialogTitle><DialogDescription>{t(active ? "activeHelp" : "discardHelp")}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDecision(null)}>{t("keep")}</Button>{active ? <Button variant="outline" onClick={() => go(decision?.id ?? null)}>{t("cancelContinue")}</Button> : null}<Button onClick={() => go(decision?.id ?? null)}>{t(active ? "background" : "discard")}</Button></DialogFooter></DialogContent></Dialog>
    <ConfirmDialog open={!!deleteId} onOpenChange={value => { if (!value) setDeleteId(null); }} title={t("deleteTitle")} description={t("deleteHelp")} confirmLabel={t("delete")} destructive onConfirm={() => { setItems(previous => previous.filter(item => item.id !== deleteId)); if (selected === deleteId) go(null); }} />
  </Page></ConversationActions.Provider></AssistantRuntimeProvider>;
}
