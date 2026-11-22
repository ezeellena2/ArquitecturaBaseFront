import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { PrivateFormFile } from "@/shared/api/formFiles";
import { cn } from "@/shared/lib/utils";
import { CollapsibleSection } from "@/shared/ui/CollapsibleSection";
import { FormField } from "@/shared/ui/FormField";
import { FormRecordFiles } from "@/shared/ui/FormRecordFiles";
import { ExternalLinkIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { ItemCards, ItemTable, type ItemTableColumn } from "@/shared/ui/ItemTable";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import type { FormEntry, FormEntryQuestion } from "../api/entries";
import type { ResponseDetail } from "../api/responses";
import { calculationFormula, entryFormulaOperands } from "../calculations";
import { entryAnswered, entryBlock, entryQuestionId, entryQuestionWidth, type EntryDraft } from "../entryForm";
import { useCalculationWords } from "../hooks/useCalculationWords";
import { useEntryColumns } from "../hooks/useEntryColumns";
import { formatAccuracy, formatCoordinates, mapUrl, toLocationPoint } from "../locationAnswer";
import {
  readingBlockColumns, readingChoices, readingDatumText, readingGroupText, readingRows, readingText, readingZones, type ReadingDatum, type ReadingField,
} from "../responseReading";
import { responseFiles, type ResponseItemValues, type ResponseValue } from "../responses";

type Answer = ResponseDetail["values"][number];
interface Viewer { actor: string; recordId: string; photos: readonly PrivateFormFile[]; onForbidden: () => void; onError: (error: unknown) => void }
interface Words { culture: string; yes: string; no: string }

const isFile = (question: FormEntryQuestion) => question.type === "photo" || question.type === "document";
const gridClass = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" } as const;
const widthClass = { 1: "", 2: "col-span-2", 3: "col-span-3" } as const;
// What was answered reads in the box of its control, in the text colour (`answered`); what comes from the catalog or from a
// calculation keeps the grey of a field that cannot be written (VF1-A). The point of a location goes in a box like a control's.
const boxClass = "flex h-[var(--height-control)] min-w-0 items-center gap-2 rounded-md border border-input bg-[var(--color-control-surface)] px-2.5 text-sm";
// The key of the column of the field chosen first (LD1-A), before the question's own, as in the load.
const groupColumn = "group:";

/** What a question of the block takes in the table, as in the load: number and date narrow, texts and lists with room to read. */
function cellWidth(question: FormEntryQuestion): string | undefined {
  if (question.type === "decimal" || question.type === "date") return "w-37.5 min-w-37.5";
  if (question.type === "boolean") return undefined;
  return question.type === "longText" || question.catalog ? "min-w-56" : "min-w-44";
}

/** How a calculation of the form reads, for its (i). */
function useFormula(entry: FormEntry) {
  const words = useCalculationWords("formEntries");
  return (question: FormEntryQuestion) => calculationFormula(question.calculation!.operation, entryFormulaOperands(entry, question), words);
}

/**
 * A response read with the shape of its form (VF1-A, 2026-11-22): the zones, the order and the widths of the load, each question
 * in its control with what was answered and nothing to change. What its condition hides is not drawn (CO1-A), each datum of a
 * catalog option is a field of its own («Artículo · Rubro») and the block is the load's table or boxes, without actions.
 */
export function ResponseForm({ entry, draft, record, layout, actor, photos, onForbidden, onError }: {
  entry: FormEntry; draft: EntryDraft; record: ResponseDetail; layout: "page" | "panel"; actor: string; photos: readonly PrivateFormFile[];
  onForbidden: () => void; onError: (error: unknown) => void;
}) {
  const { t, i18n } = useTranslation("formEntries");
  const [folded, setFolded] = useState<Readonly<Record<string, boolean>>>({});
  const { measured, columns } = useEntryColumns(layout);
  const answers = new Map(record.values.map(value => [value.fieldId, value]));
  const block = entryBlock(entry);
  const viewer: Viewer = { actor, recordId: record.id, photos, onForbidden, onError };
  const words: Words = { culture: i18n.language, yes: t("sent.yes"), no: t("sent.no") };
  // Number and date stay narrow (CW12), as in the load.
  const narrowClass = layout === "panel" ? "w-full sm:w-37.5" : columns === 1 ? undefined : "w-full max-w-37.5";
  const title = (key: string, zoneTitle?: string) => zoneTitle ?? (key === "files" ? t("page.files") : t("page.data"));
  // Folded, a zone says how many of its questions were answered, without counting the calculations.
  const summary = (fields: readonly ReadingField[]) => {
    const questions = fields.flatMap(field => field.kind === "question" && !field.question.calculation ? [field.question] : []);
    return t("zone.answered", { count: questions.filter(question => entryAnswered(question, draft)).length, total: questions.length });
  };
  const place = (field: ReadingField) => {
    if (field.kind === "datum") return <ReadingDatumField datum={field.datum} answer={answers.get(field.datum.question.fieldId)} words={words}/>;
    const question = field.question;
    if (question.type === "group" && block) return <ReadingBlock entry={entry} group={question} questions={block.questions}
      answer={answers.get(question.fieldId)} cards={columns === 1} words={words}/>;
    return <ReadingQuestion entry={entry} question={question} answer={answers.get(question.fieldId)} draft={draft} narrowClass={narrowClass}
      pairInRow={columns > 1} words={words} viewer={viewer}/>;
  };
  return <div ref={measured} className="flex flex-col gap-4">{readingZones(entry, draft, record.values).map(zone =>
    <CollapsibleSection key={zone.key} title={title(zone.key, zone.title)} open={!folded[zone.key]}
      onOpenChange={open => setFolded(current => ({ ...current, [zone.key]: !open }))} expandLabel={t("zone.expand", { name: title(zone.key, zone.title) })}
      collapseLabel={t("zone.collapse", { name: title(zone.key, zone.title) })} summary={summary(zone.fields)}>
      <div className="divide-y divide-[var(--color-border)]">{readingRows(zone.fields, columns).map(row =>
        <div key={row[0].kind === "question" ? row[0].question.fieldId : row[0].datum.key} data-entry-row className={"grid gap-x-5 gap-y-3 px-4 py-3 " + gridClass[columns]}>
          {row.map(field => <div key={field.kind === "question" ? field.question.fieldId : field.datum.key}
            className={"min-w-0 " + widthClass[field.kind === "question" ? entryQuestionWidth(field.question, columns) : 1]}>{place(field)}</div>)}
        </div>)}</div>
    </CollapsibleSection>)}</div>;
}

/** A datum of the option chosen, in a field of its own and in grey, because it comes from the catalog. */
function ReadingDatumField({ datum, answer, words }: { datum: ReadingDatum; answer?: Answer; words: Words }) {
  const id = entryQuestionId(datum.key);
  return <FormField label={datum.label} htmlFor={id}>
    <Input readOnly id={id} value={readingDatumText(readingChoices(answer?.value), datum.fieldId, words.culture, words.yes, words.no)}/>
  </FormField>;
}

function ReadingQuestion({ entry, question, answer, draft, narrowClass, pairInRow, words, viewer }: {
  entry: FormEntry; question: FormEntryQuestion; answer?: Answer; draft: EntryDraft; narrowClass?: string; pairInRow: boolean; words: Words; viewer: Viewer;
}) {
  const { t } = useTranslation("forms");
  const formula = useFormula(entry);
  const id = entryQuestionId(question.fieldId);
  const value = answer?.value ?? null;
  if (isFile(question)) {
    const files = answer ? responseFiles(answer) : [];
    return <div className="flex flex-col gap-1.5">
      <Label asChild><span id={id + "-label"}>{question.label}</span></Label>
      {files.length ? <FormRecordFiles actor={viewer.actor} recordId={viewer.recordId} files={files} photo={question.type === "photo"} label={question.label}
        thumbnailLimit={files.length} viewerFiles={viewer.photos} onForbidden={viewer.onForbidden} onError={viewer.onError}/>
        : <p className="text-sm text-[var(--color-content-muted)]">{t("responses.unanswered")}</p>}
    </div>;
  }
  // UB4-A: a point reads in one line, its accuracy beside it in grey and the map, which opens in another tab.
  if (question.type === "location") {
    const point = toLocationPoint(value);
    return <div className="flex flex-col gap-1.5">
      <Label asChild><span id={id + "-label"}>{question.label}</span></Label>
      <div role="group" aria-labelledby={id + "-label"} className={boxClass}>{point ? <>
        <span className="truncate tabular-nums">{formatCoordinates(point)}</span>
        {point.accuracyMeters !== undefined ? <span className="shrink-0 text-[var(--color-content-muted)]">{formatAccuracy(point.accuracyMeters, words.culture)}</span> : null}
        <a href={mapUrl(point)} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex shrink-0 items-center gap-1 text-[var(--color-brand-700)] underline">
          {t("responses.viewOnMap")}<ExternalLinkIcon className="size-3.5 shrink-0"/></a>
      </> : null}</div>
    </div>;
  }
  const chosen = readingChoices(value);
  const text = readingText(question, value, words.culture, words.yes, words.no);
  // LD1-A: the field chosen first («Rubro») and the question go side by side, as in the load.
  if (question.catalog?.groupBy) {
    const groupId = id + "-group";
    return <div className={"grid gap-x-5 gap-y-3 " + (pairInRow ? "grid-cols-2" : "grid-cols-1")}>
      <FormField label={question.catalog.groupBy.name} htmlFor={groupId}>
        <Input readOnly answered id={groupId}
          value={readingGroupText(question, chosen, draft.groups?.[question.fieldId], words.culture, words.yes, words.no)}/>
      </FormField>
      <FormField label={question.label} htmlFor={id}><Input readOnly answered id={id} value={text}/></FormField>
    </div>;
  }
  const narrow = question.type === "decimal" || question.type === "date";
  const control = question.type === "longText" ? <Textarea readOnly id={id} value={text}/>
    : <Input readOnly answered={!question.calculation} id={id} value={text} className={cn(question.type === "decimal" && "text-right", narrow && narrowClass)}/>;
  return <FormField label={question.label} htmlFor={id} help={question.calculation ? formula(question) : undefined}>{control}</FormField>;
}

/** The block of rows (RG2-A) with what each item answered: the load's table, or its boxes in one column, without actions. */
function ReadingBlock({ entry, group, questions, answer, cards, words }: {
  entry: FormEntry; group: FormEntryQuestion; questions: readonly FormEntryQuestion[]; answer?: Answer; cards: boolean; words: Words;
}) {
  const { t } = useTranslation("forms");
  const formula = useFormula(entry);
  const rows = (Array.isArray(answer?.value) ? answer.value : []) as readonly ResponseItemValues[];
  const label = <Label asChild><span id={entryQuestionId(group.fieldId) + "-label"}>{group.label}</span></Label>;
  if (!rows.length) return <div className="flex flex-col gap-1.5">{label}<p className="text-sm text-[var(--color-content-muted)]">{t("responses.unanswered")}</p></div>;
  const fields = readingBlockColumns(questions, rows);
  const valueOf = (row: ResponseItemValues, fieldId: string): ResponseValue => row.values.find(value => value.fieldId === fieldId)?.value ?? null;
  // Each column says what it holds: a question, the field chosen first of one, or a datum of its options.
  const columns: (ItemTableColumn & { text: (row: ResponseItemValues) => string; answered: boolean })[] = fields.flatMap(field => {
    if (field.kind === "datum") return [{ key: field.datum.key, label: field.datum.label, className: "min-w-44", answered: false,
      text: (row: ResponseItemValues) => readingDatumText(readingChoices(valueOf(row, field.datum.question.fieldId)), field.datum.fieldId, words.culture, words.yes, words.no) }];
    const question = field.question;
    return [
      ...question.catalog?.groupBy ? [{ key: groupColumn + question.fieldId, label: question.catalog.groupBy.name, className: "min-w-44", answered: true,
        text: (row: ResponseItemValues) => readingGroupText(question, readingChoices(valueOf(row, question.fieldId)), undefined, words.culture, words.yes, words.no) }] : [],
      { key: question.fieldId, label: question.label, numeric: question.type === "decimal", className: cellWidth(question), answered: !question.calculation,
        ...question.calculation ? { help: formula(question) } : {},
        text: (row: ResponseItemValues) => readingText(question, valueOf(row, question.fieldId), words.culture, words.yes, words.no) },
    ];
  });
  const items = rows.map((row, index) => ({ key: String(index), row }));
  const list = { items, minItems: 0, maxItems: items.length, onAdd: () => {}, onRemove: () => {}, onMove: () => {}, readOnly: true };
  const box = (column: (typeof columns)[number], row: ResponseItemValues, props: { id?: string; "aria-label"?: string }) =>
    <Input readOnly answered={column.answered} {...props} value={column.text(row)} className={column.numeric ? "text-right" : undefined}/>;
  return <div className="flex flex-col gap-1.5">
    {label}
    {cards
      ? <ItemCards {...list}>{(item, index) => columns.map(column => {
        const id = entryQuestionId(group.fieldId + "." + index + "." + column.key);
        return <FormField key={column.key} label={column.label} htmlFor={id} help={column.help}>{box(column, item.row, { id })}</FormField>;
      })}</ItemCards>
      : <ItemTable {...list} label={group.label} columns={columns} cell={(item, column, context) =>
        box(columns.find(current => current.key === column.key)!, item.row, { "aria-label": context.label })}/>}
  </div>;
}
