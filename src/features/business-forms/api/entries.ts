import { z } from "zod";
import { api } from "@/shared/api/httpClient";

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const entryOptionSchema = z.strictObject({ id: z.string().uuid(), title: z.string().min(1), description: z.string().min(1).nullable() });
const questionSchema = z.strictObject({
  fieldId: z.string().uuid(),
  type: z.enum(["shortText", "longText", "decimal", "date", "boolean", "choice", "multiChoice", "photo", "document"]),
  label: z.string().min(1),
  help: z.string().min(1).nullable(),
  required: z.boolean(),
  maxLength: z.number().int().positive().nullable(),
  options: z.array(z.strictObject({ id: z.string().uuid(), label: z.string().min(1) })).min(1).nullable(),
  selection: z.strictObject({ minSelected: z.number().int().min(0).max(20), maxSelected: z.number().int().min(1).max(20) }).nullable(),
  files: z.strictObject({ minFiles: z.number().int().min(0).max(10), maxFiles: z.number().int().min(1).max(10), photoSource: z.enum(["cameraOrGallery", "camera"]).nullable() }).nullable(),
  catalog: z.strictObject({ onlyOption: entryOptionSchema.nullable(), issue: z.string().min(1).nullable(), missingData: z.string().min(1).nullable() }).nullable(),
}).superRefine((value, context) => {
  const files = value.type === "photo" || value.type === "document";
  const list = value.type === "choice" || value.type === "multiChoice";
  if (files !== (value.files !== null) || (value.type === "multiChoice") !== (value.selection !== null)
    || (!list && (value.options !== null || value.catalog !== null)) || (list && (value.options === null) === (value.catalog === null))
    || (value.catalog?.missingData != null && value.catalog.issue === null) || (value.catalog?.onlyOption != null && value.catalog.issue !== null))
    context.addIssue({ code: "custom", message: "Invalid entry question." });
});
export const formEntrySchema = z.strictObject({
  definitionId: z.string().uuid(), versionId: z.string().uuid(), versionNumber: z.number().int().positive(),
  prefix: z.string().min(1), name: z.string().min(1), culture: z.enum(["es", "en"]), submitLabel: z.string().min(1),
  maxFileSizeMiB: z.number().int().min(1).max(25), questions: z.array(questionSchema).max(40),
});
const optionsPageSchema = z.strictObject({
  items: z.array(entryOptionSchema), page: z.number().int().positive(), pageSize: z.number().int().positive(),
  totalCount: count, totalPages: count, hasPrevious: z.boolean(), hasNext: z.boolean(),
});
const submittedSchema = z.strictObject({
  recordId: z.string().uuid(), number: z.string().min(1),
  state: z.enum(["Received", "PendingApproval", "Approved", "Rejected"]), submittedAtUtc: z.iso.datetime(),
});
export type FormEntry = z.infer<typeof formEntrySchema>;
export type FormEntryQuestion = FormEntry["questions"][number];
export type FormEntryOption = z.infer<typeof entryOptionSchema>;
export type FormEntryOptionsPage = z.infer<typeof optionsPageSchema>;
export type FormEntrySubmitted = z.infer<typeof submittedSchema>;
/** A question's answer: its canonical value, or the chosen ids of a multiple choice. */
export type FormEntryAnswer = { fieldId: string; value: string } | { fieldId: string; choiceIds: string[] };
export interface FormEntrySend { requestId: string; versionId: string; answers: FormEntryAnswer[]; files: { fieldId: string; file: File }[] }

function read<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  // The issues may carry what the person typed: they are not kept.
  if (!result.success) throw new Error("Invalid form entry contract.");
  return result.data;
}
export const readFormEntry = (body: unknown) => read(formEntrySchema, body);
export const readFormEntryOptions = (body: unknown) => read(optionsPageSchema, body);
export const readFormEntrySubmitted = (body: unknown) => read(submittedSchema, body);

const uuid = z.string().uuid();
function entryPath(formId: string): string {
  return "/api/forms/entries/" + uuid.parse(formId);
}
export async function fetchFormEntry(formId: string, signal: AbortSignal): Promise<FormEntry> {
  return readFormEntry(await api.get<unknown>(entryPath(formId), { signal, cache: "no-store" }));
}
export async function fetchFormEntryOptions(formId: string, versionId: string, fieldId: string, page: number, search: string,
  signal: AbortSignal): Promise<FormEntryOptionsPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: "50" });
  if (search) params.set("search", search);
  return readFormEntryOptions(await api.get<unknown>(`${entryPath(formId)}/versions/${uuid.parse(versionId)}/questions/${uuid.parse(fieldId)}/options?${params}`,
    { signal, cache: "no-store" }));
}
/** The send in multipart, with the upload's progress. Repeating the same `requestId` and answers returns the first result. */
export async function submitFormEntry(formId: string, send: FormEntrySend, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<FormEntrySubmitted> {
  const body = new FormData();
  body.append("requestId", uuid.parse(send.requestId));
  body.append("versionId", uuid.parse(send.versionId));
  body.append("answers", JSON.stringify(send.answers));
  for (const { fieldId, file } of send.files) {
    body.append("files", file, file.name);
    body.append("fileFieldIds", uuid.parse(fieldId));
  }
  return readFormEntrySubmitted(await api.upload<unknown>(entryPath(formId), body, onProgress, { signal }));
}
