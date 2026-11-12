import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchAssistantAgentTest, startAssistantAgentTest, type AgentTestAction } from "../api/assistantAgent";
import { waitSeconds } from "./useAssistantAgentEditor";

/** A test in the panel: pending while the server works, then its actions, a failure, or lost when its result could not be read. */
export interface AgentTestRun {
  requestId: string; contactId: string; recipient: string; messages: readonly string[];
  state: "pending" | "completed" | "failed" | "lost"; failureCode: string | null; actions: readonly AgentTestAction[];
  startedAtUtc: string; finishedAtUtc: string | null;
  /** Checking again a lost result: its button shows the wait, not the spinner of a new test. */
  checking: boolean;
}
export type AgentTestStart = { ok: true } | { ok: false; recipient?: string; messages?: string };

/** While a test is pending its result is read every 1.5 s (AS3: every 1 or 2 s). */
export const testPollMilliseconds = 1500;
const noticeId = "whatsapp:assistant-agent:test";
const pause = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, milliseconds);
  signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("The test stopped being read.", "AbortError")); }, { once: true });
});

/**
 * Probar (AS3): each test is a POST with its own id and the GET of its result until it is no longer pending. The results pile
 * up, the last one on top, and live only while the panel is open: closing it stops the reads and forgets them. Nothing goes to
 * QueryCache, MutationCache, the address or storage.
 */
export function useAssistantAgentTests(onForbidden: () => void) {
  const { t } = useTranslation("whatsappAssistant");
  const [runs, setRuns] = useState<AgentTestRun[]>([]);
  const wait = useCountdown(0);
  const active = useRef(true);
  const reads = useRef(new Map<string, AbortController>());
  useEffect(() => {
    active.current = true;
    const current = reads.current;
    return () => { active.current = false; for (const controller of current.values()) controller.abort(); current.clear(); dismissNotification(noticeId); };
  }, []);
  const update = (requestId: string, change: Partial<AgentTestRun>) => setRuns(previous => previous.map(run => run.requestId === requestId ? { ...run, ...change } : run));

  async function follow(run: Pick<AgentTestRun, "requestId" | "contactId">) {
    const controller = new AbortController();
    reads.current.set(run.requestId, controller);
    try {
      for (;;) {
        const result = await fetchAssistantAgentTest(run.requestId, run.contactId, controller.signal);
        if (result.state !== "pending") {
          update(run.requestId, { state: result.state, failureCode: result.failureCode, actions: result.actions, finishedAtUtc: new Date().toISOString(), checking: false });
          return;
        }
        await pause(testPollMilliseconds, controller.signal);
      }
    } catch (error) {
      if (controller.signal.aborted || !active.current) return;
      if (errorFeedback(error).kind === "forbidden") { onForbidden(); return; }
      // A test the server does not have was not accepted: it did not run.
      if (error instanceof ApiError && error.status === 404) update(run.requestId, { state: "failed", failureCode: null, finishedAtUtc: new Date().toISOString(), checking: false });
      else update(run.requestId, { state: "lost", checking: false });
    } finally {
      if (reads.current.get(run.requestId) === controller) reads.current.delete(run.requestId);
    }
  }

  async function start(contactId: string, recipient: string, messages: readonly string[]): Promise<AgentTestStart> {
    if (wait.isRunning) return { ok: false };
    const requestId = crypto.randomUUID();
    const run: AgentTestRun = { requestId, contactId, recipient, messages, state: "pending", failureCode: null, actions: [], startedAtUtc: new Date().toISOString(), finishedAtUtc: null, checking: false };
    setRuns(previous => [run, ...previous]);
    dismissNotification(noticeId);
    try {
      await startAssistantAgentTest({ requestId, contactId, messages });
    } catch (error) {
      if (!active.current) return { ok: false };
      const feedback = errorFeedback(error, { writing: true });
      // It may have been accepted: reading its result says so, and a 404 means it did not run.
      if (feedback.kind === "uncertain") { void follow(run); return { ok: true }; }
      setRuns(previous => previous.filter(value => value.requestId !== requestId));
      if (feedback.kind === "forbidden") { onForbidden(); return { ok: false }; }
      if (feedback.kind === "session" || feedback.kind === "cancelled") return { ok: false };
      if (feedback.kind === "wait") wait.restart(waitSeconds(feedback.retryAfterSeconds));
      const fields = error instanceof ApiError && error.status === 400 ? Object.entries(error.errors ?? {}) : [];
      const text = (prefix: string) => fields.filter(([key]) => key === prefix || key.startsWith(prefix + "[")).flatMap(([, value]) => value).join(" ") || undefined;
      const result = { ok: false as const, recipient: text("contactId"), messages: text("messages") };
      if (!result.recipient && !result.messages) notify({ id: noticeId, kind: "error", message: feedback.detail ?? t("test.failed") });
      return result;
    }
    void follow(run);
    return { ok: true };
  }

  return {
    runs,
    /** The newest test is still running: «Probar» shows its spinner. */
    busy: runs[0]?.state === "pending" && !runs[0].checking,
    waitSeconds: wait.seconds,
    start,
    check(requestId: string) {
      const run = runs.find(value => value.requestId === requestId);
      if (!run || run.state !== "lost") return;
      update(requestId, { state: "pending", checking: true });
      void follow(run);
    },
  };
}
