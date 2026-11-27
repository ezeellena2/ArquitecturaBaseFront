import { z } from "zod";
import { api } from "@/shared/api/httpClient";

// Consumo (CO1-B, plan PR12 to PR16): what the AI and WhatsApp spent in a month of the business. The contract is the one the plan
// fixes; a field the screen does not use is ignored, and a missing or wrong one is a generic error.
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const amount = z.number().min(0);
const count = z.number().int().min(0);

const modelPrice = z.object({
  inputUsdPerMillion: amount.nullable(),
  outputUsdPerMillion: amount.nullable(),
  audioUsdPerMinute: amount.nullable(),
  revision: z.number().int().min(1),
});

const aiModelUsage = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  requests: count,
  inputTokens: count.nullable(),
  outputTokens: count.nullable(),
  audioSeconds: amount.nullable(),
  unknownUsageRequests: count,
  price: modelPrice.nullable(),
  estimatedCostUsd: amount.nullable(),
});

const aiUsage = z.object({
  month,
  models: z.array(aiModelUsage),
  totalEstimatedCostUsd: amount,
  unpricedModels: count,
  unknownUsageRequests: count,
});

const savedPrice = modelPrice.extend({ provider: z.string().min(1), model: z.string().min(1) });

const whatsAppUsage = z.object({
  month,
  configured: z.boolean(),
  displayPhoneNumber: z.string().min(1).nullable(),
  currency: z.string().min(1).nullable(),
  categories: z.array(z.object({ category: z.string().min(1), delivered: count, cost: amount })),
  totalDelivered: count,
  totalCost: amount,
});

export type AiModelPrice = z.infer<typeof modelPrice>;
export type AiModelUsage = z.infer<typeof aiModelUsage>;
export type AiUsage = z.infer<typeof aiUsage>;
export type SavedAiModelPrice = z.infer<typeof savedPrice>;
export type WhatsAppUsage = z.infer<typeof whatsAppUsage>;

/** The three prices of a model, each optional, with the revision read (null to create them). */
export interface AiModelPriceRequest {
  provider: string;
  model: string;
  inputUsdPerMillion: number | null;
  outputUsdPerMillion: number | null;
  audioUsdPerMinute: number | null;
  revision: number | null;
}

/** The fields a 400 names. */
export const priceRequestFields = ["inputUsdPerMillion", "outputUsdPerMillion", "audioUsdPerMinute"] as const;
export type PriceRequestField = (typeof priceRequestFields)[number];

/** The same limits as the server (`AiModelPrice`). */
export const priceLimits = { maxUsdPerMillionTokens: 1000, maxUsdPerMinute: 10, maxDecimals: 6 } as const;

export const priceConflictCode = "Ai.ModelPrice.RevisionConflict";
export const whatsAppUnavailableCode = "WhatsApp.Usage.Unavailable";

export const aiUsageKeyRoot = ["usage", "ai"] as const;
export const aiUsageKey = (value: string) => [...aiUsageKeyRoot, value] as const;
export const whatsAppUsageKey = (value: string) => ["usage", "whatsapp", value] as const;

function parse<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`Unsupported ${what} response.`);
  return result.data;
}

export async function fetchAiUsage(value: string, signal?: AbortSignal): Promise<AiUsage> {
  return parse(aiUsage, await api.get<unknown>(`/api/ai/usage?month=${encodeURIComponent(value)}`, { signal, cache: "no-store" }), "AI usage");
}

/** 200 brings the prices as saved; 409 if another save came first; 400 with `errors` if a price is out of range. */
export async function saveAiModelPrice(request: AiModelPriceRequest, signal?: AbortSignal): Promise<SavedAiModelPrice> {
  return parse(savedPrice, await api.put<unknown>("/api/ai/usage/prices", request, { signal }), "AI price");
}

/** Read from Meta when the screen opens, without a cache: a 500 with `WhatsApp.Usage.Unavailable` when Meta does not answer, and a
 * 400 with `errors.month` for a month out of range. */
export async function fetchWhatsAppUsage(value: string, signal?: AbortSignal): Promise<WhatsAppUsage> {
  return parse(whatsAppUsage, await api.get<unknown>(`/api/whatsapp/usage?month=${encodeURIComponent(value)}`, { signal, cache: "no-store" }), "WhatsApp usage");
}
