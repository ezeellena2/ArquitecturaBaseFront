import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Button } from "@/shared/ui/button";
import { PrivateAudio } from "@/shared/ui/PrivateAudio";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchChatAudio, type ChatAudio as Audio } from "../api/audio";
export function ChatAudio({ owner, contactId, messageId, audio, body, onForbidden, preserveViewport }: {
 owner: string; contactId: string; messageId: string; audio: Audio; body: string | null; onForbidden: () => void; preserveViewport: (change: () => void) => void;
}) {
 const { t } = useTranslation("whatsapp");
 const scope = JSON.stringify([owner, contactId, messageId, audio.canPlay]);
 const active = useRef<string | undefined>(undefined); const request = useRef<AbortController | null>(null);
 const [playback, setPlayback] = useState<{ scope: string; blob: Blob }>();
 const [loadingScope, setLoadingScope] = useState<string>(); const loading = loadingScope === scope;
 const cooldown = useCountdown(0); const [denied, setDenied] = useState(false);
 const feedbackId = "whatsapp:audio:" + owner + ":" + messageId;
 useLayoutEffect(() => { active.current = scope; return () => { active.current = undefined; request.current?.abort(); request.current = null; dismissNotification(feedbackId); }; }, [scope, feedbackId]);
 const owns = (signal: AbortSignal) => active.current === scope && !signal.aborted;
 async function listen() {
  if (!audio.canPlay || loading || denied || cooldown.isRunning || request.current || active.current !== scope) return;
  const controller = new AbortController(); request.current = controller; setLoadingScope(scope); dismissNotification(feedbackId);
  try {
   const blob = await fetchChatAudio(contactId, messageId, controller.signal);
   if (!owns(controller.signal)) return;
   dismissNotification(feedbackId); preserveViewport(() => setPlayback({ scope, blob }));
  } catch (error) {
   if (!owns(controller.signal)) return;
   if (error instanceof ApiError && error.status === 403) { setDenied(true); onForbidden(); return; }
   if (error instanceof ApiError && error.status === 429) cooldown.restart(error.retryAfterSeconds ?? 60);
   if (!["session", "cancelled"].includes(errorFeedback(error).kind)) notify({ id: feedbackId, kind: "error", message: readErrorMessage(error, t) });
  } finally { if (request.current === controller) request.current = null; if (owns(controller.signal)) setLoadingScope(undefined); }
 }
 if (denied) return null;
 if (playback && playback.scope !== scope) setPlayback(undefined);
 const blob = audio.canPlay && playback?.scope === scope ? playback.blob : undefined;
 return <section className="min-w-0 space-y-2" aria-label={t("kind.Audio")}>
  {blob ? <PrivateAudio blob={blob} label={t("audio.received")} playOnLoad/> : audio.canPlay ? <Button size="sm" variant="outline" disabled={loading || cooldown.isRunning} onClick={() => void listen()}>{t(loading ? "audio.loading" : "audio.listen")}</Button> : null}
  {cooldown.isRunning ? <p className="text-xs text-[var(--color-content-muted)]">{t("audio.waiting", { seconds: cooldown.seconds })}</p> : null}
  {audio.state === "Completed" && body !== null ? <div className="border-t border-[var(--color-border)] pt-2"><p className="text-xs font-medium text-[var(--color-content-muted)]">{t("audio.transcription")}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{body}</p></div> : <p className="text-sm text-[var(--color-content-muted)]">{t(audio.state === "Pending" || audio.state === "Transcribing" ? "audio.transcribing" : audio.state === "Expired" ? "audio.expired" : audio.state === "Unavailable" && !audio.canPlay ? "audio.unavailable" : audio.canPlay ? "audio.failed" : "audio.noTranscript")}</p>}
 </section>;
}
