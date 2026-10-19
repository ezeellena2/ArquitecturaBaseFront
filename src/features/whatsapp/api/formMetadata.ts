import { z } from "zod";
export const formTextSchema = z.record(z.string(), z.string()).refine(map => Object.keys(map).every(key => key === "es" || key === "en") && Object.values(map).some(text => !!text.trim()));
export const formMetadataSchema = z.strictObject({ definitionId: z.string().uuid(), versionId: z.string().uuid(), versionNumber: z.number().int().positive(), name: formTextSchema, culture: z.enum(["es", "en"]) }).refine(value => !!value.name[value.culture]?.trim());
export type ChatFormMetadata = z.infer<typeof formMetadataSchema>;
export function readFormMetadata(value: unknown): ChatFormMetadata | null { const parsed = formMetadataSchema.safeParse(value); return parsed.success ? parsed.data : null; }
