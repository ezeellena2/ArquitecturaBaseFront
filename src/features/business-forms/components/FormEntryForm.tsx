import { cloneElement, useCallback, useRef, useState, type ReactElement, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { CollapsibleSection } from "@/shared/ui/CollapsibleSection";
import { FormField } from "@/shared/ui/FormField";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Input } from "@/shared/ui/input";
import { ItemCards, ItemTable, type ItemCellContext, type ItemTableColumn } from "@/shared/ui/ItemTable";
import { Label } from "@/shared/ui/label";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Textarea } from "@/shared/ui/textarea";
import { formatTypedValue } from "@/shared/lib/typedValue";
import type { FormEntry, FormEntryGroup, FormEntryOption, FormEntryQuestion } from "../api/entries";
import { calculationFormula, entryCalculations, entryFormulaOperands, type EntryCalculations } from "../calculations";
import { entryHiddenQuestions } from "../conditions";
import {
  addEntryItem, changeEntryItem, chooseEntryGroup, clearDependentChoices, entryAnswered, entryBlock, entryChoiceInRow, entryColumns, entryDependencyAnswers, entryFileCount,
  entryItemPath, entryQuestionId, entryQuestionWidth, entryRows, entryTextRows, entryZones, moveEntryItem, removeEntryItem, type EntryDraft, type EntryItem,
  type EntryZone,
} from "../entryForm";
import { useCalculationWords } from "../hooks/useCalculationWords";
import { useEntryGroupChoice } from "../hooks/useFormEntry";
import { EntryCatalogField, EntryGroupField } from "./EntryCatalogField";
import { EntryFilesField } from "./EntryFilesField";
import { EntryLocationField } from "./EntryLocationField";

interface Props {
  entry: FormEntry;
  draft: EntryDraft;
  onChange: (draft: EntryDraft) => void;
  /** The message of each question with a problem, from the form or from the server. */
  errors: Readonly<Record<string, string>>;
  /** The page shows data and files in two folding zones of up to three per row (CW16); the panel, the same zones in one column (AR1-A). */
  layout: "page" | "panel";
  disabled?: boolean;
  /** Grows with each send that found something to correct: the folded zones that hold it open again. */
  reveal?: number;
  /** While correcting (CW10-A): what each changed question had before, shown under its control. */
  before?: Readonly<Record<string, string>>;
}

const isFile = (question: FormEntryQuestion) => question.type === "photo" || question.type === "document";
const gridClass = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" } as const;
const widthClass = { 1: "", 2: "col-span-2", 3: "col-span-3" } as const;
const boxColumnsClass = { 1: "columns-1", 2: "columns-2", 3: "columns-3" } as const;

/**
 * The questions of the active version in the editor's order, each with the control and width of its type (CW12, CW16).
 * A catalog that cannot be used by whoever loads stays disabled; the page says why above.
 */
export function FormEntryForm({ entry, draft, onChange, errors, layout, disabled, reveal = 0, before }: Props) {
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
  // The panel keeps the zones of the page in one column (AR1-A).
  const columns = layout === "panel" ? 1 : widthRem > 0 ? entryColumns(widthRem) : phone ? 1 : tablet ? 2 : 3;
  // The boxes of a multiple choice go in as many columns as the zone, from top to bottom, and in two in the panel except on
  // the phone (AR1-A).
  const boxColumns = layout === "panel" ? phone ? 1 : 2 : columns;
  // CO1-A: a question its condition hides is not drawn, and its zone hides when nothing is left in sight. CA1-A: each calculation
  // shows what the server would compute with what is loaded, without counting what is hidden.
  const zones = entryZones(entry, draft);
  const calculated = entryCalculations(entry, draft, entryHiddenQuestions(entry, draft));
  const block = entryBlock(entry);
  // The problems of the block are its own and those of its items (`entryItemPath`).
  const hasError = (item: FormEntryQuestion) => item.type === "group"
    ? Object.keys(errors).some(key => key === item.fieldId || key.startsWith(item.fieldId + ".")) : !!errors[item.fieldId];
  // Opened while rendering, so the focus that follows the send finds the question with the error.
  if (reveal !== revealed) {
    setRevealed(reveal);
    setFolded(current => Object.fromEntries(zones.map(zone => [zone.key, !!current[zone.key] && !zone.questions.some(hasError)])));
  }
  // Number and date stay narrow (CW12): in the panel, except on the phone; on the page, within their cell, and across in one column.
  const narrowClass = layout === "panel" ? "w-full sm:w-37.5" : columns === 1 ? undefined : "w-full max-w-37.5";
  // The block is a table where the zone has columns, and boxes in one column: the panel and the phone (RG2-A).
  const question = (item: FormEntryQuestion) => item.type === "group" && block
    ? <EntryBlock key={item.fieldId} entry={entry} group={item} questions={block.questions} draft={draft} onChange={onChange} errors={errors} disabled={disabled}
      cards={columns === 1} narrowClass={narrowClass} boxColumns={boxColumns} calculated={calculated}/>
    : <EntryQuestion key={item.fieldId} entry={entry} question={item} draft={draft} onChange={onChange} error={errors[item.fieldId]} disabled={disabled}
      narrowClass={narrowClass} boxColumns={boxColumns} before={before?.[item.fieldId]} pairInRow={columns > 1} calculated={calculated}/>;

  // A calculation is not answered by the person: the band counts the others.
  const answered = (all: FormEntryQuestion[]) => {
    const items = all.filter(item => !item.calculation);
    return t("zone.answered", { count: items.filter(item => entryAnswered(item, draft)).length, total: items.length });
  };
  // Folded, a zone says how many questions were answered; the files zone says what was attached, as CW16 draws it.
  const summary = (items: FormEntryQuestion[]) => {
    if (!items.every(isFile)) return answered(items);
    const count = (type: FormEntryQuestion["type"]) => items.filter(item => item.type === type).reduce((sum, item) => sum + entryFileCount(item, draft), 0);
    const parts = [count("photo") ? t("sent.photos", { count: count("photo") }) : null, count("document") ? t("sent.files", { count: count("document") }) : null].filter(Boolean);
    return parts.length ? parts.join(" · ") : answered(items);
  };
  const title = (zone: EntryZone) => zone.title ?? (zone.key === "files" ? t("page.files") : t("page.data"));
  return <div ref={measured} className="flex flex-col gap-4">{zones.map(zone => <CollapsibleSection key={zone.key} title={title(zone)} open={!folded[zone.key]}
    onOpenChange={open => setFolded(current => ({ ...current, [zone.key]: !open }))} expandLabel={t("zone.expand", { name: title(zone) })}
    collapseLabel={t("zone.collapse", { name: title(zone) })} summary={summary(zone.questions)}>
    <div className="divide-y divide-[var(--color-border)]">{entryRows(zone.questions, columns).map(row => <div key={row[0].fieldId} data-entry-row className={"grid gap-x-5 gap-y-3 px-4 py-3 " + gridClass[columns]}>
      {row.map(item => <div key={item.fieldId} className={"min-w-0 " + widthClass[entryQuestionWidth(item, columns)]}>{question(item)}</div>)}
    </div>)}</div>
  </CollapsibleSection>)}</div>;
}

// The key of the column of the field to choose first (LD1-A), before the question's own.
const groupColumn = "group:";

// What a question of the block takes in the table: number and date stay narrow (CW12), and texts and lists get room to read.
function cellWidth(question: FormEntryQuestion): string | undefined {
  if (question.type === "decimal" || question.type === "date") return "w-37.5 min-w-37.5";
  if (question.type === "boolean") return undefined;
  return question.type === "longText" || question.catalog ? "min-w-56" : "min-w-44";
}

/**
 * The block of rows (RG2-A): its name and its items, as a table or in boxes, each with the questions of the block. A problem of
 * an item goes under its row in the table and under its question in a box; the block's own, under the block.
 */
function EntryBlock({ entry, group, questions, draft, onChange, errors, disabled, cards, narrowClass, boxColumns, calculated }: {
  entry: FormEntry; group: FormEntryQuestion; questions: readonly FormEntryQuestion[]; draft: EntryDraft; onChange: (draft: EntryDraft) => void;
  errors: Readonly<Record<string, string>>; disabled?: boolean; cards: boolean; narrowClass?: string; boxColumns: 1 | 2 | 3; calculated: EntryCalculations;
}) {
  const formula = useEntryFormula(entry);
  const id = entryQuestionId(group.fieldId), messageId = id + "-message";
  const error = errors[group.fieldId];
  const message = error ?? group.help ?? undefined;
  // «Agregar ítem» carries the block's id: a block without its items takes the focus there.
  const list = {
    items: draft.rows?.[group.fieldId] ?? [], minItems: group.rows?.minRows ?? 0, maxItems: group.rows?.maxRows ?? 0, disabled,
    addId: id, addDescribedBy: message ? messageId : undefined,
    onAdd: () => onChange(addEntryItem(entry, draft)),
    onRemove: (key: string) => onChange(removeEntryItem(entry, draft, key)),
    onMove: (key: string, offset: -1 | 1) => onChange(moveEntryItem(entry, draft, key, offset)),
  };
  const path = (index: number, question: FormEntryQuestion) => entryItemPath(group.fieldId, index, question.fieldId);
  // LD1-A: a question that chooses first by a field takes two columns, the field's («Rubro») and its own; each item chooses its own.
  const tableColumns: ItemTableColumn[] = questions.flatMap(question => [
    ...question.catalog?.groupBy ? [{ key: groupColumn + question.fieldId, label: question.catalog.groupBy.name, required: question.required, className: "min-w-44" }] : [],
    // CA1-A: a calculation is one more column, to the right, whose (i) says how it is computed. Any other question's help goes in
    // the (i) of its column (IV1-A: «Sin IVA: …» in «Precio unitario»).
    { key: question.fieldId, label: question.label, required: question.required, numeric: question.type === "decimal", className: cellWidth(question),
      ...question.calculation ? { help: formula(question) } : question.help ? { help: question.help } : {} }]);
  return <div className="flex flex-col gap-1.5" data-entry-question={group.fieldId}>
    <Label asChild><span id={id + "-label"}>{group.label}{group.required ? <span aria-hidden="true"> *</span> : null}</span></Label>
    {cards
      ? <ItemCards {...list}>{(item, index) => questions.map(question => <EntryQuestion key={question.fieldId} entry={entry} question={question} draft={draft}
        onChange={onChange} error={errors[path(index, question)]} disabled={disabled} narrowClass={narrowClass} boxColumns={boxColumns} item={item} path={path(index, question)}
        calculated={calculated}/>)}</ItemCards>
      : <ItemTable {...list} label={group.label} columns={tableColumns} error={(_, column, index) => errors[entryItemPath(group.fieldId, index, column.key)]}
        cell={(item, column, context) => {
          const value = column.key.startsWith(groupColumn);
          const question = questions.find(current => current.fieldId === (value ? column.key.slice(groupColumn.length) : column.key))!;
          return <EntryQuestionControl entry={entry} question={question} draft={draft} onChange={onChange} disabled={disabled} boxColumns={boxColumns}
            item={item} path={path(context.index, question)} cell={context} part={value ? "group" : "options"} calculated={calculated}/>;
        }}/>}
    {message ? <p id={messageId} role={error ? "alert" : undefined} className={error ? "text-sm text-[var(--color-danger)]" : "text-sm text-[var(--color-content-muted)]"}>{message}</p> : null}
  </div>;
}

/**
 * LD1-A (2026-11-07): a question that chooses first by a field is two lists, the field's («Rubro») and its own, which waits for the
 * value and brings only its options («75 opciones de Herbicidas»). Another value clears the option; when only one value is left it
 * comes chosen. In the table each list is a column of its own; elsewhere the pair goes side by side or, in one column, stacked.
 */
function EntryGroupedCatalog({ entry, question, draft, onChange, item, id, invalid, describedBy, disabled, answers, waitingFor, answerTitle, chosen, onChoose,
  cell, part, pairInRow, label, message, messageId, error, questionKey }: {
  entry: FormEntry; question: FormEntryQuestion; draft: EntryDraft; onChange: (draft: EntryDraft) => void; item?: EntryItem; id: string; invalid: boolean;
  describedBy?: string; disabled: boolean; answers?: Readonly<Record<string, string>>; waitingFor?: string; answerTitle?: string; chosen: FormEntryOption[];
  onChoose: (chosen: FormEntryOption[]) => void; cell?: ItemCellContext; part?: "group" | "options"; pairInRow: boolean; label: ReactNode; message?: string;
  messageId: string; error?: string; questionKey: string;
}) {
  const groupBy = question.catalog!.groupBy!;
  const stored = (item ?? draft).groups?.[question.fieldId];
  const { groups, group } = useEntryGroupChoice(entry, question, stored, !disabled, answers);
  const groupId = id + "-group";
  // Choosing the value already in use, such as the only one, changes nothing.
  const choose = (next: FormEntryGroup) => { if (!group || next.id !== group.id) onChange(chooseEntryGroup(entry, draft, question.fieldId, next, item?.key)); };
  const groupField = <EntryGroupField groups={groups} value={group} onChange={choose} id={groupId} label={cell && part === "group" ? cell.label : groupBy.name}
    invalid={cell && part === "group" ? cell.invalid : undefined} describedBy={cell && part === "group" ? cell.describedBy : undefined} disabled={disabled}
    waitingFor={waitingFor} culture={entry.culture}/>;
  const optionsField = <EntryCatalogField entry={entry} question={question} chosen={chosen} id={id} label={cell?.label} invalid={invalid} describedBy={describedBy}
    disabled={disabled || !group} answers={answers} group={group} waitingFor={waitingFor ?? (group ? undefined : groupBy.name)}
    answerTitle={[answerTitle, group?.text].filter(Boolean).join(" · ") || undefined} onChange={onChoose}/>;
  if (cell) return part === "group" ? groupField : optionsField;
  return <div className={"grid gap-x-5 gap-y-3 " + (pairInRow ? "grid-cols-2" : "grid-cols-1")} data-entry-question={questionKey}>
    <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor={groupId}>{groupBy.name}</Label>{groupField}</div>
    <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor={id}>{label}</Label>{optionsField}
      {message ? <p id={messageId} role={error ? "alert" : undefined} className={error ? "text-sm text-[var(--color-danger)]" : "text-sm text-[var(--color-content-muted)]"}>{message}</p> : null}</div>
  </div>;
}

/** How a calculation of the form reads, for its (i): with a rate from a catalog it also says that it is computed on sending. */
function useEntryFormula(entry: FormEntry) {
  const { t } = useTranslation("formEntries");
  const words = useCalculationWords("formEntries");
  return (question: FormEntryQuestion) => {
    const { operands, catalogRate } = entryFormulaOperands(entry, question);
    const formula = calculationFormula(question.calculation!.operation, operands, words);
    return catalogRate ? t("calculation.withCatalogRate", { formula }) : formula;
  };
}

function EntryQuestion(props: Parameters<typeof EntryQuestionControl>[0] & { before?: string }) {
  const { t } = useTranslation("formEntries");
  const { before, ...control } = props;
  // While correcting, what the question had before goes under it in grey (CW10-A). The control keeps its place in the tree
  // when the line appears, so it keeps the focus and what is being typed.
  return <div className="flex flex-col gap-1"><EntryQuestionControl {...control}/>
    {before === undefined ? null : <p className="text-xs text-[var(--color-content-muted)]">{before === "" ? t("correction.beforeEmpty") : t("correction.before", { value: before })}</p>}</div>;
}

function EntryQuestionControl({ entry, question, draft, onChange, error, disabled, narrowClass, boxColumns, item, path, cell, pairInRow = false, part, calculated }: {
  entry: FormEntry; question: FormEntryQuestion; draft: EntryDraft; onChange: (draft: EntryDraft) => void; error?: string; disabled?: boolean;
  /** The width of number and date; without it they go across. */
  narrowClass?: string;
  /** The columns of the boxes of a multiple choice. */
  boxColumns: 1 | 2 | 3;
  /** A question of the block answers in its item (RG2-A), under its path (`entryItemPath`). */
  item?: EntryItem;
  path?: string;
  /** In a cell of the table of items: only the control, named by the table, which says its problem under the row. */
  cell?: ItemCellContext;
  /** LD1-A: the two lists of a question that chooses first by a field go side by side; otherwise, one under the other. */
  pairInRow?: boolean;
  /** LD1-A: in a cell, which of the two lists of that question the column holds. */
  part?: "group" | "options";
  /** CA1-A: what each calculation would be with what is loaded. */
  calculated?: EntryCalculations;
}) {
  const { t, i18n } = useTranslation("formEntries");
  const formula = useEntryFormula(entry);
  const key = path ?? question.fieldId;
  const id = entryQuestionId(key);
  const messageId = id + "-message";
  const values = item?.values ?? draft.values, choices = item?.choices ?? draft.choices;
  const value = values[question.fieldId] ?? "";
  // A question of an item changes only its item; a loose question, the response.
  const changed = (change: { values?: Record<string, string>; choices?: Record<string, FormEntryOption[]> }): EntryDraft => item
    ? changeEntryItem(entry, draft, item.key, current => ({ ...current, values: { ...current.values, ...change.values }, choices: { ...current.choices, ...change.choices } }))
    : { ...draft, values: { ...draft.values, ...change.values }, choices: { ...draft.choices, ...change.choices } };
  const setValue = (next: string) => onChange(changed({ values: { [question.fieldId]: next } }));
  const choose = (option?: { id: string; label: string }) => onChange(changed({ choices: { [question.fieldId]: option ? [{ id: option.id, title: option.label, description: null }] : [] } }));
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
    if (cell) return control;
    const label = labelled ? <Label htmlFor={id}>{labelText}</Label> : <Label asChild><span id={id + "-label"}>{labelText}</span></Label>;
    return <div className="flex flex-col gap-1.5" data-entry-question={key}>
      {help ? <div className="flex items-center gap-1">{label}<span className="-my-1 inline-flex"><InfoTip id={helpId} label={t("common:actions.moreInfo", { label: question.label })} text={help}/></span></div> : label}
      {control}
      {message ? <p id={messageId} role={error ? "alert" : undefined} className={error ? "text-sm text-[var(--color-danger)]" : "text-sm text-[var(--color-content-muted)]"}>{message}</p> : null}
    </div>;
  };
  const field = (control: ReactElement<{ id?: string; "aria-label"?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }>) => cell
    ? cloneElement(control, { id, "aria-label": cell.label, "aria-invalid": cell.invalid || undefined, "aria-describedby": cell.describedBy })
    : <div data-entry-question={key}>
      <FormField label={question.label} htmlFor={id} required={question.required} hint={question.help ?? undefined} error={error}>{control}</FormField>
    </div>;

  // CA1-A: a calculation is shown greyed and is not written; it changes as the numbers it uses are typed. Its (i) says how it is
  // computed; the server computes it again on sending.
  if (question.calculation) {
    const computed = (item ? calculated?.items[item.key] : calculated?.values)?.[question.fieldId];
    const control = <Input readOnly value={computed ? formatTypedValue("decimal", computed, i18n.language) ?? "" : ""}
      className={cell || !narrowClass ? "text-right" : "text-right " + narrowClass}/>;
    return cell ? cloneElement(control, { id, "aria-label": cell.label, "aria-describedby": cell.describedBy })
      : <div data-entry-question={key}><FormField label={question.label} htmlFor={id} help={formula(question)} hint={question.help ?? undefined}>{control}</FormField></div>;
  }
  if (question.catalog) {
    // A list that depends on other answers (CW7) waits for them, saying which in its field, and lists only theirs; another
    // option in a question clears the lists that depend on it.
    // In the block (LD3-A) a list waits for the answer of its own item, or the one outside the block.
    const answerOf = (fieldId: string) => item?.choices[fieldId] ?? draft.choices[fieldId];
    const answers = entryDependencyAnswers(question, draft, item);
    const waitingFor = answers ? undefined : entry.questions.find(other => question.catalog?.dependsOn?.includes(other.fieldId) && !answerOf(other.fieldId)?.length)?.label;
    const answerTitle = question.catalog.dependsOn?.map(fieldId => answerOf(fieldId)?.[0]?.title).join(" · ");
    const before = (choices[question.fieldId] ?? []).map(option => option.id).join();
    const chooseOptions = (chosen: FormEntryOption[]) => {
      const next = changed({ choices: { [question.fieldId]: chosen } });
      onChange(chosen.map(option => option.id).join() === before ? next : clearDependentChoices(entry, next, question.fieldId, item?.key));
    };
    if (question.catalog.groupBy) return <EntryGroupedCatalog entry={entry} question={question} draft={draft} onChange={onChange} item={item} id={id}
      invalid={cell ? cell.invalid : !!error} describedBy={cell ? cell.describedBy : message ? messageId : undefined} disabled={blocked || !answers}
      answers={answers ?? undefined} waitingFor={waitingFor} answerTitle={answerTitle || undefined} chosen={choices[question.fieldId] ?? []} onChoose={chooseOptions}
      cell={cell} part={part} pairInRow={pairInRow} label={labelText} message={message} messageId={messageId} error={error} questionKey={key}/>;
    return grouped(<EntryCatalogField entry={entry} question={question} chosen={choices[question.fieldId] ?? []} id={id} label={cell?.label}
      invalid={cell ? cell.invalid : !!error} describedBy={cell ? cell.describedBy : message ? messageId : undefined} disabled={blocked || !answers}
      answers={answers ?? undefined} waitingFor={waitingFor} answerTitle={answerTitle || undefined} onChange={chooseOptions}/>);
  }
  if (isFile(question)) return grouped(<EntryFilesField question={question} files={draft.files[question.fieldId] ?? []} maxFileSizeMiB={entry.maxFileSizeMiB} id={id}
    invalid={!!error} describedBy={describedBy} disabled={disabled} kept={draft.kept?.[question.fieldId]}
    onKeptChange={kept => onChange({ ...draft, kept: { ...draft.kept, [question.fieldId]: kept } })}
    onChange={files => onChange({ ...draft, files: { ...draft.files, [question.fieldId]: files } })}/>, false);
  // UB3-A: «Usar mi ubicación»; the label names the question and the point travels as the text the server reads.
  if (question.type === "location") return grouped(<EntryLocationField id={id} value={value} onChange={setValue} invalid={!!error}
    describedBy={describedBy} disabled={disabled}/>, false);
  // Up to five options in a row however long they are, and those that do not fit wrap; more, a dropdown list (AR1-A). A cell
  // of the table of items always takes the list.
  if (question.type === "choice" && (cell || !entryChoiceInRow(question))) return field(<NativeSelect value={choices[question.fieldId]?.[0]?.id ?? ""} disabled={disabled}
    onChange={event => choose(question.options?.find(option => option.id === event.target.value))}>
    <option value="">{t("page.choose")}</option>
    {(question.options ?? []).map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
  </NativeSelect>);
  if (question.type === "choice") return grouped(<div id={id} tabIndex={-1} className="outline-none">
    <RadioGroupField label={question.label} layout="row" value={choices[question.fieldId]?.[0]?.id}
      options={(question.options ?? []).map(option => ({ value: option.id, label: option.label, disabled }))}
      onValueChange={choice => choose(question.options?.find(item => item.id === choice))}/>
  </div>, false);
  if (question.type === "multiChoice") {
    const chosen = choices[question.fieldId] ?? [];
    const max = question.selection?.maxSelected ?? 20;
    return grouped(<div id={id} tabIndex={-1} role="group" aria-labelledby={id + "-label"} className={"gap-x-5 outline-none " + boxColumnsClass[boxColumns]}>
      {(question.options ?? []).map(option => {
        const checked = chosen.some(item => item.id === option.id);
        return <div key={option.id} className="break-inside-avoid pb-1"><CheckboxField label={option.label} checked={checked} disabled={disabled || !checked && chosen.length >= max}
          onCheckedChange={next => onChange(changed({ choices: { [question.fieldId]: next
            ? [...chosen, { id: option.id, title: option.label, description: null }] : chosen.filter(current => current.id !== option.id) } }))}/></div>;
      })}
    </div>, false);
  }
  if (question.type === "boolean") return grouped(<div id={id} tabIndex={-1} className="outline-none">
    <SegmentedControl aria-label={cell?.label ?? question.label} options={[
      { key: "true", label: t("sent.yes"), pressed: value === "true", onSelect: () => setValue("true") },
      { key: "false", label: t("sent.no"), pressed: value === "false", onSelect: () => setValue("false") },
    ]}/>
  </div>, false);
  // In a cell, the long text starts as high as a field and grows with what is written, and a number goes to the right.
  if (question.type === "longText") return field(<Textarea value={value} maxLength={question.maxLength ?? undefined} rows={cell ? 1 : entryTextRows(question)}
    className={cell ? "min-h-[var(--height-control)] py-1" : undefined} disabled={disabled} onChange={event => setValue(event.target.value)}/>);
  const narrow = question.type === "decimal" || question.type === "date";
  return field(<Input value={value} disabled={disabled} className={cell ? question.type === "decimal" ? "text-right" : undefined : narrow ? narrowClass : undefined}
    type={question.type === "date" ? "date" : "text"} inputMode={question.type === "decimal" ? "decimal" : undefined}
    maxLength={question.type === "shortText" ? question.maxLength ?? undefined : undefined} onChange={event => setValue(event.target.value)}/>);
}
