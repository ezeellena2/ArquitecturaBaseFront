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
export function useAssistantTurnActions({
  userId,
  onAccepted,
  onForbidden,
}: {
  userId: string;
  onAccepted: (value: AssistantAccepted) => void;
  onForbidden: () => void;
}) {
  const { t } = useTranslation(["assistant", "common"]);
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const frozen = useRef<AssistantSubmit | null>(null);
  const working = useRef(false);
  const mounted = useRef(true);
  const generation = useRef(0);
  const cooldown = useCountdown(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      frozen.current = null;
      working.current = false;
      dismissNotification(`assistant:${userId}:acceptance`);
      dismissNotification(`assistant:${userId}:action`);
    };
  }, [userId]);
  function isCurrent(version: number) {
    return mounted.current && generation.current === version;
  }
  function accept(value: AssistantAccepted, version: number) {
    if (!isCurrent(version)) return;
    frozen.current = null;
    setUncertain(false);
    onAccepted(value);
    void client.invalidateQueries({
      queryKey: [...assistantKey(userId), "conversations"],
    });
  }
  function handle(error: unknown, version: number, acceptance = true) {
    if (!isCurrent(version)) return;
    const feedback = errorFeedback(error, {
      writing: true,
      fields: ["question"],
    });
    if (feedback.kind === "fields") {
      setFieldError(feedback.fields.question?.join(" "));
      frozen.current = null;
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
      cooldown.restart(feedback.retryAfterSeconds ?? 30);
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
  async function send(body: AssistantSubmit) {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
    setFieldError(undefined);
    const version = generation.current;
    try {
      const response = await assistantApi.submit(body);
      if (!isCurrent(version)) return false;
      accept(response, version);
      return true;
    } catch (error) {
      handle(error, version);
      return false;
    } finally {
      if (isCurrent(version)) {
        working.current = false;
        setBusy(false);
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
  ) {
    if (working.current || frozen.current || cooldown.isRunning) return false;
    frozen.current = createSubmission(
      crypto.randomUUID(),
      question,
      connectionRevision,
      conversation,
    );
    return send(frozen.current);
  }
  async function recover() {
    if (!frozen.current || working.current) return;
    working.current = true;
    setBusy(true);
    const version = generation.current;
    try {
      accept(await assistantApi.turn(frozen.current.requestId), version);
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
        working.current = false;
        setBusy(false);
      }
    }
  }
  async function retryIdentical() {
    if (frozen.current && !working.current && !cooldown.isRunning)
      return send(frozen.current);
    return false;
  }
  async function cancel(requestId: string) {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
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
        working.current = false;
        setBusy(false);
      }
    }
  }
  async function remove(conversationId: string) {
    if (working.current) return false;
    working.current = true;
    setBusy(true);
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
        working.current = false;
        setBusy(false);
      }
    }
  }
  return {
    busy,
    uncertain,
    fieldError,
    cooldownSeconds: cooldown.seconds,
    submit,
    recover,
    retryIdentical,
    cancel,
    remove,
  };
}
