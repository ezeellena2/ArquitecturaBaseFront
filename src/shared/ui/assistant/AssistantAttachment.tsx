import type { Ref, RefObject } from "react";
import { IconButton } from "../IconButton";
import { CloseIcon, FileIcon, PaperclipIcon } from "../icons";

/// The clip (IA4): left of the microphone, it opens the browser's picker for one file of the accepted types. The owner keeps the
/// input to open the picker from elsewhere too (a Home suggestion that attaches), checks the chosen file and says what failed.
export function AssistantAttach({ label, accept, inputRef, buttonRef, onChoose, disabled = false, showButton = true }: {
  label: string;
  /// The types the picker offers (`.xlsx,.csv`, and `.pdf,.jpg,.jpeg,.png,.docx` when the owner takes documents): the server reads
  /// the kind from the bytes, never from this.
  accept: string;
  inputRef: RefObject<HTMLInputElement | null>;
  /// The clip, for the owner to give it back the focus when the X goes with the file.
  buttonRef?: Ref<HTMLButtonElement>;
  onChoose: (file: File) => void;
  disabled?: boolean;
  /// One file per message: with one already chosen the clip hides, and the picker still opens from its owner.
  showButton?: boolean;
}) {
  return (
    <>
      <input ref={inputRef} type="file" accept={accept} hidden tabIndex={-1} data-slot="assistant-file-input"
        onChange={event => {
          const file = event.target.files?.[0];
          // The picker forgets the choice, so the same file can be chosen again after removing it.
          event.target.value = "";
          if (file) onChoose(file);
        }} />
      {showButton ? (
        <IconButton ref={buttonRef} label={label} className="assistant-attach" type="button" disabled={disabled}
          onClick={() => inputRef.current?.click()}>
          <PaperclipIcon />
        </IconButton>
      ) : null}
    </>
  );
}

/// A file in the composer, about to be sent, or in a message (IA1-A): its name and what describes it, which its owner writes (the
/// type, the rows, the size). In the composer it is removed with the X, which turns off while the file travels.
export function AssistantFile({ name, description, removeLabel, removeRef, onRemove, disabled = false }: {
  name: string;
  description: string;
  removeLabel?: string;
  /// The X, for the owner to move the focus to it when the clip hides with the file chosen.
  removeRef?: Ref<HTMLButtonElement>;
  onRemove?: () => void;
  disabled?: boolean;
}) {
  return (
    <div data-slot="assistant-file" className="assistant-file">
      <FileIcon className="assistant-file-icon" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{name}</p>
        <p className="text-xs text-[var(--color-content-muted)]">{description}</p>
      </div>
      {onRemove && removeLabel ? (
        <IconButton ref={removeRef} label={removeLabel} type="button" className="assistant-file-remove" disabled={disabled}
          onClick={onRemove}>
          <CloseIcon />
        </IconButton>
      ) : null}
    </div>
  );
}
