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
  // A list that depends on other answers (CW7) names those questions and waits for them, with nothing chosen beforehand.
  catalog: z.strictObject({ onlyOption: entryOptionSchema.nullable(), issue: z.string().min(1).nullable(), missingData: z.string().min(1).nullable(),
    dependsOn: z.array(z.string().uuid()).min(1).optional() }).nullable(),
  // The title of the section that starts at this question (CW15-B): the page opens a zone with it.
  section: z.string().min(1).max(80).optional(),
}).superRefine((value, context) => {
  const files = value.type === "photo" || value.type === "document";
  const list = value.type === "choice" || value.type === "multiChoice";
  if (files !== (value.files !== null) || (value.type === "multiChoice") !== (value.selection !== null)
    || (!list && (value.options !== null || value.catalog !== null)) || (list && (value.options === null) === (value.catalog === null))
    || (value.catalog?.missingData != null && value.catalog.issue === null) || (value.catalog?.onlyOption != null && value.catalog.issue !== null)
    || (value.catalog?.dependsOn !== undefined && (value.catalog.onlyOption !== null || value.catalog.issue !== null)))
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
// What a correction opens (CW10-A): the active version and the response mapped to it, its answers and its files.
const correctionSchema = z.strictObject({
  entry: formEntrySchema, recordId: z.string().uuid(), number: z.string().min(1),
  answers: z.array(z.strictObject({ fieldId: z.string().uuid(), value: z.string().nullable(), choiceIds: z.array(z.string().uuid()).nullable(),
    options: z.array(entryOptionSchema).nullable() })),
  files: z.array(z.strictObject({ fileId: z.string().uuid(), fieldId: z.string().uuid(), name: z.string().min(1), contentType: z.string().min(1),
    size: z.number().int().positive(), hasThumbnail: z.boolean() })),
});
export type FormEntry = z.infer<typeof formEntrySchema>;
export type FormEntryCorrection = z.infer<typeof correctionSchema>;
export type FormEntryKeptFile = FormEntryCorrection["files"][number];
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
export const readFormEntryCorrection = (body: unknown) => read(correctionSchema, body);

const uuid = z.string().uuid();
function entryPath(formId: string): string {
  return "/api/forms/entries/" + uuid.parse(formId);
}
export async function fetchFormEntry(formId: string, signal: AbortSignal): Promise<FormEntry> {
  return readFormEntry(await api.get<unknown>(entryPath(formId), { signal, cache: "no-store" }));
}
/**
 * A page of a catalog question's options; a dependent list sends the option chosen in each question it waits for (CW7).
 * While correcting a response (CW10-A) they are the options of whoever answered it.
 */
export async function fetchFormEntryOptions(formId: string, versionId: string, fieldId: string, page: number, search: string,
  signal: AbortSignal, answers: Readonly<Record<string, string>> = {}, recordId?: string): Promise<FormEntryOptionsPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: "50" });
  if (search) params.set("search", search);
  for (const [questionId, optionId] of Object.entries(answers)) params.set(`answers[${uuid.parse(questionId)}]`, uuid.parse(optionId));
  const base = recordId ? correctionPath(formId, recordId) : entryPath(formId);
  return readFormEntryOptions(await api.get<unknown>(`${base}/versions/${uuid.parse(versionId)}/questions/${uuid.parse(fieldId)}/options?${params}`,
    { signal, cache: "no-store" }));
}
function correctionPath(formId: string, recordId: string): string {
  return entryPath(formId) + "/records/" + uuid.parse(recordId);
}
/** What correcting a response opens: the active version with the response as it was (CW10-A). */
export async function fetchFormEntryCorrection(formId: string, recordId: string, signal: AbortSignal): Promise<FormEntryCorrection> {
  return readFormEntryCorrection(await api.get<unknown>(correctionPath(formId, recordId), { signal, cache: "no-store" }));
}
/** The correction in multipart: a send plus why and the files of the replaced response that stay. */
export async function submitFormEntryCorrection(formId: string, recordId: string, send: FormEntrySend, reason: string, keptFileIds: readonly string[],
  onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<FormEntrySubmitted> {
  const body = new FormData();
  body.append("requestId", uuid.parse(send.requestId));
  body.append("versionId", uuid.parse(send.versionId));
  body.append("answers", JSON.stringify(send.answers));
  body.append("reason", reason);
  for (const fileId of keptFileIds) body.append("keptFileIds", uuid.parse(fileId));
  for (const { fieldId, file } of send.files) {
    body.append("files", file, file.name);
    body.append("fileFieldIds", uuid.parse(fieldId));
  }
  return readFormEntrySubmitted(await api.upload<unknown>(correctionPath(formId, recordId), body, onProgress, { signal }));
}
/** Voids a response with its reason (CW11-A); it keeps its number and stops counting. */
export async function voidFormRecord(formId: string, recordId: string, reason: string): Promise<void> {
  await api.post<unknown>(`/api/forms/definitions/${uuid.parse(formId)}/records/${uuid.parse(recordId)}/void`, { reason });
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
