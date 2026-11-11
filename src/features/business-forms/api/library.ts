import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { questionValidationSchema, readFormCommit } from "./response";

// BI1-A: the standards the installed modules bring, in the language of the menu, with how many forms came from each, the language
// a copy is written in and the module that brings it, when it says.
const standard = z.strictObject({
  key: z.string().min(1).max(64),
  version: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string(),
  prefix: z.string().min(1),
  copies: z.number().int().nonnegative(),
  culture: z.enum(["es", "en"]),
  source: z.string().min(1).optional(),
  // The prefix «Agregar» offers: the server knows the prefixes in use, deleted forms' too.
  suggestedPrefix: z.string().min(1).max(12),
  // DOC1: a standard that reads documents names the data it reads and its fixed validations; without them, both are omitted.
  reads: z.array(z.string().min(1)).min(1).max(40).optional(),
  validations: z.array(z.strictObject({ name: z.string().min(1), kind: questionValidationSchema })).min(1).max(20).optional(),
});
// DOC1: the standards of the next stages, without a draft to add, listed as «Próximamente».
const upcoming = z.strictObject({ key: z.string().min(1).max(64), name: z.string().min(1), description: z.string() });
const library = z.strictObject({ standards: z.array(standard), upcoming: z.array(upcoming).max(40).optional() });

export type FormStandard = z.infer<typeof standard>;
export type FormLibrary = z.infer<typeof library>;

function read<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error("Invalid form library contract.");
  return parsed.data;
}

export const readFormLibrary = (body: unknown): FormLibrary => read(library, body);

export const fetchFormLibrary = async (signal?: AbortSignal): Promise<FormLibrary> =>
  readFormLibrary(await api.get<unknown>("/api/forms/library", { signal, cache: "no-store" }));

export interface AddFormStandardBody {
  /// One per «Agregar»: repeating it after a failure gets the same draft.
  readonly requestId: string;
  readonly name: string;
  readonly prefix: string;
  /// Without one, the copy goes to the standard's folder.
  readonly folderId?: string;
}

// The copy is written in the standard's language, so its name goes under that key.
export async function addFormStandard(target: FormStandard, body: AddFormStandardBody, signal?: AbortSignal) {
  return readFormCommit(await api.post<unknown>(`/api/forms/library/${encodeURIComponent(target.key)}/copies`, {
    requestId: body.requestId, name: { [target.culture]: body.name }, prefix: body.prefix, ...(body.folderId ? { folderId: body.folderId } : {}),
  }, { signal }));
}
