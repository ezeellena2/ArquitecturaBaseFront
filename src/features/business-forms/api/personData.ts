import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import type { PagedResult } from "@/shared/api/pagedResult";

const guid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).refine(value => !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value));
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const nonempty = (limit: number) => z.string().min(1).max(limit).refine(value => !!value.trim());
const name = z.strictObject({ es: nonempty(120), en: nonempty(120).optional() });
const attribute = z.strictObject({ id: guid, key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/), name, type: z.enum(["Catalog", "Text"]), sourceCatalogId: guid.nullable(), sourceCatalogName: z.string().max(120).nullable(), position: z.number().int().min(0).max(19), isActive: z.boolean(), revision, usedBy: z.array(z.strictObject({ definitionId: guid, name: z.string().max(120) })) })
  .refine(value => value.type === "Catalog" ? value.sourceCatalogId !== null : value.sourceCatalogId === null);
const attributes = z.strictObject({ items: z.array(attribute).max(20) }).refine(value => new Set(value.items.map(item => item.id.toLowerCase())).size === value.items.length && new Set(value.items.map(item => item.key)).size === value.items.length);
const values = z.record(guid, z.strictObject({ value: z.string().max(300), text: z.string().max(300) })).refine(value => Object.keys(value).length <= 20);
const data = z.strictObject({ userId: guid, revision: revision.nullable(), values });
const row = z.strictObject({ userId: guid, displayName: z.string().nullable(), values });
const option = z.strictObject({ id: guid, text: z.string().max(200) });
const page = <T extends z.ZodType>(item: T) => z.strictObject({ items: z.array(item).max(100), page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), totalCount: count, totalPages: count, hasPrevious: z.boolean(), hasNext: z.boolean() });

export type PersonAttribute = z.infer<typeof attribute>;
export type PersonData = z.infer<typeof data>;
export type PersonDataRow = z.infer<typeof row>;
export type PersonAttributeOption = z.infer<typeof option>;
export interface PersonAttributeBody { readonly key: string; readonly name: Readonly<{ es: string; en?: string }>; readonly type: "Catalog" | "Text"; readonly sourceCatalogId: string | null }
export interface UpdatePersonAttributeBody extends Omit<PersonAttributeBody, "key"> { readonly expectedRevision: number; readonly position: number; readonly isActive: boolean }
export interface PersonDataBody { readonly expectedRevision: number | null; readonly values: Readonly<Record<string, string | null>> }
export interface PersonDataPageQuery { readonly page: number; readonly pageSize: number; readonly sort?: "displayName" | "-displayName"; readonly search?: string }
export interface PersonAttributeOptionsQuery { readonly page: number; readonly pageSize: number; readonly sort?: "text" | "-text"; readonly search?: string }
export class UnsupportedPersonDataResponse extends Error { constructor() { super("Unsupported person data response."); this.name = "UnsupportedPersonDataResponse"; } }
function read<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  // Validation issues may retain private values; expose only the stable contract error.
  if (!parsed.success) throw new UnsupportedPersonDataResponse();
  return parsed.data;
}
const id = (value: string) => read(guid, value);
export function readPersonAttribute(value: unknown, expectedId?: string, expectedRevision?: number) {
  const parsed = read(attribute, value);
  if (expectedId && parsed.id.toLowerCase() !== expectedId.toLowerCase() || expectedRevision !== undefined && parsed.revision !== expectedRevision + 1) throw new UnsupportedPersonDataResponse();
  return parsed;
}
export const readPersonAttributes = (value: unknown) => read(attributes, value);
export function readPersonData(value: unknown, expectedUserId?: string, expectedRevision?: number | null) {
  const parsed = read(data, value);
  if (expectedUserId && parsed.userId.toLowerCase() !== expectedUserId.toLowerCase() || expectedRevision !== undefined && parsed.revision !== (expectedRevision ?? 0) + 1) throw new UnsupportedPersonDataResponse();
  return parsed;
}
export const readPersonDataPage = (value: unknown): PagedResult<PersonDataRow> => read(page(row), value);
export const readPersonAttributeOptions = (value: unknown): PagedResult<PersonAttributeOption> => read(page(option), value);
const queryString = (query: PersonDataPageQuery | PersonAttributeOptionsQuery) => new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
export const fetchPersonAttributes = async (signal?: AbortSignal) => readPersonAttributes(await api.get<unknown>("/api/forms/person-attributes", { signal, cache: "no-store" }));
export async function createPersonAttribute(body: PersonAttributeBody, signal?: AbortSignal) {
  const parsed = readPersonAttribute(await api.post<unknown>("/api/forms/person-attributes", body, { signal, cache: "no-store" }));
  if (parsed.key !== body.key || parsed.revision !== 1) throw new UnsupportedPersonDataResponse();
  return parsed;
}
export const updatePersonAttribute = async (attributeId: string, body: UpdatePersonAttributeBody, signal?: AbortSignal) => readPersonAttribute(await api.put<unknown>(`/api/forms/person-attributes/${id(attributeId)}`, body, { signal, cache: "no-store" }), attributeId, body.expectedRevision);
export const fetchPersonDataPage = async (query: PersonDataPageQuery, signal?: AbortSignal) => readPersonDataPage(await api.get<unknown>(`/api/forms/person-data?${queryString(query)}`, { signal, cache: "no-store" }));
export const fetchPersonData = async (userId: string, signal?: AbortSignal) => readPersonData(await api.get<unknown>(`/api/forms/person-data/${id(userId)}`, { signal, cache: "no-store" }), userId);
export const savePersonData = async (userId: string, body: PersonDataBody, signal?: AbortSignal) => readPersonData(await api.put<unknown>(`/api/forms/person-data/${id(userId)}`, body, { signal, cache: "no-store" }), userId, body.expectedRevision);
export const fetchPersonAttributeOptions = async (attributeId: string, query: PersonAttributeOptionsQuery, signal?: AbortSignal) => readPersonAttributeOptions(await api.get<unknown>(`/api/forms/person-attributes/${id(attributeId)}/options?${queryString(query)}`, { signal, cache: "no-store" }));
