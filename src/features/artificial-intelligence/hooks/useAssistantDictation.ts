import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import { assistantApi } from "../api/assistant";

/// Normalizes a recording before its turn (IA4): uploads it under its own request, follows the normalization and returns that
/// request once the server heard it. The same recording keeps its request, so a retry never uploads it again and one already heard
/// is not uploaded at all; after a failed normalization the next attempt uses another one. A 429 starts Home's common wait.
export function useAssistantDictation({ userId, onForbidden, onWait }: {
  userId: string;
  onForbidden: () => void;
  onWait: (seconds: number) => void;
}) {
  const { t } = useTranslation(["assistant", "common"]);
  const [normalizing, setNormalizing] = useState(false);
  const [error, setError] = useState<string>();
  const pending = useRef<{ recording: Blob; requestId: string; heard: boolean } | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function normalize(recording: Blob): Promise<string | undefined> {
    if (request.current) return undefined;
    if (pending.current?.recording === recording && pending.current.heard) return pending.current.requestId;
    const controller = new AbortController();
    request.current = controller;
    setNormalizing(true);
    setError(undefined);
    if (pending.current?.recording !== recording) pending.current = { recording, requestId: crypto.randomUUID(), heard: false };
    const current = pending.current;
    try {
      let status = await assistantApi.uploadAudio(current.requestId, recording, controller.signal);
      while (status.state === "pending" || status.state === "running") {
        await wait(status.pollingAfterSeconds * 1000, controller.signal);
        status = await assistantApi.audio(current.requestId, controller.signal);
      }
      if (status.state === "completed" && status.transcript !== null) {
        current.heard = true;
        return current.requestId;
      }
      pending.current = null;
      setError(status.failure?.detail ?? t("audio.failed"));
      return undefined;
    } catch (failure) {
      const feedback = errorFeedback(failure, { writing: true, fields: ["file"] });
      if (feedback.kind === "cancelled" || feedback.kind === "session") return undefined;
      if (feedback.kind === "forbidden") { onForbidden(); return undefined; }
      if (feedback.kind === "fields") { pending.current = null; setError(t("audio.invalid")); return undefined; }
      if (feedback.kind === "wait") onWait(feedback.retryAfterSeconds ?? 30);
      notify({ id: `assistant:${userId}:audio`, kind: feedback.kind === "uncertain" ? "warning" : "error",
        message: operationalErrorMessage(failure, t) });
      return undefined;
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setNormalizing(false);
    }
  }

  /// Leaving discards the recording: what it was normalizing stops, and nothing comes back from it.
  function cancel() {
    request.current?.abort();
    request.current = null;
    pending.current = null;
    setNormalizing(false);
    setError(undefined);
  }

  return { normalizing, error, clearError: () => setError(undefined), normalize, cancel };
}

/// The pause the server asks for between two reads of an operation (`pollingAfterSeconds`); leaving the page ends it.
export function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("The wait was aborted.", "AbortError"));
    }, { once: true });
  });
}
