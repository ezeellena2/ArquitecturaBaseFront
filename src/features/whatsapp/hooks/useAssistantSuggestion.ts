import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { chatKey } from "../api/chat";
import { discardAssistantSuggestion, getAssistantSuggestion, requestAssistantSuggestion, sendAssistantSuggestion, type AssistantSuggestion, type AssistantSuggestionPointer } from "../api/assistant";
import { freezeAssistantSend, type AssistantSendAttempt } from "../lib/assistantSendSession";

export interface AssistantComposerContext {
  sourceMessageId: string;
  pointer: AssistantSuggestionPointer | null;
  owner: string;
  available: boolean;
}

// Only the private preview resets with its owner; the ordinary editor keeps its DOM and caret.
// Preview values and frozen selections belong only to this active editor, never a mutation cache.
export function useAssistantSuggestion(contactId: string, modeRevision: number, context: AssistantComposerContext | undefined, enabled: boolean, canRequest: boolean, canSubmit: boolean) {
  const { t } = useTranslation("whatsapp");
  const client = useQueryClient();
  const owner = context?.owner ?? contactId;
  const [stateOwner, setStateOwner] = useState(owner);
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [suggestion, setSuggestion] = useState<AssistantSuggestion>();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [attempt, setAttempt] = useState<AssistantSendAttempt>();
  const attemptRef = useRef(attempt);
  const suggestionRef = useRef(suggestion);
  const [recovery, setRecovery] = useState<"none" | "consult" | "repeat">("none");
  const recoveryRef = useRef(recovery);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const deniedRef = useRef(false);
  const [waitUntil, setWaitUntil] = useState(0);
  const deadline = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  const active = useRef(false);
  const requestAllowed = useRef(canRequest);
  requestAllowed.current = canRequest;
  const writeAllowed = useRef(canSubmit);
  writeAllowed.current = canSubmit;
  const operation = useRef<AbortController | null>(null);
  const currentRequest = useRef({ requestId: crypto.randomUUID(), sourceMessageId: context?.sourceMessageId ?? "", expectedModeRevision: modeRevision });
  const pointer = useRef(context?.pointer);
  const initialRetry = useRef(false);
  const initialStarted = useRef(false);
  const pollPaused = useRef(false);
  const noticeId = "whatsapp:assistant:" + owner;
  if (stateOwner !== owner) {
    setStateOwner(owner);
    suggestionRef.current = undefined; setSuggestion(undefined);
    setOpen(false); setSelected([]);
    attemptRef.current = undefined; setAttempt(undefined);
    recoveryRef.current = "none"; setRecovery("none");
    setBusy(false); deniedRef.current = false; setDenied(false);
    deadline.current = 0; setWaitUntil(0); setNow(Date.now());
    currentRequest.current = { requestId: crypto.randomUUID(), sourceMessageId: context?.sourceMessageId ?? "", expectedModeRevision: modeRevision };
    pointer.current = context?.pointer;
    initialRetry.current = false; initialStarted.current = false; pollPaused.current = false;
  }
  const owns = (signal: AbortSignal) => active.current && !signal.aborted && currentOwner.current === owner;
  const setRecoveryState = (value: typeof recovery) => { recoveryRef.current = value; setRecovery(value); };
  const setAttemptState = (value: AssistantSendAttempt | undefined) => { attemptRef.current = value; setAttempt(value); };

  function accept(result: AssistantSuggestion) {
    if (result.sourceMessageId !== context?.sourceMessageId) throw new Error("Unsupported assistant response.");
    pollPaused.current = false;
    suggestionRef.current = result;
    setSuggestion(result);
    dismissNotification(noticeId);
    if (result.state === "Ready" && result.proposal) {
      if (!attemptRef.current) setSelected(result.proposal.fields.map(field => field.fieldId));
      setRecoveryState(attemptRef.current ? "repeat" : "none");
    } else if (result.state !== "Pending") {
      setAttemptState(undefined);
      setRecoveryState("none");
      setOpen(false);
      if (result.state === "Sent") void client.invalidateQueries({ queryKey: chatKey });
    }
  }
  function fail(error: unknown, action: "request" | "consult" | "discard" | "send") {
    const feedback = errorFeedback(error, { writing: action !== "consult" });
    if (action === "consult") pollPaused.current = true;
    if (feedback.kind === "cancelled" || feedback.kind === "session") return;
    if (feedback.kind === "forbidden") {
      deniedRef.current = true; setDenied(true);
      suggestionRef.current = undefined; setSuggestion(undefined);
      setAttemptState(undefined); setOpen(false); setSelected([]); setRecoveryState("none");
      notify({ id: noticeId, kind: "error", message: t("send.forbidden") });
      return;
    }
    if (feedback.kind === "wait") {
      const until = Date.now() + Math.max(1, Math.min(86400, feedback.retryAfterSeconds ?? 30)) * 1000;
      deadline.current = until; setWaitUntil(until);
    }
    if (action === "send") {
      if (feedback.kind === "uncertain" || error instanceof ApiError && error.status === 409) {
        setRecoveryState("consult");
        notify({ id: noticeId, kind: "warning", message: t("forms.uncertain"), action: { label: t("send.check"), onClick: () => void consult() } });
        return;
      }
      setAttemptState(undefined);
    }
    if (action === "request" || action === "discard") setRecoveryState("consult");
    notify({ id: noticeId, kind: "error", message: feedback.kind === "wait" ? t("forms.waitingHint", { count: feedback.retryAfterSeconds ?? 30 }) : readErrorMessage(error, t), action: { label: t("send.check"), onClick: () => void consult() } });
  }
  async function run(action: "request" | "consult" | "discard" | "send", work: (signal: AbortSignal) => Promise<void>) {
    if (!enabledRef.current || !active.current || currentOwner.current !== owner || deniedRef.current || operation.current || Date.now() < deadline.current) return;
    const controller = new AbortController();
    operation.current = controller; setBusy(true);
    try { await work(controller.signal); }
    catch (error) { if (owns(controller.signal)) fail(error, action); }
    finally { if (operation.current === controller) operation.current = null; if (owns(controller.signal)) setBusy(false); }
  }
  async function request() {
    if (!requestAllowed.current) return;
    await run("request", async signal => {
      initialStarted.current = true;
      const result = await requestAssistantSuggestion(contactId, currentRequest.current, signal);
      if (owns(signal)) { initialRetry.current = false; accept(result); }
    });
  }
  async function consult() {
    await run("consult", async signal => {
      const requestId = suggestionRef.current?.requestId ?? pointer.current?.requestId ?? currentRequest.current.requestId;
      try {
        const result = await getAssistantSuggestion(contactId, requestId, signal);
        if (owns(signal)) accept(result);
      } catch (error) {
        if (!owns(signal)) return;
        if (!suggestionRef.current && !pointer.current && error instanceof ApiError && error.status === 404) {
          initialRetry.current = true;
          notify({ id: noticeId, kind: "info", message: t("send.notStored"), action: { label: t("send.retry"), onClick: () => { if (initialRetry.current) void request(); } } });
          return;
        }
        throw error;
      }
    });
  }
  async function discard() {
    const value = suggestionRef.current;
    if (!value || attemptRef.current) return;
    await run("discard", async signal => {
      const result = await discardAssistantSuggestion(contactId, value.requestId, signal);
      if (owns(signal)) accept(result);
    });
  }
  async function send() {
    const value = suggestionRef.current;
    if (!writeAllowed.current || value?.state !== "Ready" || !value.proposal || attemptRef.current && recoveryRef.current !== "repeat") return;
    const frozen = attemptRef.current ?? freezeAssistantSend(value.proposal, selected, crypto.randomUUID());
    await run("send", async signal => {
      setAttemptState(frozen); setRecoveryState("consult");
      const outgoing = await sendAssistantSuggestion(contactId, value.requestId, frozen, signal);
      if (owns(signal)) accept({ ...value, state: "Sent", proposal: null, outgoing });
    });
  }
  const initialize = useEffectEvent(() => { if (pointer.current) void consult(); else if (context?.sourceMessageId) void request(); });
  useEffect(() => {
    active.current = true; initialize();
    return () => { active.current = false; operation.current?.abort(); operation.current = null; dismissNotification(noticeId); };
  }, [noticeId]);
  useEffect(() => { if (canRequest && !initialStarted.current && !pointer.current) initialize(); }, [canRequest]);
  const poll = useEffectEvent(() => { if (!pollPaused.current && suggestionRef.current?.state === "Pending" && document.visibilityState === "visible") void consult(); });
  useEffect(() => {
    if (suggestion?.state !== "Pending") return;
    const timer = window.setInterval(poll, 5000);
    return () => window.clearInterval(timer);
  }, [suggestion?.state]);
  useEffect(() => {
    if (waitUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [waitUntil]);
  return { proposal: stateOwner === owner && !denied && enabled ? suggestion?.proposal ?? null : null, open: stateOwner === owner && !denied && enabled && open, setOpen, selected, setSelected, attempt, recovery, busy, denied,
    waiting: now < waitUntil, waitSeconds: Math.max(0, Math.ceil((waitUntil - now) / 1000)), discard, send, consult };
}
export type AssistantComposerState = ReturnType<typeof useAssistantSuggestion>;
