import type { FormCatalogPresentation } from "../model";
import { catalogValueTypes } from "../catalogValues";
import { z } from "zod";
import type { PagedResult } from "@/shared/api/pagedResult";

const guid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).refine(value => !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value));
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const cultureKey = z.string().refine((key): boolean => key === "es" || key === "en");
const nullableText = (limit: number) => z.record(cultureKey, z.string().max(limit).nullable());
// A text written in at least one language: the catalog's original is required and the other one is an optional translation.
const anyText = (value: Readonly<Record<string, string | null | undefined>>) => Object.values(value).some(text => !!text?.trim());
export const catalogFieldTypes = ["text", "integer", "decimal", "date", "boolean", "catalog"] as const;
// A form use (Draft or Active) names the form, the question and their identities, or none of them for a reader without
// formtemplates.read; the catalog's own presentation use names only the catalog.
export const catalogFieldUsageSchema = z.strictObject({ definitionId: guid.nullable(), formName: z.string().nullable(), question: z.string().nullable(), questionId: guid.nullable(), stage: z.enum(["Draft", "Active", "Catalog"]) })
  .refine(value => {
    const identity = [value.definitionId, value.question, value.questionId];
    if (value.stage === "Catalog") return value.formName !== null && identity.every(part => part === null);
    const parts = [value.formName, ...identity];
    return parts.every(part => part !== null) || parts.every(part => part === null);
  });
export type CatalogFieldUsage = z.infer<typeof catalogFieldUsageSchema>;
const catalogField = z.strictObject({ id: guid, key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), name: textMapForField(), type: z.enum(catalogFieldTypes), sourceCatalogId: guid.nullable(), required: z.boolean(), unique: z.boolean(), min: z.string().nullable(), max: z.string().nullable(), maxLength: z.number().int().min(1).max(300).nullable(), role: z.enum(["filter", "data"]), position: z.number().int().min(0).max(2147483647), isActive: z.boolean(), valuesCount: z.number().int().nonnegative(), usedBy: z.array(catalogFieldUsageSchema) })
  .refine(value => value.type === "catalog" ? value.sourceCatalogId !== null : value.sourceCatalogId === null);
function textMapForField() { return z.strictObject({ es: z.string().min(1).max(120).optional(), en: z.string().min(1).max(120).optional() }).refine(anyText); }
const presentation = z.strictObject({ title: z.array(z.string().min(1)).min(1).max(24), description: z.array(z.string().min(1)).max(24) });
// One entry per catalog language (es, en): titles over 30 and descriptions over 300 among every active option, with
// up to three examples each.
const presentationExample = z.strictObject({ itemId: guid, title: z.string() });
const presentationCultureCheck = z.strictObject({ culture: z.enum(["es", "en"]), titleTooLongCount: count, titleExamples: z.array(presentationExample).max(3), descriptionTooLongCount: count, descriptionExamples: z.array(presentationExample).max(3) })
  .refine(value => value.titleExamples.length === Math.min(value.titleTooLongCount, 3) && value.descriptionExamples.length === Math.min(value.descriptionTooLongCount, 3));
export const catalogPresentationCheckSchema = z.strictObject({ cultures: z.array(presentationCultureCheck).min(1).max(2) })
  .refine(value => new Set(value.cultures.map(entry => entry.culture)).size === value.cultures.length);
const filters = z.strictObject({
  textColumn: z.string(), detailColumn: z.string().nullable(),
  conditions: z.array(z.strictObject({ column: z.string(), operator: z.string(), value: z.string() })),
  excludeRecipient: z.boolean(), sortColumn: z.string(), sortDescending: z.boolean(),
});
const textMap = (limit: number) => z.strictObject({ es: z.string().min(1).max(limit).refine(value => !!value.trim()).optional(), en: z.string().min(1).max(limit).refine(value => !!value.trim()).optional() });
const author = z.strictObject({ userId: guid, displayName: z.string().nullable() });
const instant = z.string().datetime({ offset: true });
const proposal = z.strictObject({
  state: z.enum(["Pending", "Approved", "Discarded"]), originalCulture: z.enum(["es", "en"]),
  requestedBy: author, requestedAtUtc: instant, decidedBy: author.nullable(), decidedAtUtc: instant.nullable(),
  provenance: z.strictObject({ modelProfileId: z.string().min(1), modelProfileVersion: revision, instructionsId: z.string().min(1), instructionsVersion: revision, occurredAtUtc: instant, channelId: z.literal("whatsapp-assistant") }),
  originalProposal: z.strictObject({ metadataReadOrdinal: revision, name: z.string().min(1).max(120), description: z.string().min(1).max(1000), filters, limitations: z.array(z.strictObject({ code: z.literal("UnsupportedColumn"), criterion: z.string().min(1).max(80) })).max(5) }),
}).refine(value => value.state === "Pending" ? value.decidedBy === null && value.decidedAtUtc === null : value.decidedBy !== null && value.decidedAtUtc !== null);
const filterColumn = z.strictObject({ key: z.string(), dataType: z.string(), canDisplay: z.boolean(), canFilter: z.boolean(), canSort: z.boolean(), operators: z.array(z.string()), choices: z.array(z.strictObject({ key: z.string(), label: z.string() })).nullable() });
const sampleUsers = z.strictObject({ items: z.array(z.strictObject({ id: guid, name: z.string() })), page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), totalCount: count, totalPages: count, hasPrevious: z.boolean(), hasNext: z.boolean() });
const filterOptions = z.strictObject({ source: z.literal("users"), columns: z.array(filterColumn), sampleUsers: sampleUsers.nullable() });
const filterPreview = z.strictObject({ items: z.array(z.strictObject({ id: guid, text: z.string(), detail: z.string().nullable(), canSend: z.boolean() })), totalCount: count, exceedsLimit: z.boolean() });
const catalog = z.strictObject({ id: guid, key: z.string(), name: textMap(120), description: textMap(1000), originalCulture: z.enum(["es", "en"]), kind: z.enum(["Manual", "Filters"]), valueType: z.enum(catalogValueTypes), revision, isActive: z.boolean(), itemsCount: count.nullable(), usageCount: count.nullable(), unavailableReasonCode: z.string().nullable(), filters: filters.nullable(), proposal: proposal.nullable(), fields: z.array(catalogField).max(20).nullable(), presentation: presentation.nullable(), presentationCheck: catalogPresentationCheckSchema.nullable() })
  .refine(value => value.proposal ? value.kind === "Filters" && value.filters !== null && !!value.name[value.proposal.originalCulture]?.trim() && (value.proposal.state === "Approved" || !value.isActive) : anyText(value.name))
  .refine(value => value.key === value.id.replaceAll("-", "").toLowerCase())
  .refine(value => value.kind !== "Filters" || value.valueType === "Text")
  .refine(value => value.kind !== "Manual" || value.fields !== null && value.presentationCheck !== null)
  .refine(value => !value.fields || new Set(value.fields.map(field => field.id.toLowerCase())).size === value.fields.length && new Set(value.fields.map(field => field.key)).size === value.fields.length);
const item = z.strictObject({ id: guid, code: z.string().min(1).max(80), text: z.record(cultureKey, z.string().min(1).max(200).nullable()).refine(anyText), detail: nullableText(500), value: z.string().max(64).nullable(), position: z.number().int().min(1).max(10000), isActive: z.boolean(), fields: z.record(guid, z.string().max(300)), fieldTexts: z.record(guid, textMap(200).refine(anyText)) });
const itemPage = z.strictObject({ items: z.array(item), page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), totalCount: count, totalPages: count, hasPrevious: z.boolean(), hasNext: z.boolean() })
  .refine(value => new Set(value.items.map(row => row.id.toLowerCase())).size === value.items.length);
const listItem = z.strictObject({ id: guid, name: z.string().min(1), description: z.string().nullable(), origin: z.enum(["Manual", "Filters"]), valueType: z.enum(catalogValueTypes), optionsCount: count.nullable(), usageCount: count.nullable(), state: z.enum(["Active", "Inactive", "Unavailable"]), stateReason: z.string().nullable(), canEdit: z.boolean() }).refine(value => value.origin !== "Filters" || value.valueType === "Text");
const catalogPage = z.strictObject({ filterCounts: z.strictObject({ byKind: z.strictObject({ all: count, manual: count, filters: count }) }), items: z.array(listItem), page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), totalCount: count, totalPages: count, hasPrevious: z.boolean(), hasNext: z.boolean() })
  .refine(value => new Set(value.items.map(row => row.id.toLowerCase())).size === value.items.length);
const saved = z.strictObject({ catalog, itemIdentityMap: z.record(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), guid), fieldIdentityMap: z.record(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/), guid).nullable() });

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
export const readCatalogPresentationCheck = (value: unknown) => read(catalogPresentationCheckSchema, value);
export function readCatalogSave(value: unknown, newLocalIds: readonly string[], id?: string, expectedRevision?: number, newFieldLocalIds: readonly string[] = []) {
  const result = read(saved, value);
  const map = result.itemIdentityMap;
  if (result.catalog.kind !== "Manual" || id && result.catalog.id.toLowerCase() !== id.toLowerCase()
    || expectedRevision !== undefined && result.catalog.revision <= expectedRevision
    || new Set(newLocalIds).size !== newLocalIds.length || Object.keys(map).length !== newLocalIds.length
    || newLocalIds.some(key => !map[key]) || new Set(Object.values(map).map(value => value.toLowerCase())).size !== newLocalIds.length) throw new UnsupportedCatalogResponse();
  const fields = result.fieldIdentityMap;
  if (fields === null || new Set(newFieldLocalIds).size !== newFieldLocalIds.length || Object.keys(fields).length !== newFieldLocalIds.length
    || newFieldLocalIds.some(key => !fields[key]) || new Set(Object.values(fields).map(value => value.toLowerCase())).size !== newFieldLocalIds.length
    || Object.values(fields).some(id => !result.catalog.fields?.some(field => field.id.toLowerCase() === id.toLowerCase()))) throw new UnsupportedCatalogResponse();
  return result;
}
export const readCatalogPage = (value: unknown) => read(catalogPage, value);
export type CatalogListItem = z.infer<typeof listItem>;
export type CatalogDetail = z.infer<typeof catalog>;
export type CatalogItem = z.infer<typeof item>;
export type CatalogSave = z.infer<typeof saved>;
export type CatalogField = z.infer<typeof catalogField>;
export type CatalogPresentation = FormCatalogPresentation;
export type CatalogPresentationCheck = z.infer<typeof catalogPresentationCheckSchema>;

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
