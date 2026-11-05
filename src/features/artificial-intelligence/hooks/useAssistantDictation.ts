import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import { assistantApi } from "../api/assistant";

/// Normalizes a recording before its turn (IA4): uploads it under its own request, follows the normalization and returns that
/// request once the server heard it. The same recording keeps its request, so a retry never uploads it again; after a failed
/// normalization the next attempt uses another one.
export function useAssistantDictation({ userId, onForbidden }: { userId: string; onForbidden: () => void }) {
  const { t } = useTranslation(["assistant", "common"]);
  const [normalizing, setNormalizing] = useState(false);
  const [error, setError] = useState<string>();
  const pending = useRef<{ recording: Blob; requestId: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function normalize(recording: Blob): Promise<string | undefined> {
    if (request.current) return undefined;
    const controller = new AbortController();
    request.current = controller;
    setNormalizing(true);
    setError(undefined);
    if (pending.current?.recording !== recording) pending.current = { recording, requestId: crypto.randomUUID() };
    const { requestId } = pending.current;
    try {
      let status = await assistantApi.uploadAudio(requestId, recording, controller.signal);
      while (status.state === "pending" || status.state === "running") {
        await wait(status.pollingAfterSeconds * 1000, controller.signal);
        status = await assistantApi.audio(requestId, controller.signal);
      }
      if (status.state === "completed" && status.transcript !== null) return requestId;
      pending.current = null;
      setError(status.failure?.detail ?? t("audio.failed"));
      return undefined;
    } catch (failure) {
      const feedback = errorFeedback(failure, { writing: true, fields: ["file"] });
      if (feedback.kind === "cancelled" || feedback.kind === "session") return undefined;
      if (feedback.kind === "forbidden") { onForbidden(); return undefined; }
      if (feedback.kind === "fields") { pending.current = null; setError(t("audio.invalid")); return undefined; }
      notify({ id: `assistant:${userId}:audio`, kind: feedback.kind === "uncertain" ? "warning" : "error",
        message: operationalErrorMessage(failure, t) });
      return undefined;
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setNormalizing(false);
    }
  }

  return { normalizing, error, clearError: () => setError(undefined), normalize };
}

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("The wait was aborted.", "AbortError"));
    }, { once: true });
  });
}
