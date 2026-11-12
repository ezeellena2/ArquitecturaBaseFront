import type { CatalogField } from "./api/catalogResponse";
import type { FormDocumentReadingExample } from "./api/documentReading";
import { questionIdentity } from "./dependentLists";
import { localizedValue } from "./editorModel";
import type { DraftEditorValue, DraftQuestion, FormCulture, FormDocumentReading } from "./model";
import { questionNumbers } from "./rowsQuestions";

// DOC1: «Lectura de documentos», a setting of the form that travels with the draft like «Dónde se completa». A lookup names its
// questions like a filter by another answer: by the field identity once saved, by the local one while new (the server seals it).

export const maxDocumentLookups = 5;

/**
 * The draft with this reading. The key keeps its place, so turning it off and on again leaves the draft as it was saved. Off, a lookup
 * left half chosen goes, since nothing would say what it lacks; and without a text and without lookups it is no reading at all and the
 * key goes, as the server leaves it.
 */
export function changeDocumentReading(value: DraftEditorValue, reading: FormDocumentReading): DraftEditorValue {
  const lookups = reading.enabled ? reading.lookups : reading.lookups.filter(lookup => !incomplete(lookup));
  const { documentReading: _previous, ...rest } = value.draft;
  if (!reading.enabled && reading.recognition === "" && lookups.length === 0) return { ...value, draft: rest };
  return { ...value, draft: { ...value.draft, documentReading: { enabled: reading.enabled, recognition: reading.recognition,
    lookups: lookups.map(lookup => ({ questionId: lookup.questionId, sourceQuestionId: lookup.sourceQuestionId, field: lookup.field })) } } };
}

const incomplete = (lookup: FormDocumentReading["lookups"][number]) => !lookup.questionId || !lookup.sourceQuestionId || !lookup.field;
/** A lookup added and not yet complete: it cannot be saved, so Guardar stops on it (like a calculation without its questions). */
export const documentLookupsIncomplete = (reading: FormDocumentReading | undefined) => !!reading?.lookups.some(incomplete);
/** On, «Cómo reconocerlo» is required and every lookup complete: Guardar stops on what is missing and the zone says what it is. */
export const documentReadingIncomplete = (reading: FormDocumentReading | undefined) => !!reading?.enabled && (!reading.recognition.trim() || documentLookupsIncomplete(reading));

/** Completed only in the app the reading does not show: a lookup left half chosen goes, and what was saved stays. */
export function withoutIncompleteLookups(value: DraftEditorValue): DraftEditorValue {
  const reading = value.draft.documentReading;
  return reading && documentLookupsIncomplete(reading) ? changeDocumentReading(value, { ...reading, lookups: reading.lookups.filter(lookup => !incomplete(lookup)) }) : value;
}

export interface LookupQuestion {
  readonly id: string;
  readonly number: string;
  readonly label: string;
  readonly type: DraftQuestion["type"];
  /** The catalog of a question to fill. */
  readonly catalog?: string;
}
const repeated = (question: DraftQuestion) => "repeated" in question && question.repeated === true;
const readable: readonly DraftQuestion["type"][] = ["shortText", "longText", "decimal", "date"];
// What a lookup reads, a text, a number or a date; and the catalog it fills, of a question of one choice. Both outside the block, as
// the server asks.
const readsFrom = (question: DraftQuestion) => !repeated(question) && readable.includes(question.type);
const fillsCatalog = (question: DraftQuestion) => !repeated(question) && question.type === "choice" && question.source?.catalog ? question.source.catalog : null;

/** What a lookup can name, in the order of the list: what it reads and what it fills, with its catalog. */
export function lookupQuestions(fields: readonly DraftQuestion[], culture: FormCulture, original: FormCulture) {
  const numbers = questionNumbers(fields);
  const entry = (question: DraftQuestion, index: number, catalog?: string): LookupQuestion =>
    ({ id: questionIdentity(question), number: numbers[index]!, label: localizedValue(question.label, culture, original), type: question.type, ...catalog ? { catalog } : {} });
  return {
    sources: fields.flatMap((question, index) => readsFrom(question) ? [entry(question, index)] : []),
    targets: fields.flatMap((question, index) => { const catalog = fillsCatalog(question); return catalog ? [entry(question, index, catalog)] : []; }),
  };
}

/**
 * Never a lookup that names a question no longer there or no longer of its kind (DOC1): removed, with another identity (another type
 * or, once saved, another catalog), gone into the block or a catalog question that stopped being one of one choice. On, off or hidden,
 * the lookup goes with it, so saving never fails on what the zone may not show; one still being chosen stays.
 */
export function withoutDanglingLookups(value: DraftEditorValue): DraftEditorValue {
  const reading = value.draft.documentReading;
  if (!reading?.lookups.length) return value;
  const names = (id: string, fits: (question: DraftQuestion) => boolean) => {
    const question = id ? value.draft.fields.find(item => questionIdentity(item).toLowerCase() === id.toLowerCase()) : undefined;
    return !id || !!question && fits(question);
  };
  const lookups = reading.lookups.filter(lookup => names(lookup.questionId, question => fillsCatalog(question) !== null) && names(lookup.sourceQuestionId, readsFrom));
  return lookups.length === reading.lookups.length ? value : changeDocumentReading(value, { ...reading, lookups });
}

/** The name of a question of the draft by its identity; null when it is no longer there. */
export function readingQuestionName(fields: readonly DraftQuestion[], id: string, culture: FormCulture, original: FormCulture): string | null {
  const question = fields.find(item => questionIdentity(item).toLowerCase() === id.toLowerCase());
  return question ? localizedValue(question.label, culture, original) : null;
}

export type LookupComparison = { readonly value: "code" | "text"; readonly field?: undefined } | { readonly value: string; readonly field: CatalogField };
const byOption = (type: string | null) => type === null || type === "shortText" || type === "longText";
// What the server compares (FormPublicationGuard): a text with a text field, a number with a whole or decimal one, a date with a date.
const comparable = (field: CatalogField, type: string | null) => field.type === "text" ? byOption(type)
  : field.type === "integer" || field.type === "decimal" ? type === null || type === "decimal" : field.type === "date" ? type === null || type === "date" : false;

/** What of the catalog a lookup compares with what it read: the option's code or text (a text only) or an active field of its kind. */
export function lookupComparisons(sourceType: string | null, fields: readonly CatalogField[]): readonly LookupComparison[] {
  return [...byOption(sourceType) ? [{ value: "code" as const }, { value: "text" as const }] : [],
    ...fields.filter(field => field.isActive && comparable(field, sourceType)).map(field => ({ value: field.id, field }))];
}

/**
 * What a lookup still compares after what it reads or fills changed: the option's code or text while it reads a text, a field of the
 * catalog while it can be compared; otherwise it is chosen again. Without the catalog's fields (they could not be read) a field stays.
 */
export function keptComparison(field: string, sourceType: string | null, catalogFields: readonly CatalogField[] | undefined): string {
  if (field === "" || field !== "code" && field !== "text" && !catalogFields) return field;
  return lookupComparisons(sourceType, catalogFields ?? []).some(item => item.value === field) ? field : "";
}

/**
 * The data a library standard reads, in its order, each with the question of the copy that receives it, found through the key of
 * `standard.bound` («Agregar» sealed it, BI1-A, so a renamed or moved question still receives it), and the fixed validation that
 * question carries. A datum whose question is no longer in the draft has neither.
 */
export function standardDataRows(reads: readonly { readonly key: string; readonly name: string }[], bound: Readonly<Record<string, string>>, fields: readonly DraftQuestion[]) {
  return reads.map(read => {
    const fieldId = bound[read.key]?.toLowerCase();
    const question = fieldId ? fields.find(item => item.fieldId?.toLowerCase() === fieldId) ?? null : null;
    return { key: read.key, name: read.name, question, validation: question && "validation" in question ? question.validation ?? null : null };
  });
}

/** The share of what a question read that was confirmed without changes, rounded down: never all of it when something was corrected. */
export const unchangedShare = (unchanged: number, read: number) => Math.floor(unchanged * 100 / read) / 100;

/** The latest corrections, one group per response in the order they came, so its number and date are said once. */
export function groupReadingExamples(examples: readonly FormDocumentReadingExample[]) {
  const groups: { recordId: string; recordNumber: string; confirmedAtUtc: string; items: FormDocumentReadingExample[] }[] = [];
  for (const example of examples) {
    const last = groups.at(-1);
    if (last?.recordId === example.recordId) last.items.push(example);
    else groups.push({ recordId: example.recordId, recordNumber: example.recordNumber, confirmedAtUtc: example.confirmedAtUtc, items: [example] });
  }
  return groups;
}
