import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import { assistantApi } from "../api/assistant";
import { assistantKey } from "../assistant/model";
import { wait } from "./useAssistantDictation";

/// Reads a photo or a PDF before its turn (Stage 3), like a recording: uploads it under its own request, saying how much went up,
/// follows the reading and returns that request once the server read it. The same file keeps its request: after an upload whose
/// outcome is unknown the retry uploads it again under it (the server recovers the same reading), once the server has it the retry
/// only asks for the reading, and a file already read is not asked for again. After a failed reading the next attempt uses another
/// request; a file the server did not take stays with its reason until it is removed or changed. A 429 starts Home's common wait.
export function useAssistantDocument({ userId, onForbidden, onWait }: {
  userId: string;
  onForbidden: () => void;
  onWait: (seconds: number, error: unknown) => void;
}) {
  const { t } = useTranslation(["assistant", "common"]);
  const client = useQueryClient();
  // Where the file is: going up, with how much went up (0 to 1), or being read.
  const [phase, setPhase] = useState<"uploading" | "reading">();
  const [progress, setProgress] = useState<number>();
  // Why the reading failed: the next attempt reads the same file again, under another request.
  const [error, setError] = useState<string>();
  // Why the server did not take the file (unreadable, or this person can no longer attach documents).
  const [fileError, setFileError] = useState<string>();
  const pending = useRef<{ file: File; requestId: string; uploaded: boolean; read: boolean } | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function read(file: File): Promise<string | undefined> {
    if (request.current) return undefined;
    if (pending.current?.file === file && pending.current.read) return pending.current.requestId;
    const controller = new AbortController();
    request.current = controller;
    if (pending.current?.file !== file) pending.current = { file, requestId: crypto.randomUUID(), uploaded: false, read: false };
    const current = pending.current;
    setPhase(current.uploaded ? "reading" : "uploading");
    setProgress(undefined);
    setError(undefined);
    setFileError(undefined);
    try {
      let status = current.uploaded
        ? await assistantApi.document(current.requestId, controller.signal)
        : await assistantApi.uploadDocument(current.requestId, file,
          (fraction) => { if (!controller.signal.aborted) setProgress(fraction); }, controller.signal);
      current.uploaded = true;
      setPhase("reading");
      while (status.state === "pending" || status.state === "running") {
        await wait(status.pollingAfterSeconds * 1000, controller.signal);
        status = await assistantApi.document(current.requestId, controller.signal);
      }
      if (status.state === "completed" && status.document) {
        current.read = true;
        return current.requestId;
      }
      pending.current = null;
      setError(status.failure?.detail ?? t("attachment.readingFailed"));
      return undefined;
    } catch (failure) {
      const feedback = errorFeedback(failure, { writing: true, fields: ["file"] });
      if (feedback.kind === "cancelled" || feedback.kind === "session") return undefined;
      if (feedback.kind === "wait") onWait(feedback.retryAfterSeconds ?? 30, failure);
      if (feedback.kind === "forbidden" && !(failure instanceof ApiError && failure.code === "Ai.Assistant.AttachmentDocumentForbidden")) {
        pending.current = null;
        onForbidden();
        return undefined;
      }
      if (current.uploaded) {
        // The server has the file: asking for its reading failed, so the request stays and the next send asks again. One the server
        // no longer knows goes up again under the same request.
        if (failure instanceof ApiError && failure.status === 404) current.uploaded = false;
        notify({ id: `assistant:${userId}:document`, kind: feedback.kind === "wait" ? "error" : "warning",
          message: feedback.kind === "wait" ? operationalErrorMessage(failure, t) : t("attachment.readingUnknown") });
        return undefined;
      }
      // Only an upload whose outcome is unknown keeps its request, so the retry recovers the same reading.
      if (feedback.kind !== "uncertain") pending.current = null;
      // Whoever lost the right to attach documents keeps Home: the remedy goes under the composer and the bootstrap hides the clip.
      if (feedback.kind === "forbidden") {
        setFileError(feedback.detail);
        void client.invalidateQueries({ queryKey: assistantKey(userId) });
        return undefined;
      }
      if (feedback.kind === "fields") {
        setFileError(feedback.fields.file?.join(" "));
        // An installation that stopped reading photos and PDF files: the bootstrap stops offering them.
        if (failure instanceof ApiError && failure.code === "Ai.Assistant.AttachmentDocumentUnavailable")
          void client.invalidateQueries({ queryKey: assistantKey(userId) });
        return undefined;
      }
      notify({ id: `assistant:${userId}:document`, kind: feedback.kind === "uncertain" ? "warning" : "error",
        message: feedback.kind === "uncertain" ? t("attachment.uploadUnknown") : operationalErrorMessage(failure, t) });
      return undefined;
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) {
        setPhase(undefined);
        setProgress(undefined);
      }
    }
  }

  /// Leaving discards the file: its upload or its reading stops, and nothing comes back from it.
  function cancel() {
    request.current?.abort();
    request.current = null;
    pending.current = null;
    setPhase(undefined);
    setProgress(undefined);
    setError(undefined);
    setFileError(undefined);
  }

  return {
    phase,
    progress,
    error,
    fileError,
    clear: () => {
      setError(undefined);
      setFileError(undefined);
    },
    read,
    cancel,
  };
}
