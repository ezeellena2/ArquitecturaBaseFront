import type { CatalogFieldType } from "./catalogFields";
import type { CatalogValueType } from "./catalogValues";
import { calendarDateInZone } from "@/shared/lib/dateTime";
import { parseSort, sortValue, type SortKind } from "@/shared/lib/sort";
import { formatTypedValue, formatYesNo } from "@/shared/lib/typedValue";
import type { PrivateFormFile } from "@/shared/api/formFiles";
import { formatCoordinates, toLocationPoint } from "./locationAnswer";
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
  | "group"
  | "location";
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
/** UB4-A: a point is one datum, with its accuracy in whole meters when it came. */
export interface ResponseLocation { readonly latitude: number; readonly longitude: number; readonly accuracyMeters?: number }
export type ResponseValue =
  string | boolean | ResponseChoice | ResponseChoice[] | PrivateFormFile[] | ResponseLocation | readonly ResponseItemCells[] | readonly ResponseItemValues[] | null;
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
/// How a question of the sheet orders (OT1-C): a number, a date or a yes/no by its value, a photo or a document by how many came
/// (the server counts them) and the rest as text.
function responseSortKind(type: ResponseType): SortKind {
  return type === "decimal" || type === "photo" || type === "document" ? "number" : type === "date" ? "date" : type === "boolean" ? "yesNo" : "text";
}
/// Whether a column of the sheet orders and how: a question by its type and a field of the catalog of a question of one option by
/// its own. A question of several options, a block and a location hold several values (or a point), and so does a field of the
/// catalog of a question of several options: they do not order (null).
export function responseColumnSortKind(question: ResponseColumn, catalogField?: ResponseCatalogField): SortKind | null {
  if (catalogField) return question.type !== "choice" ? null : catalogField.type === "integer" || catalogField.type === "decimal" ? "number"
    : catalogField.type === "date" ? "date" : catalogField.type === "boolean" ? "yesNo" : "text";
  return question.type === "multiChoice" || question.type === "group" || question.type === "location" ? null : responseSortKind(question.type);
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
  /** With `field` and `catalogField`: the question. */
  sortFieldId?: string;
  /** With `catalogField`: the field of the catalog of a question of one option. */
  sortCatalogFieldId?: string;
  /** With `result`: the id of a result column, `<source>.<key>`. */
  sortResultId?: string;
  versionIds?: readonly string[];
  /** F2: only the responses with actions to resolve. It comes from the tab in the address (`view=unresolved`), never from the bar. */
  unresolvedActions?: true;
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
// RE1-A: a result column goes in «Columnas» as result:<id>, after the questions, and shows by default.
const resultColumnPrefix = "result:";
export const responseResultColumnId = (id: string) => resultColumnPrefix + id;
export function responseColumnSelection(columns: readonly ResponseColumn[], ids: readonly string[], resultColumns: readonly { readonly id: string }[] = []): string | null {
  const selected = new Set(ids);
  const results = resultColumns.map(column => responseResultColumnId(column.id));
  const ordered = [...responseColumnDescriptors(columns).map(column => column.id), ...results].filter(id => selected.has(id));
  const defaults = [...visibleResponseColumnDescriptors(columns, null).map(column => column.id), ...results];
  return ordered.length === defaults.length && defaults.every(id => selected.has(id)) ? null : ordered.join(",") || "none";
}
export function visibleResponseResultColumns<T extends { readonly id: string }>(resultColumns: readonly T[] | undefined, selection: string | null): readonly T[] {
  if (!resultColumns) return [];
  if (selection === null) return resultColumns;
  const ids = new Set(selection.split(","));
  return resultColumns.filter(column => ids.has(responseResultColumnId(column.id)));
}
/** OT1-C: the order of the sheet as the server takes it. */
export type ResponseSort = Pick<ResponseQuery, "sort" | "sortFieldId" | "sortCatalogFieldId" | "sortResultId">;
const sortId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The id of a result column, <source>.<key>, as the server validates it.
const resultColumnIdPattern = /^[a-z][a-z0-9]*([.-][a-z0-9]+)*\.[a-z][A-Za-z0-9]{0,39}$/;
const fixedSortFields = ["number", "corrected", "submittedAtUtc", "actor", "channel", "state", "rules"];
/// The order of the address, with the ids its field needs and no other: a question (`field`) with `sortFieldId`, a field of its
/// catalog (`catalogField`) with both and a result (`result`) with `sortResultId`. One the server would refuse goes back to the
/// usual order, the newest number first.
export function responseSortFromParams(params: URLSearchParams): ResponseSort {
  const parsed = parseSort(params.get("sort"));
  if (!parsed) return { sort: "-number" };
  const sort = sortValue(parsed.field, parsed.descending);
  const question = params.get("sortFieldId") ?? "", catalogField = params.get("sortCatalogFieldId") ?? "", result = params.get("sortResultId") ?? "";
  if (fixedSortFields.includes(parsed.field)) return { sort };
  if (parsed.field === "field" && sortId.test(question)) return { sort, sortFieldId: question };
  if (parsed.field === "catalogField" && sortId.test(question) && sortId.test(catalogField)) return { sort, sortFieldId: question, sortCatalogFieldId: catalogField };
  if (parsed.field === "result" && resultColumnIdPattern.test(result)) return { sort, sortResultId: result };
  return { sort: "-number" };
}
/// The order as the table names it, by the id of its column: a fixed one by its field, a question by its identity, a field of its
/// catalog as «question:field» and a result as «result:<id>».
export function responseTableSort(sort: ResponseSort): string | undefined {
  const parsed = parseSort(sort.sort);
  if (!parsed) return undefined;
  const column = parsed.field === "field" ? sort.sortFieldId
    : parsed.field === "catalogField" ? sort.sortFieldId && sort.sortCatalogFieldId && responseCatalogColumnId(sort.sortFieldId, sort.sortCatalogFieldId)
      : parsed.field === "result" ? sort.sortResultId && responseResultColumnId(sort.sortResultId) : parsed.field;
  return column ? sortValue(column, parsed.descending) : undefined;
}
/// The other way: the order of a column of the table as the address carries it, without the ids it does not use.
export function responseSortParams(tableSort: string): { sort: string; sortFieldId: string | undefined; sortCatalogFieldId: string | undefined; sortResultId: string | undefined } {
  const parsed = parseSort(tableSort);
  const none = { sortFieldId: undefined, sortCatalogFieldId: undefined, sortResultId: undefined };
  if (!parsed) return { ...none, sort: "-number" };
  const sort = (field: string) => sortValue(field, parsed.descending);
  if (parsed.field.startsWith(resultColumnPrefix)) return { ...none, sort: sort("result"), sortResultId: parsed.field.slice(resultColumnPrefix.length) };
  const [question, catalogField] = parsed.field.split(":");
  if (catalogField !== undefined) return { ...none, sort: sort("catalogField"), sortFieldId: question, sortCatalogFieldId: catalogField };
  return sortId.test(parsed.field) ? { ...none, sort: sort("field"), sortFieldId: parsed.field } : { ...none, sort: tableSort };
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
  // UB4-A: a point reads as its coordinates, the same in every language.
  const point = cell.type === "location" ? toLocationPoint(cell.value) : null;
  if (point) return formatCoordinates(point);
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
    const label = [column?.label, parts?.join(" · ")].filter(Boolean).join(": ");
    // EX2-A: a question of the block says its block at the end, with the words of the «Filtros» panel, so its chip is not
    // confused with one of the response, and one item is enough.
    const block = columns.find(item => item.questions?.some(question => question.fieldId === fieldId));
    labels.push({ key: fieldId, label: block ? `${label} (${t("responses.inAnyItem", { block: block.label })})` : label });
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

/** Whether the sheet's search has a filter: «Respuestas» and «Tablero» tell nothing yet from nothing that matches (DOC7-A). */
export function responseHasFilters(query: ResponseQuery): boolean {
  return !!query.state || query.enteredInApp != null || !!query.search || !!query.conditions?.length || !!query.actorIds?.length
    || !!query.versionIds?.length || !!query.receivedFromUtc || !!query.receivedToUtc;
}
