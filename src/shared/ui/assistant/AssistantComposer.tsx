import { ComposerPrimitive, useAui } from "@assistant-ui/react";
import { useEffect, useId, type ReactNode } from "react";
import { IconButton } from "../IconButton";
import { ArrowUpIcon, MicIcon } from "../icons";

export function AssistantComposer({ label, hint, placeholder, sendLabel, sending = false, value, onValueChange, disabled, error,
  record, recorder, onSendRecording }: {
  label: string;
  hint: string;
  placeholder: string;
  /// While the question is on its way it says so («Enviando…»).
  sendLabel: string;
  /// The question is on its way: the spinner takes the place of the arrow.
  sending?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  disabled: boolean;
  error?: string;
  /// IA4: the microphone, left of the arrow, when the owner takes a recording.
  record?: { label: string; onStart: () => void };
  /// The recording going on or ready to send, above the text.
  recorder?: ReactNode;
  /// With a recording ready, the arrow (and Ctrl/Meta+Enter) send it with the text, if any, through the owner.
  onSendRecording?: () => void;
}) {
  const aui = useAui();
  const id = useId();
  useEffect(() => aui.composer().setText(value), [aui, value]);
  const send = (
    <IconButton label={sendLabel} className="assistant-send" type={onSendRecording ? "button" : "submit"} pending={sending}
      disabled={disabled || (!onSendRecording && !value.trim())} onClick={onSendRecording}>
      <ArrowUpIcon />
    </IconButton>
  );
  return (
    <div>
      <ComposerPrimitive.Root data-slot="assistant-composer" className="assistant-composer" data-invalid={!!error}>
        {recorder}
        <ComposerPrimitive.Input aria-label={label} aria-describedby={id + "-hint" + (error ? " " + id + "-error" : "")}
          aria-invalid={!!error} className="assistant-input" placeholder={placeholder} autoComplete="off"
          submitMode={onSendRecording ? "none" : "ctrlEnter"} cancelOnEscape={false} unstable_focusOnRunStart={false}
          unstable_focusOnScrollToBottom={false} unstable_focusOnThreadSwitched={false} addAttachmentOnPaste={false}
          disabled={disabled} onChange={event => onValueChange(event.target.value)}
          onKeyDown={onSendRecording ? event => {
            if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (!disabled) onSendRecording();
          } : undefined} />
        <div className="assistant-composer-actions">
          {record ? (
            <IconButton label={record.label} className="assistant-record" type="button" disabled={disabled} onClick={record.onStart}>
              <MicIcon />
            </IconButton>
          ) : null}
          {onSendRecording ? send : <ComposerPrimitive.Send asChild>{send}</ComposerPrimitive.Send>}
        </div>
      </ComposerPrimitive.Root>
      <p id={id + "-hint"} className="sr-only">{hint}</p>
      {error ? <p id={id + "-error"} className="mt-2 text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
