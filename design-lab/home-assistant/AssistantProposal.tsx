import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ArrowUp, History, MessageSquarePlus, Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { FormField } from "@/shared/ui/FormField";
import { Textarea } from "@/shared/ui/Textarea";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Spinner } from "@/shared/ui/Spinner";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";

type Scene = "empty" | "answer" | "loading" | "paused" | "missing" | "denied" | "uncertain" | "failure";
type Kind = "users" | "roles" | "help" | "clarify";
type Turn = { question: string; kind: Kind };
const scenes: Scene[] = ["empty", "answer", "loading", "paused", "missing", "denied", "uncertain", "failure"];

export function SetupProposal() {
  const { t } = useTranslation("assistantProposal");
  return <Page title={t("setupTitle")}><EmptyState title={t("setupTitle")} description={t("setupHelp")}
    action={<Button asChild variant="outline"><Link to="/">{t("back")}</Link></Button>} /></Page>;
}

export function AssistantProposal() {
  const { t, i18n } = useTranslation("assistantProposal");
  const queryScene = new URLSearchParams(location.search).get("scene");
  const initialScene = scenes.includes(queryScene as Scene) ? queryScene as Scene : "empty";
  const [scene, setScene] = useState<Scene>(initialScene);
  const [draft, setDraft] = useState("");
  const [validation, setValidation] = useState(false);
  const [turns, setTurns] = useState<Turn[]>(initialScene === "answer" || initialScene === "uncertain" ? [{ question: t("users"), kind: "users" }] : []);
  const [running, setRunning] = useState(false);
  const [canceled, setCanceled] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sourceKind, setSourceKind] = useState<Kind | null>(null);
  const [confirm, setConfirm] = useState<"new" | "delete" | "retry" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const restoreHistoryFocus = useRestoreFocusOnClose(historyOpen);
  const restoreSourceFocus = useRestoreFocusOnClose(sourceKind !== null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); dismissNotification("assistant-proposal-load"); }, []);

  function chooseScene(next: Scene) {
    if (timer.current) clearTimeout(timer.current);
    setRunning(false); setCanceled(false); setValidation(false); setScene(next);
    setTurns(next === "answer" || next === "uncertain" ? [{ question: t("users"), kind: "users" }] : []);
    dismissNotification("assistant-proposal-load");
    if (next === "failure") notify({ id: "assistant-proposal-load", kind: "error", message: t("loadToast"), action: { label: t("retry"), onClick: () => chooseScene("answer") } });
  }
  function submit(question = draft) {
    if (running) return;
    if (!question.trim()) { setValidation(true); textarea.current?.focus(); return; }
    const kind: Kind = question === t("users") ? "users" : question === t("roles") ? "roles" : question === t("help") ? "help" : "clarify";
    setValidation(false); setDraft(""); setCanceled(false); setScene("answer");
    setTurns(previous => [...previous, { question: question.trim(), kind }]); setRunning(true);
    timer.current = setTimeout(() => { setRunning(false); timer.current = null; }, 1100);
  }
  function stop() { if (timer.current) clearTimeout(timer.current); setRunning(false); setCanceled(true); }
  function newConversation() {
    if (draft.trim()) { setConfirm("new"); return; }
    chooseScene("empty"); textarea.current?.focus();
  }
  function confirmed() {
    if (confirm === "retry") { chooseScene("empty"); submit(t("users")); }
    else { setDraft(""); chooseScene("empty"); if (confirm === "delete") notify({ id: "assistant-proposal-delete", kind: "success", message: t("deleted") }); }
    setConfirm(null);
  }
  const blocked = ["loading", "paused", "missing", "denied", "failure"].includes(scene);
  const sourceName = (kind: Kind) => t(kind === "roles" ? "sourceRoles" : kind === "help" ? "sourceHelp" : "sourceUsers");

  return <>
    <div className="assistant-lab-bar"><span>{t("lab")}</span><div className="assistant-lab-tools">
      <label htmlFor="assistant-scene">{t("scenario")}</label>
      <NativeSelect id="assistant-scene" value={scene} onChange={event => chooseScene(event.target.value as Scene)}>
        {scenes.map(item => <option key={item} value={item}>{t(item)}</option>)}
      </NativeSelect>
      <a href={`?lang=${i18n.language.startsWith("en") ? "es" : "en"}&scene=${scene}`} aria-label={i18n.language.startsWith("en") ? "Español" : "English"}>{i18n.language.startsWith("en") ? "ES" : "EN"}</a>
    </div></div>
    <Page title={t("title")} actions={scene === "denied" ? undefined : <>
      <Button type="button" variant="outline" onClick={() => setHistoryOpen(true)}><History aria-hidden="true" />{t("history")}</Button>
      <Button type="button" variant="outline" disabled={running} onClick={newConversation}><MessageSquarePlus aria-hidden="true" />{t("newChat")}</Button>
    </>}>
      <div className="assistant-proposal">
        <Surface title={t("conversation")}><div className="assistant-conversation">
        {blocked ? <div className="assistant-welcome">
          {scene === "loading" ? <><Spinner /><p role="status">{t("loadingTitle")}</p></> :
          <EmptyState embedded title={t(`${scene}Title`)} description={scene === "failure" ? undefined : t(`${scene}Help`)}
            action={scene === "paused" || scene === "missing" ? <Button asChild variant="outline"><Link to="/configuracion/ia">{t("configure")}</Link></Button> :
              scene === "failure" ? <Button variant="outline" onClick={() => chooseScene("answer")}>{t("retry")}</Button> : undefined} />}
        </div> : turns.length === 0 ? <div className="assistant-welcome">
          <h2>{t("welcome")}</h2><p>{t("intro")}</p>
          <div className="assistant-suggestions">{(["users", "roles", "help"] as const).map(kind => <Button key={kind} variant="outline" onClick={() => { setDraft(t(kind)); textarea.current?.focus(); }}>{t(kind)}</Button>)}</div>
        </div> : <div className="assistant-thread" aria-label={t("historyTitle")}>
          {turns.map((turn, index) => <div key={`${index}-${turn.kind}`} className="flex flex-col gap-6">
            <p className="assistant-question" aria-label={t("you")}>{turn.question}</p>
            {index === turns.length - 1 && (running || canceled || scene === "uncertain") ?
              running ? <div className="assistant-progress" role="status"><Spinner />{t("consulting")}</div> :
              canceled ? <EmptyState embedded title={t("canceled")} description={t("canceledHelp")} /> :
              <EmptyState embedded title={t("uncertainTitle")} description={t("uncertainHelp")} action={<div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => { chooseScene("answer"); notify({ id: "assistant-proposal-recovered", kind: "success", message: t("recovered") }); }}>{t("check")}</Button>
                <Button variant="outline" onClick={() => setConfirm("retry")}>{t("newAttempt")}</Button></div>} /> :
              <article className="assistant-answer">
                <div className="assistant-answer-name"><Sparkles className="size-4" aria-hidden="true" />{t("assistant")}</div>
                <p>{t(turn.kind === "clarify" ? "clarify" : `${turn.kind === "users" ? "user" : turn.kind === "roles" ? "role" : "help"}Answer`)}</p>
                {turn.kind === "users" ? <dl className="assistant-counts">{([['active', 3], ['inactive', 1], ['total', 4]] as const).map(([key, count]) => <div key={key}><dt>{t(key)}</dt><dd>{count}</dd></div>)}</dl> : null}
                {turn.kind !== "clarify" ? <div className="assistant-source"><div className="assistant-source-row"><strong>{t("sources")}</strong><span>{sourceName(turn.kind)}</span><span>{t("sourceTime")}</span></div>
                  <div><Button variant="ghost" onClick={() => setSourceKind(turn.kind)}>{t("viewSource")}</Button></div></div> : null}
              </article>}
          </div>)}
        </div>}
        {!blocked ? <form className="assistant-compose" onSubmit={event => { event.preventDefault(); submit(); }}>
          <FormField label={t("prompt")} error={validation ? t("validation") : undefined}>
            <Textarea ref={textarea} value={draft} disabled={running || scene === "uncertain"} maxLength={4000} placeholder={t("placeholder")}
              onChange={event => { setDraft(event.target.value); setValidation(false); }} onKeyDown={event => { if (event.ctrlKey && event.key === "Enter") { event.preventDefault(); submit(); } }} />
          </FormField>
          <div className="assistant-compose-action">{running ? <Button type="button" variant="outline" onClick={stop}>{t("stop")}</Button> :
            <Button type="submit" disabled={scene === "uncertain"}><ArrowUp aria-hidden="true" />{t("send")}</Button>}</div>
          <p className="assistant-compose-foot">{t("footer")}</p>
        </form> : null}
        </div></Surface>
      </div>
    </Page>
    <Dialog open={historyOpen} onOpenChange={setHistoryOpen}><DialogContent onCloseAutoFocus={restoreHistoryFocus}>
      <DialogHeader><DialogTitle>{t("historyTitle")}</DialogTitle><DialogDescription>{t("historyHelp")}</DialogDescription></DialogHeader>
      {turns.length ? <div className="assistant-history-row"><Button variant="ghost" onClick={() => setHistoryOpen(false)}>{turns[0].question}</Button><p>{t("historyWhen")}</p>
        <Button variant="outline" onClick={() => { setHistoryOpen(false); setConfirm("delete"); }}>{t("delete")}</Button></div> : <EmptyState embedded title={t("historyEmpty")} />}
      <DialogFooter><Button variant="outline" onClick={() => setHistoryOpen(false)}>{t("close")}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={sourceKind !== null} onOpenChange={open => { if (!open) setSourceKind(null); }}><DialogContent onCloseAutoFocus={restoreSourceFocus}>
      <DialogHeader><DialogTitle>{t("dataTitle")}</DialogTitle><DialogDescription>{t(sourceKind === "roles" ? "sourceRoleScope" : sourceKind === "help" ? "sourceHelpScope" : "sourceScope")}</DialogDescription></DialogHeader>
      {sourceKind === "users" ? <Table><TableHeader><TableRow><TableHead>{t("status")}</TableHead><TableHead>{t("count")}</TableHead></TableRow></TableHeader><TableBody>
        {([['active', 3], ['inactive', 1], ['total', 4]] as const).map(([key, count]) => <TableRow key={key}><TableCell>{t(key)}</TableCell><TableCell>{count}</TableCell></TableRow>)}</TableBody></Table> :
        sourceKind === "roles" ? <Table><TableHeader><TableRow><TableHead>{t("permission")}</TableHead></TableRow></TableHeader><TableBody>
          <TableRow><TableCell>{t("readUsers")}</TableCell></TableRow><TableRow><TableCell>{t("readRoles")}</TableCell></TableRow></TableBody></Table> : <p>{t("helpAnswer")}</p>}
      <DialogFooter><Button variant="outline" onClick={() => setSourceKind(null)}>{t("close")}</Button></DialogFooter>
    </DialogContent></Dialog>
    <ConfirmDialog open={confirm !== null} onOpenChange={open => { if (!open) setConfirm(null); }}
      title={t(confirm === "delete" ? "deleteTitle" : confirm === "retry" ? "retryTitle" : "draftTitle")}
      description={t(confirm === "delete" ? "deleteHelp" : confirm === "retry" ? "retryHelp" : "draftHelp")}
      confirmLabel={t(confirm === "delete" ? "delete" : confirm === "retry" ? "newAttempt" : "newChat")}
      cancelLabel={confirm === "new" ? t("draftCancel") : undefined} destructive={confirm === "delete"} onConfirm={confirmed} />
  </>;
}
