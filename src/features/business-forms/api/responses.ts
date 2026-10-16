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
const choice = z.strictObject({
  choiceId: guid,
  label: z.string(),
  catalogId: guid.nullish(),
  catalogName: z.string().nullish(),
  detail: z.string().nullish(),
});
const value = z.union([
  z.string(),
  z.boolean(),
  choice,
  z.array(file),
  z.null(),
]);
export const responseCellSchema = z
  .strictObject({
    fieldId: guid,
    type,
    state: z.enum(["NotAsked", "Unanswered", "Answered"]),
    value,
  })
  .superRefine((cell, ctx) => {
    if (cell.state !== "Answered") return;
    const valid =
      cell.type === "boolean"
        ? typeof cell.value === "boolean"
        : cell.type === "choice"
          ? cell.value !== null &&
            typeof cell.value === "object" &&
            !Array.isArray(cell.value)
          : cell.type === "photo" || cell.type === "document"
            ? Array.isArray(cell.value)
            : typeof cell.value === "string";
    if (!valid)
      ctx.addIssue({ code: "custom", message: "Invalid response value." });
  });
const column = z.strictObject({
  fieldId: guid,
  type,
  label: z.string(),
  introducedInVersion: z.number().int().positive(),
  options: z.array(z.strictObject({ id: guid, label: z.string() })),
});
const row = z.strictObject({
  id: guid,
  versionId: guid,
  versionNumber: z.number().int().positive(),
  number: z.string(),
  submittedAtUtc: utc,
  actor: author,
  channel: z.string(),
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
export const responseNavigationSchema = page(
  z.strictObject({
    id: guid,
    name: z.string(),
    prefix: z.string(),
    versionNumber: z.number().int().positive(),
  }),
);
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
  senderUserId: guid.nullable(),
  senderName: z.string().nullable(),
  sentAtUtc: utc,
  conversationId: guid.nullable(),
  maskedAddress: z.string().nullable(),
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
  values: z.array(
    z.strictObject({
      fieldId: guid,
      key: z.string(),
      type,
      label: z.string(),
      value,
    }),
  ),
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
export async function fetchResponseNavigation(
  query: { page: number; pageSize: number; search?: string },
  signal: AbortSignal,
) {
  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(query.pageSize),
  });
  if (query.search) params.set("search", query.search);
  return read(
    responseNavigationSchema,
    await api.get<unknown>(`/api/forms/navigation?${params}`, {
      signal,
      cache: "no-store",
    }),
  );
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
