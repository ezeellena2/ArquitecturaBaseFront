import { catalogValueTypes, isCanonicalCatalogValue } from "../catalogValues";
import { catalogFieldTypes } from "./catalogResponse";
import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import type { ResponseQuery } from "../responses";
const guid = z.string().uuid();
const utc = z.iso.datetime();
const type = z.enum([
  "shortText",
  "longText",
  "decimal",
  "date",
  "boolean",
  "choice",
  "multiChoice",
  "photo",
  "document",
]);
const author = z.strictObject({
  userId: guid,
  displayName: z.string().nullable(),
});
const file = z.strictObject({
  fileId: guid,
  name: z.string(),
  contentType: z.string(),
  size: z.number().int().positive(),
  hasThumbnail: z.boolean(),
});
const fileList = z.array(file);
const catalogFieldId = guid.refine(value => value !== "00000000-0000-0000-0000-000000000000");
const catalogFieldMetadata = z.strictObject({
  fieldId: catalogFieldId,
  key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().min(1).max(120),
  type: z.enum(catalogFieldTypes),
  role: z.enum(["data", "filter"]),
});
const catalogFieldSnapshot = z.strictObject({
  fieldId: catalogFieldId,
  label: z.string().min(1).max(120),
  type: z.enum(catalogFieldTypes),
  role: z.enum(["data", "filter"]),
  value: z.string().max(300),
  text: z.string().max(300).optional(),
}).refine(field => {
  if (field.type !== "catalog" && field.text !== undefined) return false;
  if (field.type === "integer") return isCanonicalCatalogValue("Integer", field.value);
  if (field.type === "decimal") return isCanonicalCatalogValue("Decimal", field.value);
  if (field.type === "date") return isCanonicalCatalogValue("Date", field.value);
  if (field.type === "boolean") return field.value === "true" || field.value === "false";
  if (field.type === "catalog") return catalogFieldId.safeParse(field.value).success;
  return true;
});
// Column metadata includes current and historical definitions; only a single captured choice has the twenty-field limit.
const catalogColumnFields = z.array(catalogFieldMetadata).refine(fields => new Set(fields.map(field => field.fieldId.toLowerCase())).size === fields.length);
const capturedCatalogFields = z.array(catalogFieldSnapshot).max(20).refine(fields => new Set(fields.map(field => field.fieldId.toLowerCase())).size === fields.length);
const choice = z.strictObject({
  choiceId: guid,
  label: z.string(),
  catalogId: guid.optional(),
  catalogName: z.string().optional(),
  detail: z.string().optional(),
  value: z.string().optional(),
  valueType: z.enum(catalogValueTypes).exclude(["Text"]).optional(),
  fields: capturedCatalogFields.optional(),
}).refine(value => (value.value === undefined) === (value.valueType === undefined)
  && (value.valueType === undefined || isCanonicalCatalogValue(value.valueType, value.value ?? null)));
const choiceList = z.array(choice).max(20).refine(choices => new Set(choices.map(choice => choice.choiceId)).size === choices.length);
const value = z.union([
  z.string(),
  z.boolean(),
  choice,
  choiceList,
  fileList,
  z.null(),
]);
function validResponseValue(kind: z.infer<typeof type>, input: z.infer<typeof value>): boolean {
  if (kind === "boolean") return typeof input === "boolean";
  if (kind === "choice") return choice.safeParse(input).success;
  if (kind === "multiChoice") return choiceList.safeParse(input).success;
  if (kind === "photo" || kind === "document") return fileList.safeParse(input).success;
  return typeof input === "string";
}
export const responseCellSchema = z
  .strictObject({
    fieldId: guid,
    type,
    state: z.enum(["NotAsked", "Unanswered", "Answered"]),
    value,
  })
  .superRefine((cell, ctx) => {
    if (cell.type === "multiChoice") {
      const choices = choiceList.safeParse(cell.value);
      const valid = cell.state === "NotAsked" ? cell.value === null
        : cell.state === "Unanswered" ? cell.value === null || choices.success && choices.data.length === 0
          : choices.success && choices.data.length > 0;
      if (!valid) ctx.addIssue({ code: "custom", message: "Invalid multiple-choice response state." });
      return;
    }
    if (cell.state !== "Answered") return;
    if (!validResponseValue(cell.type, cell.value))
      ctx.addIssue({ code: "custom", message: "Invalid response value." });
  });
const column = z.strictObject({
  fieldId: guid,
  type,
  label: z.string(),
  introducedInVersion: z.number().int().positive(),
  valueType: z.enum(catalogValueTypes).exclude(["Text"]).optional(),
  options: z.array(z.strictObject({ id: guid, label: z.string() })),
  fields: catalogColumnFields.optional(),
}).refine(column => column.valueType === undefined && column.fields === undefined || column.type === "choice" || column.type === "multiChoice");
const row = z.strictObject({
  id: guid,
  versionId: guid,
  versionNumber: z.number().int().positive(),
  number: z.string(),
  submittedAtUtc: utc,
  actor: author,
  channel: z.string(),
  state: z.enum(["Received", "PendingApproval", "Approved", "Rejected"]),
  hasPdf: z.boolean(),
  cells: z.array(responseCellSchema),
});
function page<T extends z.ZodType>(item: T) {
  return z.strictObject({
    items: z.array(item),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalCount: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasPrevious: z.boolean(),
    hasNext: z.boolean(),
  });
}
export const responseSheetSchema = z
  .strictObject({
    definitionId: guid,
    name: z.string(),
    prefix: z.string(),
    activeVersionNumber: z.number().int().positive(),
    hasApproval: z.boolean(),
    columns: z.array(column),
    versions: z.array(
      z.strictObject({ id: guid, number: z.number().int().positive() }),
    ),
    records: page(row),
  })
  .superRefine((sheet, context) => {
    const columns = new Map(
      sheet.columns.map((column) => [column.fieldId, column.type]),
    );
    const valid =
      columns.size === sheet.columns.length &&
      sheet.records.items.every(
        (record) =>
          sheet.versions.some(
            (version) =>
              version.id === record.versionId &&
              version.number === record.versionNumber,
          ) &&
          record.cells.length === columns.size &&
          new Set(record.cells.map((cell) => cell.fieldId)).size ===
            columns.size &&
          record.cells.every((cell) => columns.get(cell.fieldId) === cell.type),
      );
    if (!valid)
      context.addIssue({
        code: "custom",
        message: "The response rows do not match their columns or versions.",
      });
  });
export const responseRecordNavigationSchema = z.strictObject({
  recordId: guid,
  previousId: guid.nullable(),
  nextId: guid.nullable(),
  position: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  totalCount: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
}).superRefine((navigation, context) => {
  if (navigation.position > navigation.totalCount
    || (navigation.previousId === null) !== (navigation.position === 1)
    || (navigation.nextId === null) !== (navigation.position === navigation.totalCount)
    || navigation.previousId === navigation.recordId || navigation.nextId === navigation.recordId
    || navigation.previousId !== null && navigation.previousId === navigation.nextId) {
    context.addIssue({ code: "custom", message: "Invalid record navigation." });
  }
});
export type ResponseRecordNavigation = z.infer<typeof responseRecordNavigationSchema>;
export const responseFacetSchema = page(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    count: z.number().int().nonnegative(),
  }),
);
const origin = z.strictObject({
  sourceReceiptId: guid,
  channelId: z.string(),
  senderKind: z.enum(["Manual", "Assistant"]),
  senderUserId: guid.nullable(),
  senderName: z.string().nullable(),
  sentAtUtc: utc,
  conversationId: guid.nullable(),
  maskedAddress: z.string().nullable(),
});
const historicalValue = z.strictObject({ fieldId: guid, key: z.string(), type, label: z.string(), value })
  .refine(row => row.value === null || validResponseValue(row.type, row.value));
const assistance = z.strictObject({
 senderKind: z.enum(["Manual", "Assistant"]), operator: author.nullable(), reason: z.string().nullable(),
 values: z.array(z.strictObject({ proposed: historicalValue, included: z.boolean(), changed: z.boolean(), mapped: z.boolean() })),
 suggestion: z.strictObject({ originRecordId: guid, suggestionId: guid, mode: z.enum(["Always", "Assistant"]) }).nullable(),
});
export const responseDetailSchema = z.strictObject({
  id: guid,
  definitionId: guid,
  versionId: guid,
  versionNumber: z.number().int().positive(),
  number: z.string(),
  name: z.string(),
  submittedAtUtc: utc,
  actor: author,
  channel: z.string(),
  origin: origin.nullable(),
  assistance: assistance.nullable(),
  chain: z.array(z.strictObject({ id: guid, definitionId: guid, originRecordId: guid.nullable(), number: z.string(), name: z.string(), submittedAtUtc: utc })),
  values: z.array(historicalValue),
  history: z.array(
    z.strictObject({
      kind: z.enum(["Sent", "Submitted", "Saved"]),
      atUtc: utc,
      actor: author.nullable(),
    }),
  ),
});
export type ResponseSheet = z.infer<typeof responseSheetSchema>;
export type ResponseRow = ResponseSheet["records"]["items"][number];
export type ResponseDetail = z.infer<typeof responseDetailSchema>;
function read<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error("Invalid form response contract.");
  return parsed.data;
}
export async function fetchResponseSheet(
  id: string,
  query: ResponseQuery,
  signal: AbortSignal,
) {
  return read(
    responseSheetSchema,
    await api.post<unknown>(
      `/api/forms/definitions/${encodeURIComponent(id)}/records/search`,
      query,
      { signal, cache: "no-store" },
    ),
  );
}
export async function fetchResponseRecordNavigation(
  formId: string,
  recordId: string,
  query: ResponseQuery,
  signal: AbortSignal,
): Promise<ResponseRecordNavigation> {
  if (!guid.safeParse(formId).success || !guid.safeParse(recordId).success)
    throw new Error("Invalid form navigation identity.");
  const navigation = read(responseRecordNavigationSchema, await api.post<unknown>(
    `/api/forms/definitions/${formId}/records/${recordId}/navigation`, query, { signal, cache: "no-store" },
  ));
  if (navigation.recordId.toLowerCase() !== recordId.toLowerCase()) throw new Error("Invalid form navigation identity.");
  return navigation;
}
export async function fetchResponseDetail(id: string, signal: AbortSignal) {
  return read(
    responseDetailSchema,
    await api.get<unknown>(`/api/forms/records/${encodeURIComponent(id)}`, {
      signal,
      cache: "no-store",
    }),
  );
}
export async function fetchResponseFacet(
  id: string,
  filter: ResponseQuery,
  dimension: string,
  fieldId: string | undefined,
  pageNumber: number,
  search: string,
  signal: AbortSignal,
) {
  return read(
    responseFacetSchema,
    await api.post<unknown>(
      `/api/forms/definitions/${encodeURIComponent(id)}/records/filter-counts/search`,
      { filter, dimension, fieldId, page: pageNumber, pageSize: 20, search },
      { signal, cache: "no-store" },
    ),
  );
}
