import { ComposerPrimitive, useAui } from "@assistant-ui/react";
import { useEffect, useId } from "react";
import { IconButton } from "../IconButton";
import { ArrowUpIcon } from "../icons";

export function AssistantComposer({ label, hint, placeholder, sendLabel, sending = false, value, onValueChange, disabled, error }: {
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
}) {
  const aui = useAui();
  const id = useId();
  useEffect(() => aui.composer().setText(value), [aui, value]);
  return (
    <div>
      <ComposerPrimitive.Root data-slot="assistant-composer" className="assistant-composer" data-invalid={!!error}>
        <ComposerPrimitive.Input aria-label={label} aria-describedby={id + "-hint" + (error ? " " + id + "-error" : "")}
          aria-invalid={!!error} className="assistant-input" placeholder={placeholder} autoComplete="off"
          submitMode="ctrlEnter" cancelOnEscape={false} unstable_focusOnRunStart={false}
          unstable_focusOnScrollToBottom={false} unstable_focusOnThreadSwitched={false} addAttachmentOnPaste={false}
          disabled={disabled} onChange={event => onValueChange(event.target.value)} />
        <div className="assistant-composer-actions">
          <ComposerPrimitive.Send asChild>
            <IconButton label={sendLabel} className="assistant-send" type="submit" pending={sending} disabled={disabled || !value.trim()}>
              <ArrowUpIcon />
            </IconButton>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
      <p id={id + "-hint"} className="sr-only">{hint}</p>
      {error ? <p id={id + "-error"} className="mt-2 text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
