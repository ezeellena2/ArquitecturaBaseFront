import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchAssistantAgent, saveAssistantAgent, type AgentCulture, type AssistantAgent } from "../api/assistantAgent";
import { caseKey, configOf, draftFromAgent, draftSnapshot, mergeDrafts, moveCase, saveRequest, serverIssueKeys, validateDraft, type AgentConfig, type AgentDraft, type AgentIssue, type DraftAction, type DraftCase, type DraftLimits, type DraftProfile } from "../lib/assistantAgentDraft";

type Work = "save" | "review";
const noticeId = "whatsapp:assistant-agent";
/** A 429 waits what the server says: from 1 s to a day, 30 s if it does not say. */
export const waitSeconds = (seconds?: number) => Math.max(1, Math.min(86400, Math.ceil(seconds ?? 30)));

/**
 * The editor of the screen «Asistente» (AS1-A): one save for the four tabs, with the revision read and the 409 solved as in
 * Información del negocio (review what is saved and keep or drop what was edited). The draft lives here, in memory, and each
 * problem goes to its field: the local ones while it is saved (and live after the first try) and the 400 of the server, with
 * each case named by its id, so moving it keeps its problem.
 */
export function useAssistantAgentEditor(initial: AssistantAgent, queryKey: readonly unknown[]) {
  const { t, i18n } = useTranslation("whatsappAssistant");
  const culture: AgentCulture = i18n.resolvedLanguage === "en" ? "en" : "es";
  const client = useQueryClient();
  const navigate = useNavigate();
  const [baseline, setBaseline] = useState<AgentConfig>(() => configOf(initial));
  const [draft, setDraft] = useState<AgentDraft>(() => draftFromAgent(configOf(initial)));
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
  const [working, setWorking] = useState<Work>();
  const [conflict, setConflict] = useState(false);
  const [review, setReview] = useState<AssistantAgent>();
  const wait = useCountdown(0);
  const active = useRef(true);
  const inFlight = useRef<AbortController | null>(null);
  const baseDraft = useMemo(() => draftFromAgent(baseline), [baseline]);
  const changed = useMemo(() => draftSnapshot(draft) !== draftSnapshot(baseDraft), [draft, baseDraft]);
  const local = useMemo(() => attempted ? validateDraft(draft, baseline.originalCulture) : {}, [attempted, draft, baseline.originalCulture]);
  const message = useMemo(() => (issue: AgentIssue) => {
    const text = t(issue.key, issue.values);
    return issue.culture && issue.culture !== culture ? t("otherLanguageError", { language: t("culturesInText." + issue.culture), message: text }) : text;
  }, [t, culture]);
  const errors = useMemo(() => ({ ...Object.fromEntries(Object.entries(serverErrors).map(([key, messages]) => [key, messages.join(" ")])),
    ...Object.fromEntries(Object.entries(local).map(([key, issue]) => [key, message(issue)])) }), [serverErrors, local, message]);
  const guard = useUnsavedChangesGuard(changed || conflict || working !== undefined);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; inFlight.current?.abort(); dismissNotification(noticeId); };
  }, []);

  const clearServer = (matches: (key: string) => boolean) => setServerErrors(previous => {
    const next = Object.fromEntries(Object.entries(previous).filter(([key]) => !matches(key)));
    return Object.keys(next).length === Object.keys(previous).length ? previous : next;
  });
  const under = (prefix: string) => (key: string) => key === prefix || key.startsWith(prefix + ".");

  function reset(agent: AssistantAgent) {
    setBaseline(configOf(agent)); setDraft(draftFromAgent(configOf(agent))); setServerErrors({}); setAttempted(false); setConflict(false); setReview(undefined);
    client.setQueryData(queryKey, agent); dismissNotification(noticeId);
  }
  function denied(error: unknown) {
    const kind = errorFeedback(error).kind;
    if (kind === "forbidden") { guard.allowNextNavigation(); void navigate("/sin-permiso"); }
    return kind === "forbidden" || kind === "session" || kind === "cancelled";
  }
  function begin(work: Work) {
    if (inFlight.current) return null;
    const controller = new AbortController();
    inFlight.current = controller; setWorking(work);
    return controller;
  }
  function finish(controller: AbortController) {
    if (inFlight.current === controller) inFlight.current = null;
    if (active.current) setWorking(undefined);
  }

  /** Returns the keys of the problems found, so the screen takes the focus to the first one. */
  async function save(): Promise<readonly string[]> {
    if (!changed || inFlight.current || conflict || wait.isRunning) return [];
    setServerErrors({});
    const issues = validateDraft(draft, baseline.originalCulture);
    if (Object.keys(issues).length) { setAttempted(true); return Object.keys(issues); }
    const controller = begin("save");
    if (!controller) return [];
    const caseIds = draft.cases.map(item => item.id);
    try {
      const saved = await saveAssistantAgent(saveRequest(draft, baseline), controller.signal);
      if (!active.current) return [];
      reset(saved);
      notify({ id: noticeId, kind: "success", message: t("saved") });
    } catch (error) {
      if (!active.current || denied(error)) return [];
      const feedback = errorFeedback(error, { writing: true, conflictCodes: ["WhatsApp.AssistantAgent.RevisionConflict"] });
      const fieldErrors = error instanceof ApiError && error.status === 400 ? error.errors : undefined;
      if (feedback.kind === "conflict") {
        setConflict(true);
        notify({ id: noticeId, kind: "warning", message: t("conflict.message") });
      } else if (feedback.kind === "wait") {
        wait.restart(waitSeconds(feedback.retryAfterSeconds));
        notify({ id: noticeId, kind: "error", message: feedback.detail ?? t("saveFailed") });
      } else if (fieldErrors && Object.keys(fieldErrors).length) {
        // Each problem in its field; what has no field on the screen is said once.
        const { fields, others } = serverIssueKeys(fieldErrors, caseIds);
        setServerErrors(fields); setAttempted(true);
        if (others.length) notify({ id: noticeId, kind: "error", message: others.join(" ") });
        return Object.keys(fields);
      } else if (feedback.kind === "uncertain") {
        // The configuration has no receipt (ADR 0018): saving again with the same revision gets a 409 if the first one went through.
        notify({ id: noticeId, kind: "error", message: t("saveUncertain"), description: feedback.traceId ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined });
      } else notify({ id: noticeId, kind: "error", message: feedback.detail ?? t("saveFailed") });
    } finally { finish(controller); }
    return [];
  }

  async function reviewChanges() {
    const controller = begin("review");
    if (!controller) return;
    try {
      const current = await fetchAssistantAgent(controller.signal);
      if (active.current) { setReview(current); dismissNotification(noticeId); }
    } catch (error) {
      if (active.current && !denied(error)) notify({ id: noticeId, kind: "error", message: t("conflict.readFailed") });
    } finally { finish(controller); }
  }

  /** Keeping mine takes what the other person saved where I changed nothing; using theirs drops what I edited. */
  function acceptReview(keep: boolean) {
    if (!review) return;
    const theirs = draftFromAgent(configOf(review));
    setBaseline(configOf(review)); setDraft(keep ? mergeDrafts(draft, baseDraft, theirs) : theirs);
    setServerErrors({}); setConflict(false); setReview(undefined);
    client.setQueryData(queryKey, review);
    notify({ id: noticeId, kind: "info", message: t(keep ? "conflict.merged" : "conflict.adopted") });
  }

  return {
    baseline, draft, changed, errors, attempted, working, conflict, review, guard,
    waitSeconds: wait.seconds,
    busy: working !== undefined,
    setProfile<K extends keyof DraftProfile>(field: K, value: DraftProfile[K]) {
      setDraft(previous => ({ ...previous, profile: { ...previous.profile, [field]: value } }));
      clearServer(key => key === "profile." + field);
    },
    setLimits(next: Partial<DraftLimits>) {
      setDraft(previous => ({ ...previous, limits: { ...previous.limits, ...next } }));
      // An action turned on or off changes what the cases may use: the server's word on that is no longer current.
      clearServer(key => Object.keys(next).some(field => key === "limits." + field || key.startsWith("limits." + field + "["))
        || "allowedActions" in next && /\.(kind|destination)$/.test(key));
    },
    putCase(item: DraftCase) {
      setDraft(previous => ({ ...previous, cases: previous.cases.some(value => value.id === item.id) ? previous.cases.map(value => value.id === item.id ? item : value) : [...previous.cases, item] }));
      clearServer(under(caseKey(item.id)));
    },
    removeCase(id: string) {
      setDraft(previous => ({ ...previous, cases: previous.cases.filter(item => item.id !== id) }));
      clearServer(under(caseKey(id)));
    },
    moveCase(id: string, offset: -1 | 1) { setDraft(previous => ({ ...previous, cases: moveCase(previous.cases, id, offset) })); },
    setCaseActive(id: string, isActive: boolean) { setDraft(previous => ({ ...previous, cases: previous.cases.map(item => item.id === id ? { ...item, isActive } : item) })); },
    setFallback(action: DraftAction) {
      setDraft(previous => ({ ...previous, fallback: action }));
      clearServer(under("fallback"));
    },
    message,
    save,
    discard() { setDraft(draftFromAgent(baseline)); setServerErrors({}); setAttempted(false); },
    reviewChanges,
    acceptReview,
  };
}
export type AssistantAgentEditor = ReturnType<typeof useAssistantAgentEditor>;
