import { calendarDateInZone } from "@/shared/lib/dateTime";
import type { PrivateFormFile } from "@/shared/api/formFiles";
export type ResponseType =
  | "shortText"
  | "longText"
  | "decimal"
  | "date"
  | "boolean"
  | "choice"
  | "photo"
  | "document";
export interface ResponseChoice {
  choiceId: string;
  label: string;
  catalogId?: string | null;
  catalogName?: string | null;
  detail?: string | null;
}
export type ResponseValue =
  string | boolean | ResponseChoice | PrivateFormFile[] | null;
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
  options: { id: string; label: string }[];
}
export interface ResponseCondition {
  fieldId: string;
  operator: string;
  values?: readonly string[] | null;
}
export interface ResponseFilter {
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
  for (const condition of query.conditions ?? []) {
    const type = columns.find(column => column.fieldId === condition.fieldId)?.type;
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
export function responseValueText(
  cell: ResponseCell,
  unanswered: string,
  yes: string,
  no: string,
): string {
  if (cell.state === "NotAsked") return "—";
  if (cell.state === "Unanswered") return unanswered;
  if (typeof cell.value === "boolean") return cell.value ? yes : no;
  if (typeof cell.value === "string") return cell.value;
  if (cell.value && !Array.isArray(cell.value)) return cell.value.label;
  return "";
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
