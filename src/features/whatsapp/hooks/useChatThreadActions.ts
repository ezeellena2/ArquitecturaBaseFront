import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { changeMode, chatKey, reviewOutgoingById, type ChatMode, type Outgoing } from "../api/chat";

// Thread writes and their confirmations stay separate from message presentation and the read queries.
export function useChatThreadActions(id: string, refresh: () => Promise<unknown>) {
  const { t } = useTranslation("whatsapp");
  const client = useQueryClient();
  const active = useRef(false);
  const feedbackId = `whatsapp:action:${id}`;
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(feedbackId); }; }, [feedbackId]);
  const [mode, setMode] = useState<{ mode: ChatMode; revision: number }>();
  // H2: the review goes by the id of the send, so another operator who can send reviews it too.
  const [review, setReviewReference] = useState<Pick<Outgoing, "id">>();
  const setReview = useCallback((operation: Pick<Outgoing, "id"> | undefined) => setReviewReference(operation ? { id: operation.id } : undefined), []);
  function feedback(error: unknown, uncertain: "mode.uncertain" | "review.uncertain") {
    const result = errorFeedback(error, { writing: true });
    if (active.current && !["session", "cancelled"].includes(result.kind)) notify({ id: feedbackId, kind: "error", message: result.kind === "uncertain" ? t(uncertain) : result.detail ?? t("actionFailed") });
    if (active.current) void refresh();
  }
  // Each confirmation waits open with its progress until the answer (board LC1-A) and closes when it settles, also on a failure.
  // A success stays pending until the conversation is read again, so the closed dialog never uncovers the previous state.
  const changing = useMutation({ retry: false,
    mutationFn: (next: { mode: ChatMode; revision: number }) => changeMode(id, next.mode, next.revision),
    onSuccess: result => {
      if (active.current && result.mode === "Manual" && result.assistantSendInProgress) notify({ id: feedbackId, kind: "info", message: t("mode.manualSendInProgress") });
      return client.invalidateQueries({ queryKey: chatKey });
    }, onError: error => feedback(error, "mode.uncertain"), onSettled: () => setMode(undefined) });
  const reviewing = useMutation({ retry: false, mutationFn: (operation: Pick<Outgoing, "id">) => reviewOutgoingById(id, operation.id),
    onSuccess: () => client.invalidateQueries({ queryKey: chatKey }), onError: error => feedback(error, "review.uncertain"), onSettled: () => setReviewReference(undefined) });
  return { mode, setMode, review, setReview, changing, reviewing };
}
