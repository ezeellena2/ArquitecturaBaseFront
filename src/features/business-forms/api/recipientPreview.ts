import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import type { PagedResult } from "@/shared/api/pagedResult";
import type { FormCulture, FormQuestionSource } from "../model";
import { canonicalCatalogSourceSchema } from "./response";

const guid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).refine(value => !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value));
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const sample = z.strictObject({ id: guid, name: z.string() });
const samples = z.strictObject({ items: z.array(sample).max(100), page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), totalCount: count, totalPages: count, hasPrevious: z.boolean(), hasNext: z.boolean() });
const recipient = z.strictObject({ id: guid, name: z.string(), values: z.array(z.strictObject({ attributeId: guid, name: z.string().max(120), text: z.string().max(300) })).max(20) });
// A preview must represent invalid channel text so the editor can show its diagnostic.
const option = z.strictObject({ id: guid, title: z.string(), description: z.string().nullable() });
// The long-title warning is not per person: it comes from the question's source (catalog detail or presentation-checks).
const preview = z.strictObject({ recipient, state: z.enum(["Ready", "RecipientDataMissing", "FilterUnavailable"]), optionCount: z.number().int().min(0).max(201), limit: z.union([z.literal(20), z.literal(200)]), exceedsLimit: z.boolean(), options: z.array(option).max(200) })
  .refine(value => value.exceedsLimit === (value.optionCount > value.limit) && value.options.length === Math.min(value.optionCount, value.limit))
  .refine(value => value.state === "Ready" || value.optionCount === 0)
  .refine(value => new Set(value.options.map(option => option.id.toLowerCase())).size === value.options.length && new Set(value.recipient.values.map(value => value.attributeId.toLowerCase())).size === value.recipient.values.length);
export type RecipientSample = z.infer<typeof sample>;
export type RecipientPreview = z.infer<typeof preview>;
export interface RecipientSamplesQuery { readonly page: number; readonly pageSize: number; readonly search?: string }
export interface RecipientPreviewBody { readonly type: "choice" | "multiChoice"; readonly source: FormQuestionSource; readonly sampleUserId: string; readonly culture: FormCulture }
export class UnsupportedRecipientPreviewResponse extends Error { constructor() { super("Unsupported recipient preview response."); this.name = "UnsupportedRecipientPreviewResponse"; } }
function read<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  // Zod issues can retain a private sample name or person value.
  if (!parsed.success) throw new UnsupportedRecipientPreviewResponse();
  return parsed.data;
}
export const readRecipientSamples = (value: unknown): PagedResult<RecipientSample> => read(samples, value);
export function readRecipientPreview(value: unknown, body?: RecipientPreviewBody): RecipientPreview {
  const result = read(preview, value);
  if (body) {
    const matched = new Set(body.source.match?.flatMap(match => match.personAttributeId ? [match.personAttributeId.toLowerCase()] : []) ?? []);
    if (result.recipient.id.toLowerCase() !== body.sampleUserId.toLowerCase() || result.limit !== (body.type === "multiChoice" ? 20 : 200)
      || result.recipient.values.some(value => !matched.has(value.attributeId.toLowerCase()))) throw new UnsupportedRecipientPreviewResponse();
  }
  return result;
}
export async function fetchRecipientSamples(query: RecipientSamplesQuery, signal?: AbortSignal) {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return readRecipientSamples(await api.get<unknown>("/api/forms/recipient-samples?" + params, { signal, cache: "no-store" }));
}
export async function previewRecipient(definitionId: string, body: RecipientPreviewBody, signal?: AbortSignal) {
  const id = read(guid, definitionId);
  read(canonicalCatalogSourceSchema, body.source);
  read(guid, body.sampleUserId);
  return readRecipientPreview(await api.post<unknown>(`/api/forms/definitions/${id}/recipient-previews`, body, { signal, cache: "no-store" }), body);
}
