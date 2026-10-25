import { z } from "zod";
import { catalogFieldUsageSchema } from "./catalogResponse";

const count = z.number().int().nonnegative().safe().optional();
const feedbackSchema = z.strictObject({
  missingCount: count,
  invalidCount: count,
  convertedCount: count,
  count,
  invalidRows: z.array(z.strictObject({ itemId: z.uuid(), code: z.string().min(1).max(80), row: z.number().int().positive().safe(), value: z.string().max(300).nullable(), reason: z.enum(["required", "invalid", "range", "length"]) })).max(50).optional(),
  // Like `usedBy`, the uses have no cap in the contract: one per question and stage, or per form and stage without formtemplates.read.
  uses: z.array(catalogFieldUsageSchema).optional(),
});
export type CatalogFieldFeedback = z.infer<typeof feedbackSchema>;
export type CatalogInvalidFieldRow = NonNullable<CatalogFieldFeedback["invalidRows"]>[number];

/** Only known metadata leaves an error extension: counts, up to 50 rows with number, attempted value and reason, and every use. */
export function readCatalogFieldFeedback(value: unknown): CatalogFieldFeedback | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const entries = ["missingCount", "invalidCount", "convertedCount", "count", "invalidRows", "uses"].filter(key => source[key] !== undefined).map(key => [key, source[key]]);
  if (!entries.length) return null;
  const result = feedbackSchema.safeParse(Object.fromEntries(entries));
  return result.success ? result.data : null;
}
