import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import {
  errorFeedback,
  operationalErrorMessage,
} from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { useCountdown } from "@/shared/hooks/useCountdown";
import {
  assistantApi,
  type AssistantAccepted,
  type AssistantSubmit,
  type AssistantTurn,
  type AssistantConversationSummary,
} from "../api/assistant";
import type { PagedResult } from "@/shared/api/pagedResult";
import { assistantKey, createSubmission } from "../assistant/model";
/// The request on its way and what it acts on (the turn it cancels, the conversation it deletes): only the control that
/// sent it shows the spinner and its gerund.
export type AssistantAction = "submit" | "retry" | "recover" | "cancel" | "remove";
/// The frozen request: its body and, in a turn with a spreadsheet or a Word, the same file, so repeating it recovers the same turn.
/// The turn of a photo or a PDF names its reading in the body, and a dictated one its recording.
export interface AssistantSubmission { readonly body: AssistantSubmit; readonly file?: File }
/// The daily quota (of questions, or of readings) counts by UTC day and renews at 00:00 UTC: its 429 brings in `retryAfter` the
/// seconds until then, so the instant it renews is now plus those seconds. Any other wait has no hour to say.
function quotaRenewal(error: unknown, seconds: number) {
  return error instanceof ApiError && error.code === "Ai.Assistant.QuotaExceeded" && error.retryAfterSeconds !== undefined
    ? new Date(Date.now() + seconds * 1000).toISOString() : undefined;
}
export function useAssistantTurnActions({
  userId,
  onAccepted,
  onForbidden,
}: {
  userId: string;
  /// The accepted turn and the submission it was, also when «Consultar estado» or «Repetir el mismo pedido» confirmed it: the owner
  /// clears what that turn took.
  onAccepted: (value: AssistantAccepted, submission: AssistantSubmission) => void;
  onForbidden: () => void;
}) {
  const { t } = useTranslation(["assistant", "common"]);
  const client = useQueryClient();
  const [working, setWorking] = useState<{ action: AssistantAction; target?: string }>();
  const [uncertain, setUncertain] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  // Why the server did not take the file (unreadable, or this person can no longer attach): it stays under the composer
  // with the file, until the person removes or changes it.
  const [fileError, setFileError] = useState<string>();
  // How much of a file went up, from 0 to 1, while it travels.
  const [progress, setProgress] = useState<number>();
  const frozen = useRef<AssistantSubmission | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const cooldown = useCountdown(0);
  const [renewsAtUtc, setRenewsAtUtc] = useState<string>();
  function wait(seconds: number, error?: unknown) {
    cooldown.restart(seconds);
    setRenewsAtUtc(quotaRenewal(error, seconds));
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      frozen.current = null;
      inFlight.current = false;
      dismissNotification(`assistant:${userId}:acceptance`);
      dismissNotification(`assistant:${userId}:action`);
    };
  }, [userId]);
  function isCurrent(version: number) {
    return mounted.current && generation.current === version;
  }
  function accept(value: AssistantAccepted, version: number, submission: AssistantSubmission) {
    if (!isCurrent(version)) return;
    frozen.current = null;
    setUncertain(false);
    onAccepted(value, submission);
    void client.invalidateQueries({
      queryKey: [...assistantKey(userId), "conversations"],
    });
  }
  function handle(error: unknown, version: number, acceptance = true) {
    if (!isCurrent(version)) return;
    const feedback = errorFeedback(error, {
      writing: true,
      fields: ["question", "file"],
    });
    if (feedback.kind === "fields") {
      setFieldError(feedback.fields.question?.join(" "));
      setFileError(feedback.fields.file?.join(" "));
      frozen.current = null;
      return;
    }
    // Whoever lost the right to attach keeps Home: the remedy goes under the composer and the bootstrap hides the clip. A spreadsheet
    // (Stage 2) and a document (Stage 3) each have their code.
    if (error instanceof ApiError && error.status === 403
      && ["Ai.Assistant.AttachmentForbidden", "Ai.Assistant.AttachmentDocumentForbidden"].includes(error.code ?? "")) {
      setFileError(error.detail);
      frozen.current = null;
      void client.invalidateQueries({ queryKey: assistantKey(userId) });
      return;
    }
    if (feedback.kind === "session") return;
    if (feedback.kind === "forbidden") {
      frozen.current = null;
      client.removeQueries({ queryKey: assistantKey(userId) });
      onForbidden();
      return;
    }
    if (feedback.kind === "uncertain") {
      if (!acceptance) {
        notify({
          id: `assistant:${userId}:action`,
          kind: "warning",
          message: operationalErrorMessage(error, t),
        });
        void client.invalidateQueries({ queryKey: assistantKey(userId) });
        return;
      }
      setUncertain(true);
      notify({
        id: `assistant:${userId}:acceptance`,
        kind: "warning",
        message: t("acceptanceUncertain"),
        action: {
          label: t("checkStatus"),
          onClick: () => {
            if (isCurrent(version)) void recover();
          },
        },
      });
      return;
    }
    if (feedback.kind === "wait") {
      wait(feedback.retryAfterSeconds ?? 30, error);
      frozen.current = null;
    } else if (error instanceof ApiError && error.status === 409) {
      if (
        [
          "Ai.Assistant.RevisionConflict",
          "Ai.Assistant.ConnectionChanged",
          "Ai.Assistant.ActiveTurn",
          "Ai.Assistant.Unavailable",
        ].includes(error.code ?? "")
      ) {
        frozen.current = null;
        setUncertain(false);
        void client.invalidateQueries({ queryKey: assistantKey(userId) });
      } else if (acceptance) setUncertain(true);
    } else frozen.current = null;
    notify({
      id: `assistant:${userId}:action`,
      kind: "error",
      message: operationalErrorMessage(error, t),
    });
  }
  async function send(submission: AssistantSubmission, action: "submit" | "retry") {
    if (inFlight.current) return false;
    inFlight.current = true;
    setWorking({ action });
    setFieldError(undefined);
    setFileError(undefined);
    const version = generation.current;
    try {
      const { body, file } = submission;
      const response = file
        ? await assistantApi.submitFile(body, file, (fraction) => { if (isCurrent(version)) setProgress(fraction); })
        : await assistantApi.submit(body);
      if (!isCurrent(version)) return false;
      accept(response, version, submission);
      return true;
    } catch (error) {
      handle(error, version);
      return false;
    } finally {
      if (isCurrent(version)) {
        inFlight.current = false;
        setWorking(undefined);
        setProgress(undefined);
      }
    }
  }
  async function submit(
    question: string,
    connectionRevision: number,
    conversation?: {
      id: string;
      revision: number;
    },
    audioRequestId?: string,
    file?: File,
    documentRequestId?: string,
  ) {
    if (inFlight.current || frozen.current || cooldown.isRunning) return false;
    frozen.current = {
      body: createSubmission(crypto.randomUUID(), question, connectionRevision, conversation, audioRequestId, documentRequestId),
      ...(file ? { file } : {}),
    };
    return send(frozen.current, "submit");
  }
  async function recover() {
    if (!frozen.current || inFlight.current) return;
    inFlight.current = true;
    setWorking({ action: "recover" });
    const version = generation.current;
    const submission = frozen.current;
    try {
      accept(await assistantApi.turn(submission.body.requestId), version, submission);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        if (isCurrent(version))
          notify({
            id: `assistant:${userId}:acceptance`,
            kind: "warning",
            message: t("acceptanceMissing"),
          });
      } else handle(error, version);
    } finally {
      if (isCurrent(version)) {
        inFlight.current = false;
        setWorking(undefined);
      }
    }
  }
  async function retryIdentical() {
    if (frozen.current && !inFlight.current && !cooldown.isRunning)
      return send(frozen.current, "retry");
    return false;
  }
  async function cancel(requestId: string) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setWorking({ action: "cancel", target: requestId });
    const version = generation.current;
    try {
      const turn = await assistantApi.cancel(requestId);
      if (!isCurrent(version)) return false;
      client.setQueriesData(
        { queryKey: [...assistantKey(userId), "turn", requestId] },
        turn,
      );
      await client.invalidateQueries({ queryKey: assistantKey(userId) });
      return isCurrent(version);
    } catch (error) {
      handle(error, version, false);
      return false;
    } finally {
      if (isCurrent(version)) {
        inFlight.current = false;
        setWorking(undefined);
      }
    }
  }
  async function remove(conversationId: string) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setWorking({ action: "remove", target: conversationId });
    const version = generation.current;
    try {
      await assistantApi.remove(conversationId);
      if (!isCurrent(version)) return false;
      client.removeQueries({
        queryKey: [...assistantKey(userId), "conversation", conversationId],
      });
      client.removeQueries({
        queryKey: [...assistantKey(userId), "turns", conversationId],
      });
      client.removeQueries({ predicate: query => {
        if (query.queryKey[0] !== "assistant" || query.queryKey[1] !== userId || query.queryKey[2] !== "turn") return false;
        return (query.state.data as AssistantTurn | undefined)?.conversationId === conversationId;
      } });
      client.setQueriesData<PagedResult<AssistantConversationSummary>>(
        { queryKey: [...assistantKey(userId), "conversations"] },
        page => page ? { ...page, items: page.items.filter(item => item.conversationId !== conversationId) } : page,
      );
      void client.invalidateQueries({
        queryKey: [...assistantKey(userId), "conversations"],
      });
      return true;
    } catch (error) {
      handle(error, version, false);
      return false;
    } finally {
      if (isCurrent(version)) {
        inFlight.current = false;
        setWorking(undefined);
      }
    }
  }
  return {
    busy: working !== undefined,
    working,
    uncertain,
    fieldError,
    fileError,
    clearFileError: () => setFileError(undefined),
    progress,
    cooldownSeconds: cooldown.seconds,
    /// While the wait is the daily quota's, the instant it renews (UTC), for Home to say its hour instead of the seconds.
    quotaRenewsAtUtc: cooldown.isRunning ? renewsAtUtc : undefined,
    /// The common wait of Home, for a 429 on a request another hook made (the upload of a recording or of a document): the arrow is
    /// off and says how long, as after a turn's own 429; with that 429, a quota's wait says when it renews.
    startCooldown: (seconds: number, error?: unknown) => wait(seconds, error),
    submit,
    recover,
    retryIdentical,
    cancel,
    remove,
  };
}
