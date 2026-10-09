import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import { changeMode, chatKey, reviewOutgoing, type ChatMode, type Outgoing } from "../api/chat";

// Thread writes and their confirmations stay separate from message presentation and the read queries.
export function useChatThreadActions(id: string, refresh: () => Promise<unknown>) {
  const { t } = useTranslation("whatsapp");
  const client = useQueryClient();
  const [mode, setMode] = useState<{ mode: ChatMode; revision: number }>();
  const [review, setReview] = useState<Outgoing>();
  function feedback(error: unknown, uncertain: "mode.uncertain" | "review.uncertain") {
    const result = errorFeedback(error, { writing: true });
    if (result.kind !== "session") notify({ id: `whatsapp:action:${id}`, kind: "error", message: result.kind === "uncertain" ? t(uncertain) : result.detail ?? t("actionFailed") });
    void refresh();
  }
  const changing = useMutation({ retry: false,
    mutationFn: (next: { mode: ChatMode; revision: number }) => changeMode(id, next.mode, next.revision),
    onSuccess: () => { void client.invalidateQueries({ queryKey: chatKey }); }, onError: error => feedback(error, "mode.uncertain") });
  const reviewing = useMutation({ retry: false, mutationFn: (operation: Outgoing) => reviewOutgoing(id, operation.requestId),
    onSuccess: () => { void client.invalidateQueries({ queryKey: chatKey }); }, onError: error => feedback(error, "review.uncertain") });
  return { mode, setMode, review, setReview, changing, reviewing };
}
