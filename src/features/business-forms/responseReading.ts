import { formatTypedValue } from "@/shared/lib/typedValue";
import type { FormEntry, FormEntryGroup, FormEntryQuestion } from "./api/entries";
import type { FormResponseEntry } from "./api/entries";
import { correctionDraft, entryQuestionWidth, entryZones, type EntryDraft } from "./entryForm";
import { responseCatalogColumnId, responseCatalogFieldText, type ResponseChoice, type ResponseItemValues, type ResponseValue } from "./responses";

/**
 * A datum of the options chosen in a catalog question, read as a field of its own named «Pregunta · Dato», like the column
 * «Artículo · Rubro» of the sheet: nothing goes under another datum (VF1-A, 2026-11-22).
 */
export interface ReadingDatum { readonly key: string; readonly question: FormEntryQuestion; readonly fieldId: string; readonly label: string }
/** What the reading of a response draws in a place of the grid or in a column of the block: a question or a datum of its options. */
export type ReadingField = { readonly kind: "question"; readonly question: FormEntryQuestion } | { readonly kind: "datum"; readonly datum: ReadingDatum };
/** A folding zone of the reading, the same as the load's (CW16, CW15-B), with its fields in order. */
export interface ReadingZone { readonly key: string; readonly title?: string; readonly fields: readonly ReadingField[] }
/** An answer as the detail reads it, by question. */
interface ReadingValue { readonly fieldId: string; readonly value: ResponseValue }

const isChoice = (value: unknown): value is ResponseChoice => typeof value === "object" && value !== null && "choiceId" in value;

/** The options an answer chose: one, several or none. */
export function readingChoices(value: ResponseValue | undefined): readonly ResponseChoice[] {
  if (Array.isArray(value)) return value.filter(isChoice);
  return isChoice(value) ? [value] : [];
}

// The data of the options that read as fields of their own, in the order they first appear. Not the one that filters a list that
// depends on another answer (CW7), whose value is that answer, nor the field chosen first (LD1-A), which has its own control.
function readingData(question: FormEntryQuestion, chosen: readonly ResponseChoice[]): ReadingDatum[] {
  if (!question.catalog) return [];
  const data = new Map<string, ReadingDatum>();
  for (const option of chosen) for (const field of option.fields ?? []) {
    if (field.role === "filter" || field.fieldId === question.catalog.groupBy?.fieldId || data.has(field.fieldId)) continue;
    data.set(field.fieldId, { key: responseCatalogColumnId(question.fieldId, field.fieldId), question, fieldId: field.fieldId, label: question.label + " · " + field.label });
  }
  return [...data.values()];
}

const withData = (question: FormEntryQuestion, chosen: readonly ResponseChoice[]): ReadingField[] =>
  [{ kind: "question", question }, ...readingData(question, chosen).map(datum => ({ kind: "datum" as const, datum }))];

/**
 * The zones of the reading: the load's, without what the answers' conditions hide (CO1-A), and each catalog question followed
 * by the data of the options it chose.
 */
export function readingZones(entry: FormEntry, draft: EntryDraft, values: readonly ReadingValue[]): ReadingZone[] {
  const answers = new Map(values.map(value => [value.fieldId, value.value]));
  return entryZones(entry, draft).map(zone => ({ key: zone.key, title: zone.title,
    fields: zone.questions.flatMap(question => withData(question, readingChoices(answers.get(question.fieldId)))) }));
}

/** The columns of the block in the reading: each question and, after a catalog one, the data its items chose; nothing more if none did. */
export function readingBlockColumns(questions: readonly FormEntryQuestion[], items: readonly ResponseItemValues[]): ReadingField[] {
  return questions.flatMap(question => withData(question,
    items.flatMap(item => readingChoices(item.values.find(value => value.fieldId === question.fieldId)?.value))));
}

/**
 * The fields in rows of the columns in use, as the load places its questions (CW16): a question takes the columns of its type and
 * each datum one. A question goes in the same row as its data, so it starts another row when they do not fit together.
 */
export function readingRows(fields: readonly ReadingField[], columns: 1 | 2 | 3): ReadingField[][] {
  const rows: ReadingField[][] = [];
  let used: number = columns;
  fields.forEach((field, index) => {
    const width = field.kind === "question" ? entryQuestionWidth(field.question, columns) : 1;
    let together = width;
    for (let next = index + 1; field.kind === "question" && next < fields.length && fields[next].kind === "datum"; next++) together++;
    if (used + Math.min(together, columns) > columns) { rows.push([]); used = 0; }
    rows[rows.length - 1].push(field);
    used += width;
  });
  return rows;
}

/** A datum as the options chosen have it, by comma, in the language of the menu; empty when none has it. */
export function readingDatumText(chosen: readonly ResponseChoice[], fieldId: string, culture: string, yes: string, no: string): string {
  return chosen.flatMap(option => (option.fields ?? []).filter(field => field.fieldId === fieldId)
    .map(field => responseCatalogFieldText(field, culture, yes, no))).join(", ");
}

/**
 * What a question's control shows when reading: the text, the number and the date in the language of the menu, Sí or No, or
 * the options chosen by comma (DS2-A); empty when it was not answered, as the control of the load starts.
 */
export function readingText(question: FormEntryQuestion, value: ResponseValue | undefined, culture: string, yes: string, no: string): string {
  if (question.type === "choice" || question.type === "multiChoice") return readingChoices(value).map(option => option.label).join(", ");
  if (question.type === "boolean") return value === true ? yes : value === false ? no : "";
  if (typeof value !== "string") return "";
  return question.type === "decimal" || question.type === "date" ? formatTypedValue(question.type, value, culture) ?? value : value;
}

/** The answers of a response in the shape of its form, as a draft: what its conditions read to say what is not drawn. */
export function readingDraft(record: { id: string; number: string; entry: FormResponseEntry }, culture: string): EntryDraft {
  return correctionDraft({ ...record.entry, recordId: record.id, number: record.number }, culture);
}

/** LD1-A: the field chosen first, as the option had it when saved; without it, what the draft brought. */
export function readingGroupText(question: FormEntryQuestion, chosen: readonly ResponseChoice[], group: FormEntryGroup | undefined, culture: string,
  yes: string, no: string): string {
  const groupBy = question.catalog?.groupBy;
  if (!groupBy) return "";
  return readingDatumText(chosen, groupBy.fieldId, culture, yes, no) || group?.text || "";
}
