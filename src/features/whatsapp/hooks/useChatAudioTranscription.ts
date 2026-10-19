import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { requestAudioTranscription } from "../api/audio";
import type { ChatMessage } from "../api/chat";
export function useChatAudioTranscription({ owner, contactId, enabled, messages, onForbidden }: {
 owner: string; contactId: string; enabled: boolean; messages: readonly ChatMessage[]; onForbidden: () => void;
}) {
 const { t } = useTranslation("whatsapp");
 const scope = JSON.stringify([owner, contactId]);
 const active = useRef<string | undefined>(undefined); const attempts = useRef(new Map<string, AbortController>());
 useLayoutEffect(() => { const requests = attempts.current; active.current = scope; return () => { active.current = undefined; for (const [id, controller] of requests) { controller.abort(); dismissNotification("whatsapp:transcription:" + owner + ":" + id); } requests.clear(); }; }, [scope, owner]);
 const fail = useEffectEvent((error: unknown, messageId: string) => {
  if (error instanceof ApiError && error.status === 403) { onForbidden(); return; }
  if (!["session", "cancelled"].includes(errorFeedback(error).kind)) notify({ id: "whatsapp:transcription:" + owner + ":" + messageId, kind: "error", message: readErrorMessage(error, t) });
 });
 useEffect(() => {
  if (active.current !== scope) return;
  if (!enabled) {
   // A paused read does not prove an uncertain POST was rejected. Keep its identity until the owner leaves.
   for (const [id, controller] of attempts.current) { controller.abort(); dismissNotification("whatsapp:transcription:" + owner + ":" + id); }
   return;
  }
  for (const message of messages) {
   if (message.kind !== "Audio") continue;
   if (message.audio?.state !== "Pending") { attempts.current.get(message.id)?.abort(); dismissNotification("whatsapp:transcription:" + owner + ":" + message.id); continue; }
   if (attempts.current.has(message.id)) continue;
   const controller = new AbortController(); attempts.current.set(message.id, controller);
   // The thread's existing poll observes completion for all audios in one read.
   void requestAudioTranscription(contactId, message.id, controller.signal).catch((error: unknown) => {
    if (active.current !== scope || controller.signal.aborted) return;
    fail(error, message.id);
   });
  }
 }, [scope, enabled, messages, contactId, owner]);
}
