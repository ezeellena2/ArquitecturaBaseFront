import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconButton } from "@/shared/ui/IconButton";
import { CheckIcon, CloseIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { folderNameMaxLength } from "../api/folders";

/// The name of a folder written in its own row of the tree (CP3-A), to add one or rename it: Enter saves, Escape cancels and
/// the error goes right under it. A row of a tree has no room for a label above, so the field is named by its `aria-label`,
/// like the inline cells of a catalog.
export function FolderNameEditor({ label, initial = "", pending, error, onSubmit, onCancel }: {
  label: string;
  initial?: string;
  pending: boolean;
  error?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation("formFolders");
  const [value, setValue] = useState(initial);
  const errorId = useId();
  return (
    <div className="flex flex-col gap-1 py-0.5">
      <div className="flex items-center gap-1">
        <Input autoFocus aria-label={label} value={value} maxLength={folderNameMaxLength} aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined} readOnly={pending} onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") { event.preventDefault(); if (!pending) onSubmit(value); }
            if (event.key === "Escape" && !pending) { event.preventDefault(); onCancel(); }
          }} />
        <IconButton size="icon-sm" label={pending ? t("name.saving") : t("name.save")} pending={pending} onClick={() => onSubmit(value)}>
          <CheckIcon className="size-4" />
        </IconButton>
        <IconButton size="icon-sm" label={t("name.cancel")} disabled={pending} onClick={onCancel}>
          <CloseIcon className="size-4" />
        </IconButton>
      </div>
      {error ? <p id={errorId} role="alert" className="text-xs text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
