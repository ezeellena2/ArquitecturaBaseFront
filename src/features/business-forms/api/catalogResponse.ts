import { z } from "zod";
import type { PagedResult } from "@/shared/api/pagedResult";

const guid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).refine(value => !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value));
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const nullableText = (limit: number) => z.record(z.string().refine((key): boolean => key === "es" || key === "en"), z.string().max(limit).nullable());
const requiredText = (limit: number) => z.strictObject({ es: z.string().min(1).max(limit).refine(value => !!value.trim()), en: z.string().min(1).max(limit).refine(value => !!value.trim()) });
const filters = z.strictObject({
  textColumn: z.string(), detailColumn: z.string().nullable(),
  conditions: z.array(z.strictObject({ column: z.string(), operator: z.string(), value: z.string() })),
  excludeRecipient: z.boolean(), sortColumn: z.string(), sortDescending: z.boolean(),
});
const filterColumn = z.strictObject({ key: z.string(), dataType: z.string(), canDisplay: z.boolean(), canFilter: z.boolean(), canSort: z.boolean(), operators: z.array(z.string()), choices: z.array(z.strictObject({ key: z.string(), label: z.string() })).nullable() });
const sampleUsers = z.strictObject({ items: z.array(z.strictObject({ id: guid, name: z.string() })), page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), totalCount: count, totalPages: count, hasPrevious: z.boolean(), hasNext: z.boolean() });
const filterOptions = z.strictObject({ source: z.literal("users"), columns: z.array(filterColumn), sampleUsers: sampleUsers.nullable() });
const filterPreview = z.strictObject({ items: z.array(z.strictObject({ id: guid, text: z.string(), detail: z.string().nullable(), canSend: z.boolean() })), totalCount: count, exceedsLimit: z.boolean() });
const catalog = z.strictObject({ id: guid, key: z.string(), name: requiredText(120), description: requiredText(1000), kind: z.enum(["Manual", "Filters"]), revision, isActive: z.boolean(), itemsCount: count.nullable(), usageCount: count.nullable(), unavailableReasonCode: z.string().nullable(), filters: filters.nullable() })
  .refine(value => value.key === value.id.replaceAll("-", "").toLowerCase());
const item = z.strictObject({ id: guid, code: z.string().min(1).max(80), text: nullableText(200).refine(value => !!value.es?.trim()), detail: nullableText(500), position: z.number().int().min(1).max(10000), isActive: z.boolean() });
const itemPage = z.strictObject({ items: z.array(item), page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), totalCount: count, totalPages: count, hasPrevious: z.boolean(), hasNext: z.boolean() })
  .refine(value => new Set(value.items.map(row => row.id.toLowerCase())).size === value.items.length);
const listItem = z.strictObject({ id: guid, name: z.string().min(1), description: z.string().nullable(), origin: z.enum(["Manual", "Filters"]), optionsCount: count.nullable(), usageCount: count.nullable(), state: z.enum(["Active", "Inactive", "Unavailable"]), stateReason: z.string().nullable(), canEdit: z.boolean() });
const catalogPage = z.strictObject({ filterCounts: z.strictObject({ byKind: z.strictObject({ all: count, manual: count, filters: count }) }), items: z.array(listItem), page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), totalCount: count, totalPages: count, hasPrevious: z.boolean(), hasNext: z.boolean() })
  .refine(value => new Set(value.items.map(row => row.id.toLowerCase())).size === value.items.length);
const saved = z.strictObject({ catalog, itemIdentityMap: z.record(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), guid) });

export class UnsupportedCatalogResponse extends Error {
  constructor() { super("Unsupported catalog response."); this.name = "UnsupportedCatalogResponse"; }
}
function read<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  // Zod issues can retain private option content; only expose a generic error.
  if (!result.success) throw new UnsupportedCatalogResponse();
  return result.data;
}
export const catalogId = (value: string) => read(guid, value);
export function readCatalog(value: unknown, id?: string) {
  const result = read(catalog, value);
  if (id && result.id.toLowerCase() !== id.toLowerCase()) throw new UnsupportedCatalogResponse();
  return result;
}
export const readCatalogItems = (value: unknown): PagedResult<z.infer<typeof item>> => read(itemPage, value);
export function readCatalogSave(value: unknown, newLocalIds: readonly string[], id?: string, expectedRevision?: number) {
  const result = read(saved, value);
  const map = result.itemIdentityMap;
  if (result.catalog.kind !== "Manual" || id && result.catalog.id.toLowerCase() !== id.toLowerCase()
    || expectedRevision !== undefined && result.catalog.revision <= expectedRevision
    || new Set(newLocalIds).size !== newLocalIds.length || Object.keys(map).length !== newLocalIds.length
    || newLocalIds.some(key => !map[key]) || new Set(Object.values(map).map(value => value.toLowerCase())).size !== newLocalIds.length) throw new UnsupportedCatalogResponse();
  return result;
}
export const readCatalogPage = (value: unknown) => read(catalogPage, value);
export type CatalogListItem = z.infer<typeof listItem>;
export type CatalogDetail = z.infer<typeof catalog>;
export type CatalogItem = z.infer<typeof item>;
export type CatalogSave = z.infer<typeof saved>;

export const readCatalogFilterOptions = (value: unknown) => read(filterOptions, value);
export const readCatalogFilterPreview = (value: unknown) => read(filterPreview, value);
export type CatalogFilterOptions = z.infer<typeof filterOptions>;
export type CatalogFilterPreview = z.infer<typeof filterPreview>;

export function readCatalogFiltersSave(value: unknown, id?: string, expectedRevision?: number) {
  const result = read(saved, value);
  if (result.catalog.kind !== "Filters" || result.catalog.filters === null || Object.keys(result.itemIdentityMap).length !== 0
    || id && result.catalog.id.toLowerCase() !== id.toLowerCase()
    || expectedRevision !== undefined && result.catalog.revision <= expectedRevision) throw new UnsupportedCatalogResponse();
  return result;
}

export type CatalogPage = z.infer<typeof catalogPage>;
