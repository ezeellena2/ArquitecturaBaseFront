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
  "group",
]);
// The questions that go in a block of rows (RG1-A): never a file, a multiple choice or another block.
const rowType = z.enum(["shortText", "longText", "decimal", "date", "boolean", "choice"]);
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
const cellState = z.enum(["NotAsked", "Unanswered", "Answered"]);
function checkCell(cell: { type: z.infer<typeof type>; state: z.infer<typeof cellState>; value: unknown }, ctx: z.RefinementCtx) {
    if (cell.type === "multiChoice") {
      const choices = choiceList.safeParse(cell.value);
      const valid = cell.state === "NotAsked" ? cell.value === null
        : cell.state === "Unanswered" ? cell.value === null || choices.success && choices.data.length === 0
          : choices.success && choices.data.length > 0;
      if (!valid) ctx.addIssue({ code: "custom", message: "Invalid multiple-choice response state." });
      return;
    }
    if (cell.state !== "Answered") return;
    if (!validResponseValue(cell.type, cell.value as z.infer<typeof value>))
      ctx.addIssue({ code: "custom", message: "Invalid response value." });
}
// An item of a block in the sheet: one cell per question of the block's column, in its order.
const itemCellSchema = z.strictObject({ fieldId: guid, type: rowType, state: cellState, value }).superRefine(checkCell);
const items = z.array(z.strictObject({ cells: z.array(itemCellSchema) }));
export const responseCellSchema = z
  .strictObject({
    fieldId: guid,
    type,
    state: cellState,
    value: z.union([value, items]),
  })
  .superRefine((cell, ctx) => {
    if (cell.type === "group") {
      const parsed = items.safeParse(cell.value);
      const valid = cell.state === "NotAsked" ? cell.value === null
        : cell.state === "Unanswered" ? cell.value === null || parsed.success && parsed.data.length === 0
          : parsed.success && parsed.data.length > 0;
      if (!valid) ctx.addIssue({ code: "custom", message: "Invalid block of rows state." });
      return;
    }
    checkCell(cell, ctx);
  });
const columnShape = {
  fieldId: guid,
  label: z.string(),
  introducedInVersion: z.number().int().positive(),
  valueType: z.enum(catalogValueTypes).exclude(["Text"]).optional(),
  options: z.array(z.strictObject({ id: guid, label: z.string() })),
  fields: catalogColumnFields.optional(),
};
const typedOnlyInChoices = (column: { type: string; valueType?: string; fields?: unknown }) =>
  column.valueType === undefined && column.fields === undefined || column.type === "choice" || column.type === "multiChoice";
const questionColumn = z.strictObject({ ...columnShape, type: rowType }).refine(typedOnlyInChoices);
// A block of rows has one column with its questions inside (RG4-A); they come only there.
const column = z.strictObject({ ...columnShape, type, questions: z.array(questionColumn).min(1).optional() })
  .refine(column => typedOnlyInChoices(column) && (column.type === "group") === (column.questions !== undefined)
    && (column.type !== "group" || column.options.length === 0)
    && new Set(column.questions?.map(question => question.fieldId)).size === (column.questions?.length ?? 0));
// RE1-A: what external actions left in the responses, a column per datum after the questions; each row has the value of its own.
const resultKind = z.enum(["text", "date", "number"]);
const resultColumn = z.strictObject({ id: z.string().min(1), source: z.string().min(1), sourceName: z.string(), key: z.string().min(1), label: z.string(), kind: resultKind });
const result = z.strictObject({
  source: z.string().min(1), name: z.string(), recordedAtUtc: utc,
  values: z.array(z.strictObject({ key: z.string().min(1), label: z.string(), kind: resultKind, value: z.string().nullable() })).min(1),
});
const row = z.strictObject({
  id: guid,
  versionId: guid,
  versionNumber: z.number().int().positive(),
  number: z.string(),
  submittedAtUtc: utc,
  actor: author,
  channel: z.string(),
  state: z.enum(["Received", "PendingApproval", "Approved", "Rejected", "Voided"]),
  hasPdf: z.boolean(),
  // Only on a correction (CW10-A): the sheet says «Corregida» in its own column (UD4).
  corrected: z.literal(true).optional(),
  cells: z.array(responseCellSchema),
  results: z.record(z.string(), z.string().nullable()).optional(),
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
    resultColumns: z.array(resultColumn).min(1).optional(),
  })
  .superRefine((sheet, context) => {
    const columns = new Map(
      sheet.columns.map((column) => [column.fieldId, column.type]),
    );
    const questions = new Map(sheet.columns.map(column => [column.fieldId, column.questions ?? []]));
    // Each item of a block has one cell per question of its column, in its order and with its type.
    const itemsMatch = (cell: z.infer<typeof responseCellSchema>) => cell.type !== "group" || cell.value === null
      || (cell.value as z.infer<typeof items>).every(item => item.cells.length === questions.get(cell.fieldId)?.length
        && item.cells.every((itemCell, index) => questions.get(cell.fieldId)?.[index]?.fieldId === itemCell.fieldId
          && questions.get(cell.fieldId)?.[index]?.type === itemCell.type));
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
          record.cells.every((cell) => columns.get(cell.fieldId) === cell.type && itemsMatch(cell)) &&
          Object.keys(record.results ?? {}).every(id => sheet.resultColumns?.some(resultColumn => resultColumn.id === id)),
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
// An item of a block in the detail: every question of the block in its version, with null where it was left empty.
const itemValue = z.strictObject({ fieldId: guid, key: z.string(), type: rowType, label: z.string(), value })
  .refine(row => row.value === null || validResponseValue(row.type, row.value));
const detailItems = z.array(z.strictObject({ values: z.array(itemValue).min(1)
  .refine(values => new Set(values.map(item => item.fieldId)).size === values.length) }));
const historicalValue = z.strictObject({ fieldId: guid, key: z.string(), type, label: z.string(), value: z.union([value, detailItems]) })
  .refine(row => row.type === "group" ? detailItems.safeParse(row.value).success
    : row.value === null || validResponseValue(row.type, row.value as z.infer<typeof value>));
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
  // A correction (CW10-A): who and why, and how the version it replaced had ended.
  correction: z.strictObject({
    previousRecordId: guid, atUtc: utc, by: author, reason: z.string().min(1),
    previousState: z.enum(["Received", "PendingApproval", "Approved", "Rejected", "Voided"]),
    previousDecidedAtUtc: utc.nullable(), previousDecidedBy: author.nullable(), previousPdfAtUtc: utc.nullable(),
  }).optional(),
  // A version that a correction replaced: the one that stands for it now.
  replacedBy: z.strictObject({ recordId: guid, atUtc: utc }).optional(),
  // A voided response (CW11-A): who, when and why.
  void: z.strictObject({ atUtc: utc, by: author, reason: z.string().min(1) }).optional(),
  // Whether whoever reads it may correct or void it now (decision 8); the server checks again.
  canAmend: z.literal(true).optional(),
  // RE1-A: what external actions left, above «Datos»; omitted without results.
  results: z.array(result).min(1).optional(),
});
export type ResponseSheet = z.infer<typeof responseSheetSchema>;
export type ResponseRow = ResponseSheet["records"]["items"][number];
export type ResponseDetail = z.infer<typeof responseDetailSchema>;
export type ResponseResult = NonNullable<ResponseDetail["results"]>[number];
export type ResponseResultColumn = NonNullable<ResponseSheet["resultColumns"]>[number];
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
