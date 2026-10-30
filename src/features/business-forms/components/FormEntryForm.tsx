import { useState, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { CollapsibleSection } from "@/shared/ui/CollapsibleSection";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Textarea } from "@/shared/ui/textarea";
import type { FormEntry, FormEntryQuestion } from "../api/entries";
import { entryAnswered, entryChoiceInRow, entryQuestionId, entryQuestionSpan, entryRows, entryTextRows, type EntryDraft } from "../entryForm";
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

type Zone = "data" | "files";
const isFile = (question: FormEntryQuestion) => question.type === "photo" || question.type === "document";
// The phone has one column and the tablet two; the computer, the three of the rule.
const spanClass = { 1: "", 2: "sm:col-span-2", 3: "sm:col-span-2 lg:col-span-3" } as const;

/**
 * The questions of the active version in the editor's order, each with the control and width of its type (CW12, CW16).
 * A catalog that cannot be used by whoever loads stays disabled; the page says why above.
 */
export function FormEntryForm({ entry, draft, onChange, errors, layout, disabled, reveal = 0 }: Props) {
  const { t } = useTranslation("formEntries");
  const [folded, setFolded] = useState<Partial<Record<Zone, boolean>>>({});
  const [revealed, setRevealed] = useState(reveal);
  const data = entry.questions.filter(item => !isFile(item));
  const files = entry.questions.filter(isFile);
  // Opened while rendering, so the focus that follows the send finds the question with the error.
  if (reveal !== revealed) {
    setRevealed(reveal);
    setFolded(current => ({ data: current.data && !data.some(item => errors[item.fieldId]), files: current.files && !files.some(item => errors[item.fieldId]) }));
  }
  const question = (item: FormEntryQuestion) => <EntryQuestion key={item.fieldId} entry={entry} question={item} draft={draft} onChange={onChange} error={errors[item.fieldId]} disabled={disabled}/>;
  if (layout === "panel") return <div className="flex flex-col gap-4">{entry.questions.map(question)}</div>;

  const answered = (items: FormEntryQuestion[]) => t("zone.answered", { count: items.filter(item => entryAnswered(item, draft)).length, total: items.length });
  const attached = () => {
    const count = (type: FormEntryQuestion["type"]) => files.filter(item => item.type === type).reduce((sum, item) => sum + (draft.files[item.fieldId]?.length ?? 0), 0);
    const parts = [count("photo") ? t("sent.photos", { count: count("photo") }) : null, count("document") ? t("sent.files", { count: count("document") }) : null].filter(Boolean);
    return parts.length ? parts.join(" · ") : answered(files);
  };
  const zone = (key: Zone, title: string, items: FormEntryQuestion[], summary: string) => <CollapsibleSection title={title} open={!folded[key]}
    onOpenChange={open => setFolded(current => ({ ...current, [key]: !open }))} expandLabel={t("zone.expand", { name: title })} collapseLabel={t("zone.collapse", { name: title })} summary={summary}>
    <div className="divide-y divide-[var(--color-border)]">{entryRows(items).map(row => <div key={row[0].fieldId} className="grid grid-cols-1 gap-x-5 gap-y-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
      {row.map(item => <div key={item.fieldId} className={"min-w-0 " + spanClass[entryQuestionSpan(item)]}>{question(item)}</div>)}
    </div>)}</div>
  </CollapsibleSection>;
  return <div className="flex flex-col gap-4">
    {data.length ? zone("data", t("page.data"), data, answered(data)) : null}
    {files.length ? zone("files", t("page.files"), files, attached()) : null}
  </div>;
}

function EntryQuestion({ entry, question, draft, onChange, error, disabled }: {
  entry: FormEntry; question: FormEntryQuestion; draft: EntryDraft; onChange: (draft: EntryDraft) => void; error?: string; disabled?: boolean;
}) {
  const { t } = useTranslation("formEntries");
  const id = entryQuestionId(question.fieldId);
  const messageId = id + "-message";
  const value = draft.values[question.fieldId] ?? "";
  const setValue = (next: string) => onChange({ ...draft, values: { ...draft.values, [question.fieldId]: next } });
  const choose = (option?: { id: string; label: string }) => onChange({ ...draft, choices: { ...draft.choices, [question.fieldId]: option ? [{ id: option.id, title: option.label, description: null }] : [] } });
  const blocked = disabled || question.catalog?.issue != null;
  const message = error ?? question.help ?? undefined;
  // A list, a group or the files carry their own controls: the label names the group and the message goes below it.
  const grouped = (control: ReactNode, labelled = true) => <div className="flex flex-col gap-1.5" data-entry-question={question.fieldId}>
    {labelled ? <Label htmlFor={id}>{question.label}{question.required ? <span aria-hidden="true"> *</span> : null}</Label>
      : <Label asChild><span id={id + "-label"}>{question.label}{question.required ? <span aria-hidden="true"> *</span> : null}
        {isFile(question) && question.files ? <span className="text-xs font-normal text-[var(--color-content-muted)]">{t("files.upTo", { count: question.files.maxFiles })}</span> : null}</span></Label>}
    {control}
    {message ? <p id={messageId} role={error ? "alert" : undefined} className={error ? "text-sm text-[var(--color-danger)]" : "text-sm text-[var(--color-content-muted)]"}>{message}</p> : null}
  </div>;
  const field = (control: ReactElement<{ id?: string }>) => <div data-entry-question={question.fieldId}>
    <FormField label={question.label} htmlFor={id} required={question.required} hint={question.help ?? undefined} error={error}>{control}</FormField>
  </div>;

  if (question.catalog) return grouped(<EntryCatalogField entry={entry} question={question} chosen={draft.choices[question.fieldId] ?? []} id={id}
    invalid={!!error} describedBy={message ? messageId : undefined} disabled={blocked}
    onChange={chosen => onChange({ ...draft, choices: { ...draft.choices, [question.fieldId]: chosen } })}/>);
  if (isFile(question)) return grouped(<EntryFilesField question={question} files={draft.files[question.fieldId] ?? []} maxFileSizeMiB={entry.maxFileSizeMiB} id={id}
    invalid={!!error} describedBy={message ? messageId : undefined} disabled={disabled}
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
      <p className="text-xs text-[var(--color-content-muted)]">{t("catalog.chooseUpTo", { count: max })}</p>
    </div>, false);
  }
  if (question.type === "boolean") return grouped(<div id={id} tabIndex={-1} className="outline-none">
    <SegmentedControl aria-label={question.label} options={[
      { key: "true", label: t("sent.yes"), pressed: value === "true", onSelect: () => setValue("true") },
      { key: "false", label: t("sent.no"), pressed: value === "false", onSelect: () => setValue("false") },
    ]}/>
  </div>, false);
  if (question.type === "longText") return field(<Textarea value={value} maxLength={question.maxLength ?? undefined} rows={entryTextRows(question)} disabled={disabled} onChange={event => setValue(event.target.value)}/>);
  // Number and date stay narrow (CW12); on the phone everything goes across.
  const narrow = question.type === "decimal" || question.type === "date";
  return field(<Input value={value} disabled={disabled} className={narrow ? "w-full sm:w-37.5" : undefined}
    type={question.type === "date" ? "date" : "text"} inputMode={question.type === "decimal" ? "decimal" : undefined}
    maxLength={question.type === "shortText" ? question.maxLength ?? undefined : undefined} onChange={event => setValue(event.target.value)}/>);
}
