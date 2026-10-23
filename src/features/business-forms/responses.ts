import type { CatalogFieldType } from "./catalogFields";
import type { CatalogValueType } from "./catalogValues";
import { formatExactDecimal } from "@/shared/lib/decimal";
import { formatDateOnly } from "@/shared/lib/dateTime";
import { calendarDateInZone } from "@/shared/lib/dateTime";
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
  | "document";
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
export type ResponseValue =
  string | boolean | ResponseChoice | ResponseChoice[] | PrivateFormFile[] | null;
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
  if (field.type === "boolean") return field.value === "true" ? yes : field.value === "false" ? no : "—";
  if (field.type === "integer" || field.type === "decimal") return formatExactDecimal(field.value, culture) ?? field.value;
  if (field.type === "date") return formatDateOnly(field.value, culture, "numeric") ?? field.value;
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
  if (typeof cell.value === "boolean") return cell.value ? yes : no;
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

export function responseFilterLabels(query: ResponseQuery, columns: readonly ResponseColumn[], t: (key: string, options?: Record<string, unknown>) => string, zone = "UTC", versions: readonly { id: string; number: number }[] = []) {
  const labels: { key: string; label: string }[] = [];
  for (const fieldId of new Set(query.conditions?.map(item => item.fieldId) ?? [])) {
    const column = columns.find(item => item.fieldId === fieldId);
    const parts = query.conditions?.filter(item => item.fieldId === fieldId).map(item => {
      const values = item.values?.map(value => (column?.type === "choice" || column?.type === "multiChoice") ? column.options.find(option => option.id === value)?.label ?? t("responses.unavailableValue") : column?.type === "boolean" ? t(value === "true" ? "responses.yes" : "responses.no") : value).join(", ");
      const operator = ({ anyOf: "anyOf", gte: "from", lte: "to", contains: "contains", answered: "answered", unanswered: "unanswered", notAsked: "notAsked" } as Record<string, string>)[item.operator];
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
