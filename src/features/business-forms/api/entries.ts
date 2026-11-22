import { z } from "zod";
import { api } from "@/shared/api/httpClient";

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
// `value` is the option's canonical value in a catalog with values (CA1-A: the rate of a percentage is seen while loading).
export const entryOptionSchema = z.strictObject({ id: z.string().uuid(), title: z.string().min(1), description: z.string().min(1).nullable(), value: z.string().min(1).optional() });
/** What a question of the block of rows can be: a value of its own in each item. */
const itemTypes: readonly string[] = ["shortText", "longText", "decimal", "date", "boolean", "choice"];
const questionSchema = z.strictObject({
  fieldId: z.string().uuid(),
  type: z.enum(["shortText", "longText", "decimal", "date", "boolean", "choice", "multiChoice", "photo", "document", "group", "location"]),
  label: z.string().min(1),
  help: z.string().min(1).nullable(),
  required: z.boolean(),
  maxLength: z.number().int().positive().nullable(),
  options: z.array(z.strictObject({ id: z.string().uuid(), label: z.string().min(1) })).min(1).nullable(),
  selection: z.strictObject({ minSelected: z.number().int().min(0).max(20), maxSelected: z.number().int().min(1).max(20) }).nullable(),
  files: z.strictObject({ minFiles: z.number().int().min(0).max(10), maxFiles: z.number().int().min(1).max(10), photoSource: z.enum(["cameraOrGallery", "camera"]).nullable() }).nullable(),
  // A list that depends on other answers (CW7) names those questions and waits for them, with nothing chosen beforehand. One that
  // chooses first by a field (LD1-A) names that field: its values come first and the list brings only the options of the one chosen.
  // `default` (IV1-A) is the option a new answer starts with, which the form's standard declares; it can be changed.
  catalog: z.strictObject({ onlyOption: entryOptionSchema.nullable(), issue: z.string().min(1).nullable(), missingData: z.string().min(1).nullable(),
    dependsOn: z.array(z.string().uuid()).min(1).optional(), groupBy: z.strictObject({ fieldId: z.string().uuid(), name: z.string().min(1) }).optional(),
    default: entryOptionSchema.optional() }).nullable(),
  // The title of the section that starts at this question (CW15-B): the page opens a zone with it.
  section: z.string().min(1).max(80).optional(),
  // The block of rows (RG2-A) says how many items it takes; its questions follow it, marked as repeated.
  rows: z.strictObject({ minRows: z.number().int().min(0).max(100), maxRows: z.number().int().min(1).max(100) }).optional(),
  repeated: z.literal(true).optional(),
  // CA1-A: how the server computes this read-only number; the app shows a preview with the same rounding and never sends it.
  calculation: z.strictObject({ operation: z.enum(["multiply", "sum", "percent"]), operands: z.array(z.string().uuid()).min(1).max(20) }).optional(),
  // CO1-A: the earlier question and the answers that show this one; hidden, it is neither required nor sent.
  showWhen: z.strictObject({ questionId: z.string().uuid(), values: z.array(z.string().min(1).max(64)).min(1).max(50) }).optional(),
}).superRefine((value, context) => {
  const files = value.type === "photo" || value.type === "document";
  const list = value.type === "choice" || value.type === "multiChoice";
  if (files !== (value.files !== null) || (value.type === "multiChoice") !== (value.selection !== null)
    || (!list && (value.options !== null || value.catalog !== null)) || (list && (value.options === null) === (value.catalog === null))
    || (value.catalog?.missingData != null && value.catalog.issue === null) || (value.catalog?.onlyOption != null && value.catalog.issue !== null)
    || (value.catalog?.dependsOn !== undefined && (value.catalog.onlyOption !== null || value.catalog.issue !== null))
    || (value.catalog?.default !== undefined && (value.type !== "choice" || value.catalog.onlyOption !== null || value.catalog.issue !== null || value.catalog.dependsOn !== undefined))
    || (value.type === "group") !== (value.rows !== undefined) || (value.type === "group" && value.maxLength !== null)
    || (value.rows !== undefined && (value.rows.minRows > value.rows.maxRows || value.required !== value.rows.minRows > 0))
    || (value.repeated && !itemTypes.includes(value.type))
    // A calculation is an optional number: two operands for multiply and percent; a condition never goes on the block or in it.
    || (value.calculation !== undefined && (value.type !== "decimal" || value.required
      || (value.calculation.operation !== "sum" && value.calculation.operands.length !== 2)))
    || (value.showWhen !== undefined && (value.type === "group" || value.repeated === true))
    // UB1-A: a location is only required or optional, without a length or a condition of its own.
    || (value.type === "location" && (value.maxLength !== null || value.showWhen !== undefined)))
    context.addIssue({ code: "custom", message: "Invalid entry question." });
});
export const formEntrySchema = z.strictObject({
  definitionId: z.string().uuid(), versionId: z.string().uuid(), versionNumber: z.number().int().positive(),
  prefix: z.string().min(1), name: z.string().min(1), culture: z.enum(["es", "en"]), submitLabel: z.string().min(1),
  maxFileSizeMiB: z.number().int().min(1).max(25), questions: z.array(questionSchema).max(41),
  /** EM2-A: sending issues a document, so «Enviar» first shows what would be issued; without it the field does not come. */
  issuePreview: z.literal(true).optional(),
}).superRefine((value, context) => {
  // At most one block, which does not count among the 40 questions, followed without gaps by its repeated questions.
  const groups = value.questions.flatMap((question, index) => question.type === "group" ? [index] : []);
  let end = groups.length === 1 ? groups[0] + 1 : 0;
  while (groups.length === 1 && end < value.questions.length && value.questions[end].repeated) end++;
  if (groups.length > 1 || value.questions.length - groups.length > 40
    || value.questions.some((question, index) => question.repeated && (groups.length !== 1 || index <= groups[0] || index >= end)))
    context.addIssue({ code: "custom", message: "Invalid entry block." });
});
const optionsPageSchema = z.strictObject({
  items: z.array(entryOptionSchema), page: z.number().int().positive(), pageSize: z.number().int().positive(),
  totalCount: count, totalPages: count, hasPrevious: z.boolean(), hasNext: z.boolean(),
});
/** LD1-A: a value of the field to choose first, as the options take it; a null id stands for the options without a value («Sin rubro»). */
const entryGroupSchema = z.strictObject({ id: z.string().min(1).max(300).nullable(), text: z.string().min(1) });
const groupsSchema = z.strictObject({ groups: z.array(entryGroupSchema) });
const submittedSchema = z.strictObject({
  recordId: z.string().uuid(), number: z.string().min(1),
  state: z.enum(["Received", "PendingApproval", "Approved", "Rejected"]), submittedAtUtc: z.iso.datetime(),
});
// What a correction opens (CW10-A): the active version and the response mapped to it, its answers and its files. The block's
// answer carries its items, each with the answers of its questions as at the top.
// LD1-A: an answer of a question that chooses first by a field carries the value its saved option has now, which the first list starts with.
const correctionAnswerSchema = z.strictObject({ fieldId: z.string().uuid(), value: z.string().nullable(), choiceIds: z.array(z.string().uuid()).nullable(),
  options: z.array(entryOptionSchema).nullable(), group: entryGroupSchema.optional() });
const correctionSchema = z.strictObject({
  entry: formEntrySchema, recordId: z.string().uuid(), number: z.string().min(1),
  answers: z.array(correctionAnswerSchema.extend({ rows: z.array(z.array(correctionAnswerSchema)).optional() })),
  files: z.array(z.strictObject({ fileId: z.string().uuid(), fieldId: z.string().uuid(), name: z.string().min(1), contentType: z.string().min(1),
    size: z.number().int().positive(), hasThumbnail: z.boolean() })),
});
const localized = z.record(z.string().refine(key => key === "es" || key === "en"), z.string());
// «¿La emito?» (EM2-A, IV3): the document the issuer decided with why (`info`), the receiver, the date, the amounts it itemizes
// and the total, in canonical form; or why it cannot be issued as it is.
const issuePreviewSchema = z.strictObject({
  document: localized.nullable(), receiver: z.string().nullable(), total: z.string().nullable(),
  failureCode: z.string().min(1).nullable(), failureMessage: z.string().nullable(),
  info: localized.optional(), date: z.string().optional(), amounts: z.array(z.strictObject({ label: localized, value: z.string() })).optional(),
});
export type FormEntry = z.infer<typeof formEntrySchema>;
export type FormIssuePreview = z.infer<typeof issuePreviewSchema>;
export type FormEntryCorrection = z.infer<typeof correctionSchema>;
/**
 * The form of a response's own version as the app loads it, with its answers and files in that shape (VF1-A): the detail
 * reads with it, as the form, and its conditions say what is not drawn.
 */
export const responseEntrySchema = correctionSchema.pick({ entry: true, answers: true, files: true });
export type FormResponseEntry = z.infer<typeof responseEntrySchema>;
export type FormEntryKeptFile = FormEntryCorrection["files"][number];
export type FormEntryQuestion = FormEntry["questions"][number];
export type FormEntryOption = z.infer<typeof entryOptionSchema>;
export type FormEntryOptionsPage = z.infer<typeof optionsPageSchema>;
export type FormEntryGroup = z.infer<typeof entryGroupSchema>;
export type FormEntrySubmitted = z.infer<typeof submittedSchema>;
/** An answer of an item of the block: the canonical value of one of its questions. */
export interface FormEntryItemAnswer { fieldId: string; value: string }
/** A question's answer: its canonical value, the chosen ids of a multiple choice, or the items of the block (RG2-A). */
export type FormEntryAnswer = FormEntryItemAnswer | { fieldId: string; choiceIds: string[] } | { fieldId: string; rows: FormEntryItemAnswer[][] };
export interface FormEntrySend { requestId: string; versionId: string; answers: FormEntryAnswer[]; files: { fieldId: string; file: File }[] }

function read<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  // The issues may carry what the person typed: they are not kept.
  if (!result.success) throw new Error("Invalid form entry contract.");
  return result.data;
}
export const readFormEntry = (body: unknown) => read(formEntrySchema, body);
export const readFormEntryOptions = (body: unknown) => read(optionsPageSchema, body);
export const readFormEntryGroups = (body: unknown) => read(groupsSchema, body);
export const readFormEntrySubmitted = (body: unknown) => read(submittedSchema, body);
export const readFormEntryCorrection = (body: unknown) => read(correctionSchema, body);
export const readFormIssuePreview = (body: unknown) => read(issuePreviewSchema, body);

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
  signal: AbortSignal, answers: Readonly<Record<string, string>> = {}, recordId?: string, group?: FormEntryGroup): Promise<FormEntryOptionsPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: "50" });
  if (search) params.set("search", search);
  for (const [questionId, optionId] of Object.entries(answers)) params.set(`answers[${uuid.parse(questionId)}]`, uuid.parse(optionId));
  // LD1-A: only the options of the value chosen first, or those without one.
  if (group) { if (group.id === null) params.set("withoutGroup", "true"); else params.set("group", group.id); }
  const base = recordId ? correctionPath(formId, recordId) : entryPath(formId);
  return readFormEntryOptions(await api.get<unknown>(`${base}/versions/${uuid.parse(versionId)}/questions/${uuid.parse(fieldId)}/options?${params}`,
    { signal, cache: "no-store" }));
}
/**
 * LD1-A: the values of the field a question chooses first by, after the same filters as its options (and the same answers of a
 * dependent list); while correcting, those of whoever answered.
 */
export async function fetchFormEntryGroups(formId: string, versionId: string, fieldId: string, signal: AbortSignal,
  answers: Readonly<Record<string, string>> = {}, recordId?: string): Promise<FormEntryGroup[]> {
  const params = new URLSearchParams();
  for (const [questionId, optionId] of Object.entries(answers)) params.set(`answers[${uuid.parse(questionId)}]`, uuid.parse(optionId));
  const base = recordId ? correctionPath(formId, recordId) : entryPath(formId);
  const query = params.size ? "?" + params : "";
  return readFormEntryGroups(await api.get<unknown>(`${base}/versions/${uuid.parse(versionId)}/questions/${uuid.parse(fieldId)}/groups${query}`,
    { signal, cache: "no-store" })).groups;
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
/** What sending these answers would issue (EM2-A), without saving anything: the answers go as in the send, without files. */
export async function fetchFormIssuePreview(formId: string, send: Pick<FormEntrySend, "versionId" | "answers">, signal?: AbortSignal): Promise<FormIssuePreview> {
  return readFormIssuePreview(await api.post<unknown>(entryPath(formId) + "/issue-preview", { versionId: uuid.parse(send.versionId), answers: send.answers }, { signal }));
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
