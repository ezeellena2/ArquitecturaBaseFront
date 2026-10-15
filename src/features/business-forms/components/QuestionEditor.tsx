import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { FormField } from "@/shared/ui/FormField";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { IconButton } from "@/shared/ui/IconButton";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { PencilIcon, ChevronDownIcon, TrashIcon } from "@/shared/ui/icons";
import { localizedValue, missingQuestionTexts, moveItem, replaceQuestionType, questionEditorType, changeQuestionCatalog, type QuestionEditorType } from "../editorModel";
import type { DraftQuestion, FormCulture } from "../model";
import type { DraftFieldIssue } from "../validationPaths";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { CatalogQuestionName } from "./CatalogQuestionName";
import { FileQuestionSettings } from "./FileQuestionSettings";
import { CatalogQuestionSelector } from "./CatalogQuestionSelector";

const types: readonly QuestionEditorType[] = ["shortText", "longText", "decimal", "date", "boolean", "choice", "catalogChoice", "photo", "document"];
export function QuestionEditor({ question, position, total, culture, original, expanded, readOnly, issues, onChange, onExpand, onMove, onRemove, catalogScope, filesAvailable = false }: {
  question: DraftQuestion; position: number; total: number; culture: FormCulture; original: FormCulture; expanded: boolean; readOnly: boolean;
  catalogScope?: CatalogReadScope; filesAvailable?: boolean;
  issues: readonly DraftFieldIssue[]; onChange: (question: DraftQuestion) => void; onExpand: (open: boolean) => void; onMove: (delta: number) => void; onRemove: () => void;
}) {
  const { t } = useTranslation("forms");
  const inputRef = useRef<HTMLInputElement>(null);
  const editButton = useRef<HTMLButtonElement>(null);
  const addOptionButton = useRef<HTMLButtonElement>(null);
  const optionRemovalFocus = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<{ item: string; delta: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [confirmation, setConfirmation] = useState<{ type: QuestionEditorType } | { option: string } | { catalog: string } | null>(null);
  const label = localizedValue(question.label, culture, original) || t("question");
  const reference = (text: Readonly<Record<string, string | null>> | null) => culture !== original && text?.[original] ? t("originalText", { language: t("cultures." + original), text: text[original] }) : undefined;
  const languageIssues = issues.filter(issue => !/\.(es|en)$/.test(issue.path) || issue.path.endsWith("." + culture));
  const fieldError = (name: string) => languageIssues.find(issue => !issue.choiceLocalId && new RegExp(`\\.${name}(\\.(es|en))?$`).test(issue.path))?.messages[0];
  useEffect(() => { if (expanded) inputRef.current?.focus(); }, [expanded]);
  useLayoutEffect(() => {
    const pending = pendingFocus.current;
    if (!pending) return;
    pendingFocus.current = null;
    const buttons = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>("button[data-move-item]:not(:disabled)") ?? []);
    const sameItem = buttons.filter(button => button.dataset.moveItem === pending.item);
    (sameItem.find(button => button.dataset.moveDelta === String(pending.delta)) ?? sameItem[0])?.focus();
  }, [position, question]);
  function moveQuestion(delta: number) {
    pendingFocus.current = { item: question.localId, delta };
    setAnnouncement(t("position", { name: label, position: position + delta, total }));
    onMove(delta);
  }
  function moveOption(index: number, delta: number) {
    if (question.type !== "choice" || question.source) return;
    const option = question.options[index]!;
    pendingFocus.current = { item: option.localId, delta };
    setAnnouncement(t("position", { name: localizedValue(option.label, culture, original) || t("option", { number: index + 1 }), position: index + 1 + delta, total: question.options.length }));
    onChange({ ...question, options: moveItem(question.options, index, delta) });
  }
  function removeOption(localId: string) {
    if (question.type !== "choice" || question.source) return;
    const index = question.options.findIndex(o => o.localId === localId);
    const neighbor = question.options[index + 1] ?? question.options[index - 1];
    optionRemovalFocus.current = [...(rootRef.current?.querySelectorAll<HTMLInputElement>("[data-choice-local-id]") ?? [])].find(input => input.dataset.choiceLocalId === neighbor?.localId) ?? addOptionButton.current;
    onChange({ ...question, options: question.options.filter(o => o.localId !== localId) });
    if (!confirmation) requestAnimationFrame(() => optionRemovalFocus.current?.focus());
  }
  function changeType(type: QuestionEditorType) {
    if (type === questionEditorType(question)) return;
    if (question.fieldId) setConfirmation({ type });
    else onChange(replaceQuestionType(question, type, crypto.randomUUID(), original));
  }
  return <div ref={rootRef} data-question-local-id={question.localId} className="border-t border-[var(--color-border)] first:border-t-0">
    <div className="flex flex-wrap items-center gap-2 px-4 py-2">
      <span className="text-sm text-[var(--color-content-muted)]">{position}</span>
      <div className="min-w-0 flex-1"><p className={"break-words text-sm font-medium" + (!question.label[culture]?.trim() ? " italic" : "")}>{label}</p><p className="text-xs text-[var(--color-content-muted)]">{t("types." + questionEditorType(question))}{question.type === "photo" || question.type === "document" ? " · " + t("files.range", { minimum: question.files.minFiles, maximum: question.files.maxFiles }) + (question.type === "photo" ? " · " + t("files.sources." + question.files.photoSource) : "") : ""}{!expanded && question.type === "choice" && question.source?.catalog && catalogScope ? <CatalogQuestionName scope={catalogScope} id={question.source.catalog} /> : null} · {t(question.required ? "required" : "optional")}{missingQuestionTexts(question, culture) ? " · " + t("languageMissing", { count: missingQuestionTexts(question, culture) }) : ""}</p>{issues.length ? <Badge variant="outline" className="border-[var(--color-warning)]/45 bg-[var(--color-warning-50)] text-[var(--color-warning-700)]">{t("publication.questionIssue", { language: t("cultures." + (issues[0]!.path.match(/\.(es|en)$/)?.[1] ?? culture)) })}</Badge> : null}</div>
      <div className="flex items-center gap-1">
        {!readOnly ? <>
        <IconButton size="icon-sm" label={t("up", { name: label })} disabled={readOnly || position === 1} disabledLabel={t("position", { name: label, position, total })} data-move-item={question.localId} data-move-delta={-1} onClick={() => moveQuestion(-1)}><ChevronDownIcon className="size-4 rotate-180" /></IconButton>
        <IconButton size="icon-sm" label={t("down", { name: label })} disabled={readOnly || position === total} disabledLabel={t("position", { name: label, position, total })} data-move-item={question.localId} data-move-delta={1} onClick={() => moveQuestion(1)}><ChevronDownIcon className="size-4" /></IconButton>
        </> : null}
        <IconButton size="icon-sm" ref={editButton} data-question-action="edit" label={readOnly ? t("viewQuestion", { name: label }) : `${t("edit")} ${label}`} onClick={() => onExpand(!expanded)} aria-expanded={expanded}>{readOnly ? <ChevronDownIcon className="size-4" /> : <PencilIcon className="size-4" />}</IconButton>
        {!readOnly ? <IconButton size="icon-sm" label={t("remove", { name: label })} onClick={onRemove}><TrashIcon className="size-4" /></IconButton> : null}
      </div>
    </div>
    {expanded ? <div className="flex flex-col gap-4 bg-[var(--color-surface-muted)] p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={t("question")} hint={reference(question.label)} error={fieldError("label")}><Input data-question-control="label" ref={inputRef} readOnly={readOnly} placeholder={t("missingText", { language: t("cultureNamesInText." + culture) })} value={question.label[culture] ?? ""} onChange={e => onChange({ ...question, label: { ...question.label, [culture]: e.target.value } })} /></FormField>
        <FormField label={t("type")} error={fieldError("type")} hint={question.type === "date" ? t("dateHint") : undefined}><NativeSelect disabled={readOnly} value={questionEditorType(question)} onChange={e => changeType(e.target.value as QuestionEditorType)}>{types.map(type => <option key={type} value={type} disabled={type === "catalogChoice" && !catalogScope?.permissions.includes("formcatalogs.read") || (type === "photo" || type === "document") && !filesAvailable}>{t(`types.${type}`)}{(type === "photo" || type === "document") && !filesAvailable ? " · " + t("files.storageMissing") : ""}</option>)}</NativeSelect></FormField>
        <FormField label={t("help")} hint={reference(question.help) ?? t("optional")} error={fieldError("help")}><Textarea data-question-control="help" readOnly={readOnly} value={question.help?.[culture] ?? ""} onChange={e => onChange({ ...question, help: { ...question.help, [culture]: e.target.value || null } })} /></FormField>
        <div className="flex flex-col gap-4">
          {question.type !== "photo" && question.type !== "document" ? <CheckboxField label={t("required")} error={fieldError("required")} checked={question.required} disabled={readOnly} onCheckedChange={checked => onChange({ ...question, required: checked })} /> : null}
          {question.type === "shortText" || question.type === "longText" ? <FormField label={t("maxLength")} error={fieldError("maxLength")}><Input type="number" min={1} max={10000} readOnly={readOnly} value={question.maxLength ?? ""} onChange={e => onChange({ ...question, maxLength: e.target.value === "" ? null : Number(e.target.value) })} /></FormField> : null}
        </div>
      </div>
      {question.type === "photo" || question.type === "document" ? <FileQuestionSettings question={question} readOnly={readOnly} error={fieldError("files")} onChange={onChange} /> : null}
      {question.type === "choice" && question.source ? <CatalogQuestionSelector scope={catalogScope ?? { actorId: null, culture, permissions: [] }} value={question.source.catalog ?? ""} readOnly={readOnly} error={fieldError("source\\.catalog") ?? fieldError("source")} onChange={catalogId => {
        if (catalogId === question.source?.catalog) return;
        if (question.fieldId) setConfirmation({ catalog: catalogId });
        else onChange(changeQuestionCatalog(question, catalogId, question.localId));
      }} /> : null}
      {question.type === "choice" && !question.source ? <div className="flex flex-col gap-3">
        {fieldError("options") ? <p role="alert" className="text-sm text-[var(--color-danger)]">{fieldError("options")}</p> : null}
        {question.options.map((option, index) => <div key={option.localId} className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1"><FormField label={t("option", { number: index + 1 })} hint={reference(option.label)} error={languageIssues.find(issue => issue.choiceLocalId === option.localId && /\.label(?:\.(es|en))?$/.test(issue.path))?.messages[0]}><Input data-choice-local-id={option.localId} readOnly={readOnly} placeholder={t("missingText", { language: t("cultureNamesInText." + culture) })} value={option.label[culture] ?? ""} onChange={e => onChange({ ...question, options: question.options.map(o => o.localId === option.localId ? { ...o, label: { ...o.label, [culture]: e.target.value } } : o) })} /></FormField></div>
          {!readOnly ? <div className="flex gap-1">
            <IconButton size="icon-sm" label={t("up", { name: localizedValue(option.label, culture, original) || t("option", { number: index + 1 }) })} disabled={index === 0} disabledLabel={t("position", { name: t("option", { number: index + 1 }), position: index + 1, total: question.options.length })} data-move-item={option.localId} data-move-delta={-1} onClick={() => moveOption(index, -1)}><ChevronDownIcon className="size-4 rotate-180" /></IconButton>
            <IconButton size="icon-sm" label={t("down", { name: localizedValue(option.label, culture, original) || t("option", { number: index + 1 }) })} disabled={index === question.options.length - 1} disabledLabel={t("position", { name: t("option", { number: index + 1 }), position: index + 1, total: question.options.length })} data-move-item={option.localId} data-move-delta={1} onClick={() => moveOption(index, 1)}><ChevronDownIcon className="size-4" /></IconButton>
            <IconButton size="icon-sm" label={t("remove", { name: t("option", { number: index + 1 }) })} onClick={() => { if (option.choiceId || Object.values(option.label).some(Boolean)) setConfirmation({ option: option.localId }); else removeOption(option.localId); }}><TrashIcon className="size-4" /></IconButton>
          </div> : null}
        </div>)}
        {!readOnly ? <Button ref={addOptionButton} type="button" variant="outline" disabled={question.options.length >= 50} onClick={() => onChange({ ...question, options: [...question.options, { localId: crypto.randomUUID(), choiceId: null, label: { [original]: "" } }] })}>{t("addOption")}</Button> : null}
      </div> : null}
      <div className="flex justify-end"><Button type="button" variant="outline" onClick={() => { onExpand(false); editButton.current?.focus(); }}>{t("done")}</Button></div>
    </div> : null}
    <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</span>
    <ConfirmDialog focusFallback={optionRemovalFocus} open={confirmation !== null} onOpenChange={open => { if (!open) setConfirmation(null); }} title={t(confirmation && "catalog" in confirmation ? "catalogQuestion.changeTitle" : confirmation && "type" in confirmation ? "changeTypeTitle" : "optionRemovedTitle")} description={t(confirmation && "catalog" in confirmation ? "catalogQuestion.changeDescription" : confirmation && "type" in confirmation ? "changeTypeDescription" : "optionRemovedDescription")} confirmLabel={t(confirmation && "catalog" in confirmation ? "catalogQuestion.changeAction" : confirmation && "type" in confirmation ? "changeTypeAction" : "removeOptionAction")} onConfirm={() => {
      if (readOnly || !confirmation) return;
      if ("type" in confirmation) onChange(replaceQuestionType(question, confirmation.type, crypto.randomUUID(), original));
      else if ("catalog" in confirmation) { if (catalogScope?.permissions.includes("formcatalogs.read")) onChange(changeQuestionCatalog(question, confirmation.catalog, crypto.randomUUID())); }
      else removeOption(confirmation.option);
    }} />
  </div>;
}
