import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { PencilIcon, ChevronDownIcon, TrashIcon } from "@/shared/ui/icons";
import { localizedValue } from "../editorModel";
import type { DraftSection, FormCulture } from "../model";
import { localizedIssue, localizedIssueMessage, type DraftFieldIssue } from "../validationPaths";

/**
 * A section title in the question list (CW15-B): a row of its own, in bold over the band's tint, with ↑ ↓, edit and remove like a
 * question. Open, it edits the title in the menu's language, with the original as a reference while translating.
 */
export function SectionTitleEditor({ section, position, total, culture, original, expanded, readOnly, issues, onChange, onExpand, onMove, onRemove }: {
  section: DraftSection; position: number; total: number; culture: FormCulture; original: FormCulture; expanded: boolean; readOnly: boolean;
  issues: readonly DraftFieldIssue[]; onChange: (section: DraftSection) => void; onExpand: (open: boolean) => void; onMove: (delta: number) => void; onRemove: () => void;
}) {
  const { t } = useTranslation("forms");
  const inputRef = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const label = localizedValue(section.title, culture, original) || t("sections.title");
  const blank = !section.title[culture]?.trim();
  useEffect(() => { if (expanded) inputRef.current?.focus(); }, [expanded]);
  // After a move, the focus stays on an enabled arrow of the same title, as in a question.
  useLayoutEffect(() => {
    const delta = pendingFocus.current;
    if (delta === null) return;
    pendingFocus.current = null;
    const buttons = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>("button[data-move-item]:not(:disabled)") ?? []);
    (buttons.find(button => button.dataset.moveDelta === String(delta)) ?? buttons[0])?.focus();
  }, [position]);
  function move(delta: number) {
    pendingFocus.current = delta;
    setAnnouncement(t("position", { name: label, position: position + delta, total }));
    onMove(delta);
  }
  const error = localizedIssueMessage(localizedIssue(Object.fromEntries([...issues].reverse().map(issue => [issue.path, issue.messages])), issues[0]?.path.replace(/\.(es|en)$/, "") ?? "", culture), culture, t);
  return <div ref={rootRef} data-section-local-id={section.localId} className="border-t border-[var(--color-border)] bg-[var(--color-surface-muted)] first:border-t-0">
    <div className="flex flex-wrap items-center gap-2 px-4 py-2">
      <div className="min-w-0 flex-1">
        <p className={"break-words text-sm font-semibold" + (blank ? " italic" : "")}>{label}</p>
        <p className="text-xs text-[var(--color-content-muted)]">{t("sections.type")}</p>
        {culture !== original && blank ? <Badge variant="outline" className="text-[var(--color-content-muted)]">{t("missingText")}</Badge> : null}
        {issues.length ? <Badge variant="outline" className="border-[var(--color-warning)]/45 bg-[var(--color-warning-50)] text-[var(--color-warning-700)]">{t("sections.issue")}</Badge> : null}
      </div>
      <div className="flex items-center gap-1">
        {!readOnly ? <>
          <IconButton size="icon-sm" label={t("up", { name: label })} disabled={position === 1} disabledLabel={t("position", { name: label, position, total })} data-move-item={section.localId} data-move-delta={-1} onClick={() => move(-1)}><ChevronDownIcon className="size-4 rotate-180" /></IconButton>
          <IconButton size="icon-sm" label={t("down", { name: label })} disabled={position === total} disabledLabel={t("position", { name: label, position, total })} data-move-item={section.localId} data-move-delta={1} onClick={() => move(1)}><ChevronDownIcon className="size-4" /></IconButton>
        </> : null}
        <IconButton size="icon-sm" ref={editButton} data-section-action="edit" label={readOnly ? t("sections.view", { name: label }) : `${t("edit")} ${label}`} onClick={() => onExpand(!expanded)} aria-expanded={expanded}>{readOnly ? <ChevronDownIcon className="size-4" /> : <PencilIcon className="size-4" />}</IconButton>
        {!readOnly ? <IconButton size="icon-sm" label={t("remove", { name: label })} onClick={onRemove}><TrashIcon className="size-4" /></IconButton> : null}
      </div>
    </div>
    {expanded ? <div className="flex flex-col gap-4 border-t border-[var(--color-border)] p-4">
      <FormField label={t("sections.title")} hint={culture !== original && section.title[original] ? t("originalText", { language: t("cultures." + original), text: section.title[original] }) : undefined} error={error}>
        <Input data-section-control="title" ref={inputRef} readOnly={readOnly} maxLength={80} placeholder={culture !== original ? t("missingText") : undefined} value={section.title[culture] ?? ""}
          onChange={event => onChange({ ...section, title: { ...section.title, [culture]: event.target.value } })} />
      </FormField>
      <div className="flex justify-end"><Button type="button" variant="outline" onClick={() => { onExpand(false); editButton.current?.focus(); }}>{t("done")}</Button></div>
    </div> : null}
    <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</span>
  </div>;
}
