import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { Button } from "@/shared/ui/button";
import { PrivateAudio } from "@/shared/ui/PrivateAudio";
import { notify } from "@/shared/ui/notifications";
import { assistantApi } from "../../api/assistant";

/// A dictated turn in the thread (IA4): the recording, heard only when asked for, and below it, in gray, what the server
/// heard in it, which is what the assistant read.
export function AssistantTurnAudio({ requestId, transcript }: { requestId: string; transcript: string }) {
  const { t } = useTranslation(["assistant", "common"]);
  const [recording, setRecording] = useState<Blob>();
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function listen() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const blob = await assistantApi.audioFile(requestId, controller.signal);
      if (!controller.signal.aborted) setRecording(blob);
    } catch (error) {
      if (controller.signal.aborted || ["session", "cancelled"].includes(errorFeedback(error).kind)) return;
      notify({ id: `assistant:audio:${requestId}`, kind: "error",
        message: error instanceof ApiError && [404, 410].includes(error.status) ? t("audio.gone") : readErrorMessage(error, t) });
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setLoading(false);
    }
  }
  return (
    <div className="assistant-turn-audio">
      {recording ? <PrivateAudio blob={recording} label={t("audio.recording")} playOnLoad />
        : <Button type="button" size="sm" variant="outline" pending={loading} onClick={() => void listen()}>{t(loading ? "audio.loading" : "audio.listen")}</Button>}
      <p className="assistant-transcript">{transcript}</p>
    </div>
  );
}
