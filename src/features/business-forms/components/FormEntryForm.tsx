import { useCallback, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { CollapsibleSection } from "@/shared/ui/CollapsibleSection";
import { FormField } from "@/shared/ui/FormField";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Textarea } from "@/shared/ui/textarea";
import type { FormEntry, FormEntryQuestion } from "../api/entries";
import { entryAnswered, entryChoiceInRow, entryColumns, entryQuestionId, entryQuestionWidth, entryRows, entryTextRows, entryZones, type EntryDraft, type EntryZone } from "../entryForm";
import { EntryCatalogField } from "./EntryCatalogField";
import { EntryFilesField } from "./EntryFilesField";

interface Props {
  entry: FormEntry;
  draft: EntryDraft;
  onChange: (draft: EntryDraft) => void;
  /** The message of each question with a problem, from the form or from the server. */
  errors: Readonly<Record<string, string>>;
  /** The page shows data and files in two folding zones of up to three per row (CW16); the panel, one column (CW2-B). */
  layout: "page" | "panel";
  disabled?: boolean;
  /** Grows with each send that found something to correct: the folded zones that hold it open again. */
  reveal?: number;
}

const isFile = (question: FormEntryQuestion) => question.type === "photo" || question.type === "document";
const gridClass = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" } as const;
const widthClass = { 1: "", 2: "col-span-2", 3: "col-span-3" } as const;

/**
 * The questions of the active version in the editor's order, each with the control and width of its type (CW12, CW16).
 * A catalog that cannot be used by whoever loads stays disabled; the page says why above.
 */
export function FormEntryForm({ entry, draft, onChange, errors, layout, disabled, reveal = 0 }: Props) {
  const { t } = useTranslation("formEntries");
  const [folded, setFolded] = useState<Readonly<Record<string, boolean>>>({});
  const [revealed, setRevealed] = useState(reveal);
  // The rows are built with the columns that fit in the zones; until they are measured, the screen's.
  const phone = useMediaQuery("(width < 640px)");
  const tablet = useMediaQuery("(width < 1024px)");
  const [widthRem, setWidthRem] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const measured = useCallback((node: HTMLDivElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    const measure = () => setWidthRem(node.clientWidth / (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16));
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(node);
  }, []);
  const columns = widthRem > 0 ? entryColumns(widthRem) : phone ? 1 : tablet ? 2 : 3;
  const zones = entryZones(entry);
  // Opened while rendering, so the focus that follows the send finds the question with the error.
  if (reveal !== revealed) {
    setRevealed(reveal);
    setFolded(current => Object.fromEntries(zones.map(zone => [zone.key, !!current[zone.key] && !zone.questions.some(item => errors[item.fieldId])])));
  }
  // Number and date stay narrow (CW12): in the panel, except on the phone; on the page, within their cell, and across in one column.
  const narrowClass = layout === "panel" ? "w-full sm:w-37.5" : columns === 1 ? undefined : "w-full max-w-37.5";
  const question = (item: FormEntryQuestion) => <EntryQuestion key={item.fieldId} entry={entry} question={item} draft={draft} onChange={onChange} error={errors[item.fieldId]} disabled={disabled}
    narrowClass={narrowClass}/>;
  if (layout === "panel") return <div className="flex flex-col gap-4">{entry.questions.map(question)}</div>;

  const answered = (items: FormEntryQuestion[]) => t("zone.answered", { count: items.filter(item => entryAnswered(item, draft)).length, total: items.length });
  // Folded, a zone says how many questions were answered; the files zone says what was attached, as CW16 draws it.
  const summary = (items: FormEntryQuestion[]) => {
    if (!items.every(isFile)) return answered(items);
    const count = (type: FormEntryQuestion["type"]) => items.filter(item => item.type === type).reduce((sum, item) => sum + (draft.files[item.fieldId]?.length ?? 0), 0);
    const parts = [count("photo") ? t("sent.photos", { count: count("photo") }) : null, count("document") ? t("sent.files", { count: count("document") }) : null].filter(Boolean);
    return parts.length ? parts.join(" · ") : answered(items);
  };
  const title = (zone: EntryZone) => zone.key === "files" ? t("page.files") : t("page.data");
  return <div ref={measured} className="flex flex-col gap-4">{zones.map(zone => <CollapsibleSection key={zone.key} title={title(zone)} open={!folded[zone.key]}
    onOpenChange={open => setFolded(current => ({ ...current, [zone.key]: !open }))} expandLabel={t("zone.expand", { name: title(zone) })}
    collapseLabel={t("zone.collapse", { name: title(zone) })} summary={summary(zone.questions)}>
    <div className="divide-y divide-[var(--color-border)]">{entryRows(zone.questions, columns).map(row => <div key={row[0].fieldId} data-entry-row className={"grid gap-x-5 gap-y-3 px-4 py-3 " + gridClass[columns]}>
      {row.map(item => <div key={item.fieldId} className={"min-w-0 " + widthClass[entryQuestionWidth(item, columns)]}>{question(item)}</div>)}
    </div>)}</div>
  </CollapsibleSection>)}</div>;
}

function EntryQuestion({ entry, question, draft, onChange, error, disabled, narrowClass }: {
  entry: FormEntry; question: FormEntryQuestion; draft: EntryDraft; onChange: (draft: EntryDraft) => void; error?: string; disabled?: boolean;
  /** The width of number and date; without it they go across. */
  narrowClass?: string;
}) {
  const { t } = useTranslation("formEntries");
  const id = entryQuestionId(question.fieldId);
  const messageId = id + "-message";
  const value = draft.values[question.fieldId] ?? "";
  const setValue = (next: string) => onChange({ ...draft, values: { ...draft.values, [question.fieldId]: next } });
  const choose = (option?: { id: string; label: string }) => onChange({ ...draft, choices: { ...draft.choices, [question.fieldId]: option ? [{ id: option.id, title: option.label, description: null }] : [] } });
  const blocked = disabled || question.catalog?.issue != null;
  const message = error ?? question.help ?? undefined;
  // How many answers a question takes goes in its label, «Fotos del lote hasta 3», «Proveedores hasta 2», never in a line
  // under its control; the formats and size of the files go in the (i) next to it and describe its button (2026-10-31).
  const limit = isFile(question) ? question.files?.maxFiles : question.type === "multiChoice" ? question.selection?.maxSelected ?? (question.catalog ? 1 : 20) : undefined;
  const help = isFile(question) ? t(question.type === "photo" ? "files.photoHint" : "files.documentHint", { size: entry.maxFileSizeMiB }) : undefined;
  const helpId = id + "-help";
  const describedBy = [help ? helpId : undefined, message ? messageId : undefined].filter(Boolean).join(" ") || undefined;
  const labelText = <>{question.label}{question.required ? <span aria-hidden="true"> *</span> : null}
    {limit !== undefined ? <>{" "}<span className="text-xs font-normal text-[var(--color-content-muted)]">{t("upTo", { count: limit })}</span></> : null}</>;
  // A list, a group or the files carry their own controls: the label names the group and the message goes below it.
  const grouped = (control: ReactNode, labelled = true) => {
    const label = labelled ? <Label htmlFor={id}>{labelText}</Label> : <Label asChild><span id={id + "-label"}>{labelText}</span></Label>;
    return <div className="flex flex-col gap-1.5" data-entry-question={question.fieldId}>
      {help ? <div className="flex items-center gap-1">{label}<span className="-my-1 inline-flex"><InfoTip id={helpId} label={t("common:actions.moreInfo", { label: question.label })} text={help}/></span></div> : label}
      {control}
      {message ? <p id={messageId} role={error ? "alert" : undefined} className={error ? "text-sm text-[var(--color-danger)]" : "text-sm text-[var(--color-content-muted)]"}>{message}</p> : null}
    </div>;
  };
  const field = (control: ReactElement<{ id?: string }>) => <div data-entry-question={question.fieldId}>
    <FormField label={question.label} htmlFor={id} required={question.required} hint={question.help ?? undefined} error={error}>{control}</FormField>
  </div>;

  if (question.catalog) return grouped(<EntryCatalogField entry={entry} question={question} chosen={draft.choices[question.fieldId] ?? []} id={id}
    invalid={!!error} describedBy={message ? messageId : undefined} disabled={blocked}
    onChange={chosen => onChange({ ...draft, choices: { ...draft.choices, [question.fieldId]: chosen } })}/>);
  if (isFile(question)) return grouped(<EntryFilesField question={question} files={draft.files[question.fieldId] ?? []} maxFileSizeMiB={entry.maxFileSizeMiB} id={id}
    invalid={!!error} describedBy={describedBy} disabled={disabled}
    onChange={files => onChange({ ...draft, files: { ...draft.files, [question.fieldId]: files } })}/>, false);
  // Up to five short options in a row; more, or longer ones, in a dropdown list (CW12).
  if (question.type === "choice" && !entryChoiceInRow(question)) return field(<NativeSelect value={draft.choices[question.fieldId]?.[0]?.id ?? ""} disabled={disabled}
    onChange={event => choose(question.options?.find(option => option.id === event.target.value))}>
    <option value="">{t("page.choose")}</option>
    {(question.options ?? []).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
  </NativeSelect>);
  if (question.type === "choice") return grouped(<div id={id} tabIndex={-1} className="outline-none">
    <RadioGroupField label={question.label} layout="row" value={draft.choices[question.fieldId]?.[0]?.id}
      options={(question.options ?? []).map(option => ({ value: option.id, label: option.label, disabled }))}
      onValueChange={choice => choose(question.options?.find(item => item.id === choice))}/>
  </div>, false);
  if (question.type === "multiChoice") {
    const chosen = draft.choices[question.fieldId] ?? [];
    const max = question.selection?.maxSelected ?? 20;
    return grouped(<div id={id} tabIndex={-1} role="group" aria-labelledby={id + "-label"} className="flex flex-col gap-1 outline-none">
      {(question.options ?? []).map(option => {
        const checked = chosen.some(item => item.id === option.id);
        return <CheckboxField key={option.id} label={option.label} checked={checked} disabled={disabled || !checked && chosen.length >= max}
          onCheckedChange={next => onChange({ ...draft, choices: { ...draft.choices, [question.fieldId]: next
            ? [...chosen, { id: option.id, title: option.label, description: null }] : chosen.filter(item => item.id !== option.id) } })}/>;
      })}
    </div>, false);
  }
  if (question.type === "boolean") return grouped(<div id={id} tabIndex={-1} className="outline-none">
    <SegmentedControl aria-label={question.label} options={[
      { key: "true", label: t("sent.yes"), pressed: value === "true", onSelect: () => setValue("true") },
      { key: "false", label: t("sent.no"), pressed: value === "false", onSelect: () => setValue("false") },
    ]}/>
  </div>, false);
  if (question.type === "longText") return field(<Textarea value={value} maxLength={question.maxLength ?? undefined} rows={entryTextRows(question)} disabled={disabled} onChange={event => setValue(event.target.value)}/>);
  const narrow = question.type === "decimal" || question.type === "date";
  return field(<Input value={value} disabled={disabled} className={narrow ? narrowClass : undefined}
    type={question.type === "date" ? "date" : "text"} inputMode={question.type === "decimal" ? "decimal" : undefined}
    maxLength={question.type === "shortText" ? question.maxLength ?? undefined : undefined} onChange={event => setValue(event.target.value)}/>);
}
