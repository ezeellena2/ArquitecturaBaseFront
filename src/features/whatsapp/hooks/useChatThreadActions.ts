import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { changeMode, chatKey, reviewOutgoing, type ChatMode, type Outgoing } from "../api/chat";

// Thread writes and their confirmations stay separate from message presentation and the read queries.
export function useChatThreadActions(id: string, refresh: () => Promise<unknown>) {
  const { t } = useTranslation("whatsapp");
  const client = useQueryClient();
  const active = useRef(false);
  const feedbackId = `whatsapp:action:${id}`;
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(feedbackId); }; }, [feedbackId]);
  const [mode, setMode] = useState<{ mode: ChatMode; revision: number }>();
  const [review, setReviewReference] = useState<Pick<Outgoing, "requestId">>();
  const setReview = (operation: Pick<Outgoing, "requestId"> | undefined) => setReviewReference(operation ? { requestId: operation.requestId } : undefined);
  function feedback(error: unknown, uncertain: "mode.uncertain" | "review.uncertain") {
    const result = errorFeedback(error, { writing: true });
    if (active.current && !["session", "cancelled"].includes(result.kind)) notify({ id: feedbackId, kind: "error", message: result.kind === "uncertain" ? t(uncertain) : result.detail ?? t("actionFailed") });
    if (active.current) void refresh();
  }
  const changing = useMutation({ retry: false,
    mutationFn: (next: { mode: ChatMode; revision: number }) => changeMode(id, next.mode, next.revision),
    onSuccess: result => {
      void client.invalidateQueries({ queryKey: chatKey });
      if (active.current && result.mode === "Manual" && result.assistantSendInProgress) notify({ id: feedbackId, kind: "info", message: t("mode.manualSendInProgress") });
    }, onError: error => feedback(error, "mode.uncertain") });
  const reviewing = useMutation({ retry: false, mutationFn: (operation: Pick<Outgoing, "requestId">) => reviewOutgoing(id, operation.requestId),
    onSuccess: () => { void client.invalidateQueries({ queryKey: chatKey }); }, onError: error => feedback(error, "review.uncertain") });
  return { mode, setMode, review, setReview, changing, reviewing };
}
