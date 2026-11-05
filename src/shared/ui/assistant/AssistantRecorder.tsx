import { useEffect, useRef } from "react";
import { Button } from "../button";
import { PrivateAudio } from "../PrivateAudio";

/// The recording in the composer (IA4). While recording, the elapsed time with «Descartar» and «Detener»; once stopped, the
/// recording to listen to before sending, with «Descartar». The owner records, uploads and says what failed.
export function AssistantRecorder({ recording, status, audioLabel, discardLabel, stopLabel, onDiscard, onStop, disabled = false,
  takeFocus = true }: {
  /// The stopped recording; without it, the recording is still going.
  recording?: Blob;
  /// While recording: «Grabando · 0:12».
  status: string;
  audioLabel: string;
  discardLabel: string;
  stopLabel: string;
  onDiscard: () => void;
  onStop: () => void;
  /// While it travels, it can no longer be discarded.
  disabled?: boolean;
  /// The control that started or stopped it is gone, so the focus moves to «Detener» or to the recording; a catalog that only
  /// shows the piece turns it off.
  takeFocus?: boolean;
}) {
  const stop = useRef<HTMLButtonElement>(null);
  const audio = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!takeFocus) return;
    if (recording) audio.current?.querySelector("audio")?.focus();
    else stop.current?.focus();
  }, [recording, takeFocus]);
  return (
    <div data-slot="assistant-recorder" className="assistant-recorder">
      {recording ? <div ref={audio} className="contents"><PrivateAudio blob={recording} label={audioLabel} /></div>
        // A timer is not announced on every second; it is read when the person goes to it.
        : <p role="timer" className="assistant-recording"><span aria-hidden="true" className="assistant-recording-dot" />{status}</p>}
      <div className="assistant-recorder-actions">
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={onDiscard}>{discardLabel}</Button>
        {recording ? null : <Button ref={stop} type="button" size="sm" variant="outline" onClick={onStop}>{stopLabel}</Button>}
      </div>
    </div>
  );
}
