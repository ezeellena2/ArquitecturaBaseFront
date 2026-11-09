import type { CatalogFieldType } from "./catalogFields";
import type { CatalogValueType } from "./catalogValues";
import { calendarDateInZone } from "@/shared/lib/dateTime";
import { formatTypedValue, formatYesNo } from "@/shared/lib/typedValue";
import type { PrivateFormFile } from "@/shared/api/formFiles";
export type ResponseType =
  | "shortText"
  | "longText"
  | "decimal"
  | "date"
  | "boolean"
  | "choice"
  | "multiChoice"
  | "photo"
  | "document"
  | "group";
export interface ResponseCatalogField { readonly fieldId: string; readonly key: string; readonly label: string; readonly type: CatalogFieldType; readonly role: "data" | "filter" }
export interface ResponseCapturedCatalogField extends Omit<ResponseCatalogField, "key"> { readonly value: string; readonly text?: string }
export interface ResponseCatalogFieldSelection { readonly questionId: string; readonly fieldId: string }
export interface ResponseColumnDescriptor { readonly id: string; readonly question: ResponseColumn; readonly catalogField?: ResponseCatalogField }
export interface ResponseChoice {
  choiceId: string;
  label: string;
  catalogId?: string | null;
  catalogName?: string | null;
  detail?: string | null;
  value?: string;
  valueType?: Exclude<CatalogValueType, "Text">;
  fields?: readonly ResponseCapturedCatalogField[];
}
/** An item of a block of rows in the sheet: one cell per question of the block's column, in its order. */
export interface ResponseItemCells { readonly cells: readonly ResponseCell[] }
/** An item of a block of rows in the detail: every question of the block in its version, with null where it was left empty. */
export interface ResponseItemValues {
  readonly values: readonly { readonly fieldId: string; readonly key: string; readonly type: ResponseType; readonly label: string; readonly value: ResponseValue }[];
}
export type ResponseValue =
  string | boolean | ResponseChoice | ResponseChoice[] | PrivateFormFile[] | readonly ResponseItemCells[] | readonly ResponseItemValues[] | null;
export interface ResponseCell {
  fieldId: string;
  type: ResponseType;
  state: "NotAsked" | "Unanswered" | "Answered";
  value: ResponseValue;
}
export interface ResponseColumn {
  fieldId: string;
  type: ResponseType;
  label: string;
  introducedInVersion: number;
  valueType?: Exclude<CatalogValueType, "Text">;
  options: { id: string; label: string }[];
  fields?: readonly ResponseCatalogField[];
  /** The questions of a block of rows; only on its column. */
  questions?: readonly ResponseColumn[];
}
/** Every question that a condition can name: the columns and the questions of a block, which filter by any item. */
export function responseQuestionColumns(columns: readonly ResponseColumn[]): readonly ResponseColumn[] {
  return columns.flatMap(column => [column, ...(column.questions ?? [])]);
}
/**
 * How many items a block has: the sheet says «3 ítems» and its items are read in the response (UD4, 2026-11-09, which
 * replaces the first values of RG4-A). Only for a block with items: otherwise the cell reads like any other.
 */
export function responseRowsSummary(cell: ResponseCell): { readonly count: number } | null {
  if (cell.type !== "group" || cell.state !== "Answered" || !Array.isArray(cell.value)) return null;
  return { count: (cell.value as readonly object[]).filter((item): item is ResponseItemCells => "cells" in item).length };
}
export interface ResponseCondition {
  fieldId: string;
  operator: string;
  values?: readonly string[] | null;
}
export type ResponseState = "Received" | "PendingApproval" | "Approved" | "Rejected" | "Voided";
export interface ResponseFilter {
  state?: ResponseState | null;
  /** Only what was loaded in the app (true) or only what arrived through a channel (false). */
  enteredInApp?: boolean | null;
  search?: string;
  actorIds?: readonly string[];
  receivedFromUtc?: string;
  receivedToUtc?: string;
  conditions?: readonly ResponseCondition[];
}
export interface ResponseQuery extends ResponseFilter {
  page: number;
  pageSize: number;
  sort?: string;
  sortFieldId?: string;
  versionIds?: readonly string[];
}
export function normalizeResponseQuery(
  query: ResponseQuery,
  columns: readonly ResponseColumn[],
): ResponseQuery | null {
  const conditions: ResponseCondition[] = [];
  const questions = responseQuestionColumns(columns);
  for (const condition of query.conditions ?? []) {
    const type = questions.find(column => column.fieldId === condition.fieldId)?.type;
    const values = condition.values?.map(value => value.trim());
    if (type === "decimal" && values?.some(value => !/^[-+]?\d+([.,]\d+)?$/.test(value))) return null;
    if (condition.operator === "contains" && values?.every(value => !value)) continue;
    conditions.push({ ...condition, values: type === "decimal" ? values?.map(value => value.replace(",", ".")) : values ?? condition.values });
  }
  return { ...query, search: query.search?.trim() || undefined, conditions };
}
export function visibleResponseColumns(
  columns: readonly ResponseColumn[],
  selection: string | null,
): readonly ResponseColumn[] {
  if (selection === null) return columns;
  const ids = new Set(selection.split(","));
  return columns.filter((column) => ids.has(column.fieldId));
}
export const responseCatalogColumnId = (questionId: string, fieldId: string) => `${questionId}:${fieldId}`;
export function responseColumnDescriptors(columns: readonly ResponseColumn[]): readonly ResponseColumnDescriptor[] {
  return columns.flatMap(question => [{ id: question.fieldId, question }, ...(question.fields ?? []).map(catalogField => ({ id: responseCatalogColumnId(question.fieldId, catalogField.fieldId), question, catalogField }))]);
}
export function visibleResponseColumnDescriptors(columns: readonly ResponseColumn[], selection: string | null): readonly ResponseColumnDescriptor[] {
  const selected = selection === null ? null : new Set(selection.split(","));
  return responseColumnDescriptors(columns).filter(column => selected ? selected.has(column.id) : !column.catalogField || column.catalogField.role === "data");
}
export function responseColumnSelection(columns: readonly ResponseColumn[], ids: readonly string[]): string | null {
  const selected = new Set(ids);
  const ordered = responseColumnDescriptors(columns).filter(column => selected.has(column.id)).map(column => column.id);
  const defaults = visibleResponseColumnDescriptors(columns, null).map(column => column.id);
  return ordered.length === defaults.length && defaults.every(id => selected.has(id)) ? null : ordered.join(",") || "none";
}
export function responseCatalogFieldText(field: ResponseCapturedCatalogField, culture: string, yes: string, no: string): string {
  if (field.type === "catalog") return field.text?.trim() ? field.text : "—";
  if (field.type === "boolean") return formatYesNo(field.value, { yes, no }) ?? "—";
  if (field.type === "integer" || field.type === "decimal" || field.type === "date") return formatTypedValue(field.type, field.value, culture) ?? field.value;
  return field.value || "—";
}
export function responseCatalogFieldCellText(cell: ResponseCell, fieldId: string, culture: string, yes: string, no: string): string {
  const values = selectedResponseChoices(cell).map(choice => choice.fields?.find(field => field.fieldId === fieldId));
  return values.some(value => value !== undefined) ? values.map(value => value ? responseCatalogFieldText(value, culture, yes, no) : "—").join(", ") : "—";
}
export function selectedResponseChoices(cell: ResponseCell): readonly ResponseChoice[] {
  if (cell.state !== "Answered") return [];
  const values = cell.value;
  if (cell.type === "multiChoice" && Array.isArray(values)
    && values.every((value): value is ResponseChoice => "choiceId" in value)) return values;
  return cell.type === "choice" && values !== null && typeof values === "object"
    && !Array.isArray(values) && "choiceId" in values ? [values] : [];
}

export function responseFiles(cell: Pick<ResponseCell, "type" | "value">): readonly PrivateFormFile[] {
  const values = cell.value;
  return (cell.type === "photo" || cell.type === "document") && Array.isArray(values)
    && values.every((value): value is PrivateFormFile => "fileId" in value) ? values : [];
}

export function responseValueText(
  cell: ResponseCell,
  unanswered: string,
  yes: string,
  no: string,
): string {
  if (cell.state === "NotAsked") return "—";
  if (cell.state === "Unanswered") return unanswered;
  if (typeof cell.value === "boolean") return formatYesNo(cell.value, { yes, no }) ?? "—";
  if (typeof cell.value === "string") return cell.value;
  return selectedResponseChoices(cell).map(choice => choice.label).join(", ");
}

export function receivedDateBoundary(
  date: string,
  zone: string,
  after = false,
): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const target = new Date(date + "T00:00:00.000Z");
  if (
    Number.isNaN(target.getTime()) ||
    target.toISOString().slice(0, 10) !== date
  )
    return undefined;
  if (after) target.setUTCDate(target.getUTCDate() + 1);
  const calendar = target.toISOString().slice(0, 10);
  let low = target.getTime() - 36 * 3600000;
  let high = target.getTime() + 36 * 3600000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (calendarDateInZone(new Date(middle).toISOString(), zone) < calendar)
      low = middle + 1;
    else high = middle;
  }
  return calendarDateInZone(new Date(low).toISOString(), zone) === calendar
    ? new Date(low).toISOString()
    : undefined;
}
export function replaceResponseCondition(
  conditions: readonly ResponseCondition[],
  fieldId: string,
  operator: string,
  values: readonly string[] | null,
): readonly ResponseCondition[] {
  const others = conditions.filter(
    (condition) =>
      condition.fieldId !== fieldId || condition.operator !== operator,
  );
  return values === null || values.length > 0
    ? [...others, { fieldId, operator, values }]
    : others;
}

// A decimal that normalizeResponseQuery accepts (draft rules and suggestions, or the URL) in the canonical form typedValue formats.
function canonicalDecimalCondition(value: string): string {
  const match = /^([-+]?)0*(\d+(?:[.,]\d+)?)$/.exec(value.trim());
  return match ? (match[1] === "-" ? "-" : "") + match[2].replace(",", ".") : value;
}

type Translate = (key: string, options?: Record<string, unknown>) => string;
// A condition's values as the person reads them: option labels instead of IDs, and decimals, dates and yes/no in the shared format.
// A catalog question's column has no options: its option reads by the name remembered when it was chosen (`names`).
function conditionValues(values: readonly string[] | null | undefined, column: ResponseColumn | undefined, t: Translate, language: string, names: Readonly<Record<string, string>> = {}): string[] {
  return (values ?? []).map(value => (column?.type === "choice" || column?.type === "multiChoice") ? column.options.find(option => option.id === value)?.label ?? names[value] ?? t("responses.unavailableValue") : column?.type === "boolean" ? formatYesNo(value, { yes: t("responses.yes"), no: t("responses.no") }) ?? value : column?.type === "decimal" || column?.type === "date" ? formatTypedValue(column.type, column.type === "decimal" ? canonicalDecimalCondition(value) : value, language) ?? value : value);
}

/** A question of a rule's conditions as it reads: its name and, for each condition on it, the words and the values. */
export interface ConditionQuestionSummary { readonly key: string; readonly question: string; readonly clauses: { readonly words: string; readonly values: string }[] }
/** The conditions with a value on questions of a block of rows, which one same item meets (RG5-A). */
export interface ConditionBlockSummary { readonly key: string; readonly block: string; readonly questions: ConditionQuestionSummary[] }
/**
 * The conditions of a rule as it reads (board TL2-A): «Hectáreas aplicadas desde 50», with the question, the words and the
 * values apart, so the summary can mark the question and the value. Several values of one choice read «Visita o Llamada».
 * The conditions with a value on questions of a block read in one line, in the place of the first of them (RG5-A): presence
 * looks at the whole response, so it stays apart.
 */
export function ruleConditionSummaries(conditions: readonly ResponseCondition[], columns: readonly ResponseColumn[], t: Translate, language: string) {
  const questions = responseQuestionColumns(columns);
  const lines: (ConditionQuestionSummary | ConditionBlockSummary)[] = [];
  const summary = (fieldId: string): ConditionQuestionSummary => ({ key: fieldId, question: questions.find(item => item.fieldId === fieldId)?.label ?? "", clauses: [] });
  for (const item of conditions) {
    const values = conditionValues(item.values, questions.find(column => column.fieldId === item.fieldId), t, language);
    const clause = { words: t("rules.conditionWords." + item.operator), values: values.join(item.operator === "in" ? " " + t("rules.conditionWords.or") + " " : ", ") };
    const block = ["answered", "unanswered", "notAsked"].includes(item.operator) ? undefined
      : columns.find(column => column.questions?.some(question => question.fieldId === item.fieldId));
    if (!block) {
      let line = lines.find((candidate): candidate is ConditionQuestionSummary => !("block" in candidate) && candidate.key === item.fieldId);
      if (!line) lines.push(line = summary(item.fieldId));
      line.clauses.push(clause);
      continue;
    }
    let line = lines.find((candidate): candidate is ConditionBlockSummary => "block" in candidate && candidate.key === block.fieldId);
    if (!line) lines.push(line = { key: block.fieldId, block: block.label, questions: [] });
    let entry = line.questions.find(candidate => candidate.key === item.fieldId);
    if (!entry) line.questions.push(entry = summary(item.fieldId));
    entry.clauses.push(clause);
  }
  return lines;
}

/** The chips of the sheet. `names` holds the names remembered when an option or a person was chosen in «Filtros» (PL2-A). */
export function responseFilterLabels(query: ResponseQuery, columns: readonly ResponseColumn[], t: Translate, language: string, zone = "UTC", versions: readonly { id: string; number: number }[] = [], names: Readonly<Record<string, string>> = {}) {
  const labels: { key: string; label: string }[] = [];
  const day = (valueUtc: string) => { const date = calendarDateInZone(valueUtc, zone); return formatTypedValue("date", date, language) ?? date; };
  const questions = responseQuestionColumns(columns);
  for (const fieldId of new Set(query.conditions?.map(item => item.fieldId) ?? [])) {
    const column = questions.find(item => item.fieldId === fieldId);
    const parts = query.conditions?.filter(item => item.fieldId === fieldId).map(item => {
      const values = conditionValues(item.values, column, t, language, names).join(", ");
      const operator = ({ anyOf: "anyOf", gte: "from", lte: "to", contains: "contains", answered: "answered", unanswered: "unanswered", notAsked: "notAsked" } as Record<string, string>)[item.operator];
      return [operator ? t("responses." + operator) : "", values].filter(Boolean).join(" ");
    });
    labels.push({ key: fieldId, label: [column?.label, parts?.join(" · ")].filter(Boolean).join(": ") });
  }
  if (query.state) labels.push({ key: "state", label: t("approvals.state") + ": " + t("approvals.states." + query.state) });
  if (query.enteredInApp != null) labels.push({ key: "channel", label: t("formEntries:sheet.channel") + ": " + t(query.enteredInApp ? "formEntries:sheet.channels.app" : "responses.whatsapp") });
  const person = query.actorIds?.length === 1 ? names[query.actorIds[0]] : undefined;
  if (query.actorIds?.length) labels.push({ key: "actor", label: person ? t("responses.actor") + ": " + person : t("responses.people") + " · " + query.actorIds.length });
  if (query.versionIds?.length) labels.push({ key: "version", label: t("responses.version") + ": " + query.versionIds.map(id => versions.find(item => item.id === id)?.number ?? "—").join(", ") });
  if (query.receivedFromUtc || query.receivedToUtc) labels.push({ key: "received", label: t("responses.received") + " · " + [query.receivedFromUtc ? day(query.receivedFromUtc) : "…", query.receivedToUtc ? day(new Date(Date.parse(query.receivedToUtc) - 1).toISOString()) : "…"].join(" – ") });
  if (query.search) labels.push({ key: "search", label: t("responses.search") + ": " + query.search });
  return labels;
}
