import { z } from "zod";
const localizedText = z.record(z.string(), z.string().min(1)).refine(map => Object.keys(map).every(key => key === "es" || key === "en"));
export const formMetadataSchema = z.strictObject({ definitionId: z.string().uuid(), versionId: z.string().uuid(), versionNumber: z.number().int().positive(), name: localizedText, culture: z.enum(["es", "en"]) }).refine(value => !!value.name[value.culture]);
export type ChatFormMetadata = z.infer<typeof formMetadataSchema>;
export function readFormMetadata(value: unknown): ChatFormMetadata | null { const parsed = formMetadataSchema.safeParse(value); return parsed.success ? parsed.data : null; }
