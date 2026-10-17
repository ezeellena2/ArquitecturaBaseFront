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
export type ResponseState = "Received" | "PendingApproval" | "Approved" | "Rejected";
export interface ResponseFilter {
  state?: ResponseState | null;
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

export function responseFilterLabels(query: ResponseQuery, columns: readonly ResponseColumn[], t: (key: string, options?: Record<string, unknown>) => string, zone = "UTC", versions: readonly { id: string; number: number }[] = []) {
  const labels: { key: string; label: string }[] = [];
  for (const fieldId of new Set(query.conditions?.map(item => item.fieldId) ?? [])) {
    const column = columns.find(item => item.fieldId === fieldId);
    const parts = query.conditions?.filter(item => item.fieldId === fieldId).map(item => {
      const values = item.values?.map(value => column?.type === "choice" ? column.options.find(option => option.id === value)?.label ?? t("responses.unavailableValue") : column?.type === "boolean" ? t(value === "true" ? "responses.yes" : "responses.no") : value).join(", ");
      const operator = ({ gte: "from", lte: "to", contains: "contains", answered: "answered", unanswered: "unanswered", notAsked: "notAsked" } as Record<string, string>)[item.operator];
      return [operator ? t("responses." + operator) : "", values].filter(Boolean).join(" ");
    });
    labels.push({ key: fieldId, label: [column?.label, parts?.join(" · ")].filter(Boolean).join(": ") });
  }
  if (query.state) labels.push({ key: "state", label: t("approvals.state") + ": " + t("approvals.states." + query.state) });
  if (query.actorIds?.length) labels.push({ key: "actor", label: t("responses.people") + " · " + query.actorIds.length });
  if (query.versionIds?.length) labels.push({ key: "version", label: t("responses.version") + " · " + query.versionIds.map(id => versions.find(item => item.id === id)?.number ?? "—").join(", ") });
  if (query.receivedFromUtc || query.receivedToUtc) labels.push({ key: "received", label: t("responses.received") + " · " + [query.receivedFromUtc ? calendarDateInZone(query.receivedFromUtc, zone) : "…", query.receivedToUtc ? calendarDateInZone(new Date(Date.parse(query.receivedToUtc) - 1).toISOString(), zone) : "…"].join(" – ") });
  if (query.search) labels.push({ key: "search", label: t("responses.search") + ": " + query.search });
  return labels;
}

export function responseDocumentFormat(contentType: string): string | null {
  const formats: Record<string, string> = { "application/pdf": "PDF", "text/plain": "TXT", "application/msword": "DOC", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX", "application/vnd.ms-excel": "XLS", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX" };
  return formats[contentType] ?? null;
}
