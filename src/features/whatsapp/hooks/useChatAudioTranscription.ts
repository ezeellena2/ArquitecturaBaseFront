import { useEffect, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { requestAudioTranscription } from "../api/audio";
import type { ChatMessage } from "../api/chat";
export function useChatAudioTranscription({ owner, contactId, enabled, messages, onChanged, onForbidden }: {
 owner: string; contactId: string; enabled: boolean; messages: readonly ChatMessage[]; onChanged: () => void; onForbidden: () => void;
}) {
 const { t } = useTranslation("whatsapp");
 const scope = JSON.stringify([owner, contactId, enabled]);
 const active = useRef<string | undefined>(undefined); const attempts = useRef(new Map<string, AbortController>());
 useLayoutEffect(() => { const requests = attempts.current; active.current = scope; return () => { active.current = undefined; for (const [id, controller] of requests) { controller.abort(); dismissNotification("whatsapp:transcription:" + owner + ":" + id); } requests.clear(); }; }, [scope, owner]);
 useEffect(() => {
  if (!enabled || active.current !== scope) return;
  for (const message of messages) {
   if (message.kind !== "Audio") continue;
   if (message.audio?.state !== "Pending") { attempts.current.get(message.id)?.abort(); dismissNotification("whatsapp:transcription:" + owner + ":" + message.id); continue; }
   if (attempts.current.has(message.id)) continue;
   const controller = new AbortController(); attempts.current.set(message.id, controller);
   void requestAudioTranscription(contactId, message.id, controller.signal).then(() => {
    if (active.current === scope && !controller.signal.aborted) onChanged();
   }).catch((error: unknown) => {
    if (active.current !== scope || controller.signal.aborted) return;
    if (error instanceof ApiError && error.status === 403) { onForbidden(); return; }
    if (!["session", "cancelled"].includes(errorFeedback(error).kind)) notify({ id: "whatsapp:transcription:" + owner + ":" + message.id, kind: "error", message: readErrorMessage(error, t) });
   });
  }
 }, [scope, enabled, messages, contactId, onChanged, onForbidden, owner, t]);
}
