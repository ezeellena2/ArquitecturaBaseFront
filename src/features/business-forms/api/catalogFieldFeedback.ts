import { z } from "zod";
import { catalogFieldUsageSchema } from "./catalogResponse";

const count = z.number().int().nonnegative().safe().optional();
const feedbackSchema = z.strictObject({
  missingCount: count,
  invalidCount: count,
  convertedCount: count,
  count,
  invalidRows: z.array(z.strictObject({ itemId: z.uuid(), code: z.string().min(1).max(80) })).max(50).optional(),
  uses: z.array(catalogFieldUsageSchema).max(100).optional(),
});
export type CatalogFieldFeedback = z.infer<typeof feedbackSchema>;

/** Only bounded, non-value metadata may be shown from an error extension. */
export function readCatalogFieldFeedback(value: unknown): CatalogFieldFeedback | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const entries = ["missingCount", "invalidCount", "convertedCount", "count", "invalidRows", "uses"].filter(key => source[key] !== undefined).map(key => [key, source[key]]);
  if (!entries.length) return null;
  const result = feedbackSchema.safeParse(Object.fromEntries(entries));
  return result.success ? result.data : null;
}
