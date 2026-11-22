import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { formId, guid, UnsupportedFormResponse } from "./response";

// «Documentos recibidos» (DOC5-A, decisions 14 to 16): the documents a person with a linked account sent through a channel, newest
// first, with the counts of each state and the forms and senders under the other filters, the menu's counter, a document with its
// reading, the proposal of the form it was read for (each datum with its options when it is a choice), the forms it can be read for
// and its history, its file, and what «Revisar documentos» does with it (discard, reopen, change its form, which is read again like a
// dictation, and pass it to the form). Strict guards on the backend's shape (task 7 and its correction «7b»): a new member enters
// here first. Synthetic bodies in the tests until the coordinator exports the cohort `forms-documents-http`.
const utc = z.iso.datetime();
const count = z.number().int().nonnegative();
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
const unique = (ids: readonly string[]) => new Set(ids.map(id => id.toLowerCase())).size === ids.length;

export const receivedDocumentStates = ["proposed", "unclassified", "confirmed", "discarded"] as const;
export type ReceivedDocumentState = (typeof receivedDocumentStates)[number];
/** The states the list filters by: «Para revisar» are the proposed ones nobody waits for. */
export const receivedDocumentFilterStates = ["proposed", "forReview", "unclassified", "confirmed", "discarded"] as const;
export type ReceivedDocumentFilterState = (typeof receivedDocumentFilterStates)[number];
export const receivedDocumentQuestionTypes = ["shortText", "longText", "decimal", "date", "boolean", "choice"] as const;
export const receivedDocumentMarks = ["doubtful", "notRead", "invalid", "completed"] as const;
// «formChosen» is the person choosing a form of a doubt in the channel; «choseOther», choosing «Otro». VC1-A: «sent» is a row sent as one
// of the loads of its spreadsheet, with «{i}/{k}» in its detail; «overLimit», a row past the three loads of a message.
export const receivedDocumentEventKinds = ["received", "discarded", "reopened", "extractionRequested", "formChanged", "extractionFailed", "confirmed", "choseOther", "formChosen",
  "sent", "overLimit"] as const;

const person = z.strictObject({ userId: guid, displayName: z.string().nullable() });
const form = z.strictObject({ definitionId: guid, name: z.string() });
// Its file; `stored` is false for a rejected one the inbox kept no copy of (too big, an old format, macros): nothing to show or download.
// Only such a one can come without its size, when the channel never said it (one over the limit).
const file = z.strictObject({ name: z.string().min(1), mediaType: z.string().min(1), size: count.nullable(), pages: z.number().int().min(1).max(10).nullable(), stored: z.boolean() })
  .refine(entry => entry.size !== null || !entry.stored);
// VC1-A: a row of a spreadsheet is an entry of its own: its sheet only when the book has more than one, and its number as Excel numbers it.
const receivedDocumentRowSchema = z.strictObject({ sheet: z.string().min(1).nullable(), number: z.number().int().min(1) });
// Up to three data read that help find it, as the person reads them: the question and its value (an amount, a validated number, an
// option).
const highlight = z.strictObject({ fieldId: guid, label: z.string(), value: z.string() });
const item = z.strictObject({
  id: guid, receivedAtUtc: utc, channelId: z.string().min(1), sender: person, form: form.nullable(),
  state: z.enum(receivedDocumentStates),
  // A proposed one is for the team when nobody waits for its person (it cannot be sent, or its reply expired).
  forReview: z.boolean(), reasonCode: z.string().min(1).nullable(), documentType: z.string().min(1).nullable(),
  record: z.strictObject({ recordId: guid, number: z.string().min(1) }).nullable(), file,
  // Only a row of a spreadsheet, whose file is the spreadsheet.
  row: receivedDocumentRowSchema.optional(),
  highlights: z.array(highlight).max(3).refine(values => unique(values.map(value => value.fieldId))),
  deleteAfterUtc: utc.nullable(),
  // Until when its person is waited for in the channel: only while it waits for them, and then always (null when nobody is).
  replyExpiresAtUtc: utc.nullable(), revision,
}).refine(value => !value.forReview || value.state === "proposed")
  .refine(value => (value.replyExpiresAtUtc !== null) === (value.state === "proposed" && !value.forReview))
  .refine(value => value.record === null || value.state === "confirmed")
  .refine(value => value.deleteAfterUtc === null || value.state === "discarded" || value.state === "unclassified");
const counts = z.strictObject({ proposed: count, forReview: count, unclassified: count, confirmed: count, discarded: count })
  .refine(value => value.forReview <= value.proposed);
// The forms and the people the documents come with, each counted under the other filters: the options of «Formulario» and «Mandó».
// Each list brings the ones with the most documents (and always the chosen one), and says when it was cut.
const facets = z.strictObject({
  forms: z.array(z.strictObject({ definitionId: guid, name: z.string(), count })).refine(values => unique(values.map(value => value.definitionId))),
  senders: z.array(z.strictObject({ userId: guid, displayName: z.string().nullable(), count })).refine(values => unique(values.map(value => value.userId))),
  formsTruncated: z.boolean(), sendersTruncated: z.boolean(),
});
// DOC6 (task 14): a topic of «Formularios que faltan», by the name it was noted with, and the notice of similar documents: up to five
// topics that at least «Sugerir armar un formulario desde» unclassified documents share (Configuración › Formularios, RC4-A: 3 by
// default, never under 2) under the page's other filters (never its state's), the largest first, each with how many they are and the
// newest of them, up to the 20 a request takes. Always present, possibly empty.
const topic = z.strictObject({ id: guid, name: z.string().min(1).max(120) });
const group = z.strictObject({ topic, count: z.number().int().min(2), documentIds: z.array(guid).min(1).max(20).refine(unique) });
const groups = z.array(group).max(5).refine(values => unique(values.map(value => value.topic.id)));
// discardedRetentionDays: «Borrar los descartados» of Configuración › Formularios (RC1-A), for the help of the inbox.
const page = z.strictObject({ items: z.array(item), page: z.number().int().min(1), pageSize: z.number().int().min(1).max(100), totalCount: count, counts, facets, groups,
  discardedRetentionDays: z.number().int().min(1).max(3650) })
  .refine(value => value.items.length <= value.pageSize && unique(value.items.map(row => row.id)));
const menuCounts = z.strictObject({ forReview: count, unclassified: count, total: count }).refine(value => value.total === value.forReview + value.unclassified);

// What was read: whether it could be read and, when not whole, why; its language; its text in order and whether it was cut.
const reading = z.strictObject({
  readability: z.enum(["readable", "partial", "unreadable"]), problem: z.enum(["blurry", "dark", "cut", "covered", "other"]).nullable(),
  language: z.string().nullable(), text: z.string(), truncated: z.boolean(),
});
// A question of the form it was read for, as that version names it: its canonical value (null when it was not read) with what the
// person reads, its mark (read with doubts, not read, not passing its fixed validation with its code, completed by the server) and,
// for a choice, the options it can take (its own, or the ones of the catalog its sender sees), with the group of a catalog question that
// chooses first by a field (LD1-A); none when the reader cannot change it. A catalog choice the server does not list says why: too many
// options for its sender (they are searched apart, `searchReceivedDocumentOptions`) or a datum its catalog filters by that its sender
// lacks.
const option = z.strictObject({ id: guid, text: z.string(), group: z.string().nullable() });
const options = z.array(option).refine(values => unique(values.map(entry => entry.id)));
const unavailable = z.discriminatedUnion("reason", [
  z.strictObject({ reason: z.literal("tooMany") }),
  z.strictObject({ reason: z.literal("missingData"), datum: z.string().min(1) }),
]);
const value = z.strictObject({
  fieldId: guid, label: z.string(), type: z.enum(receivedDocumentQuestionTypes), required: z.boolean(),
  value: z.string().nullable(), text: z.string().nullable(), mark: z.enum(receivedDocumentMarks).nullable(), errorCode: z.string().min(1).nullable(),
  options: options.nullable(), optionsUnavailable: unavailable.nullable(),
}).refine(entry => (entry.value === null) === (entry.mark === "notRead"))
  .refine(entry => (entry.errorCode !== null) === (entry.mark === "invalid"))
  .refine(entry => (entry.options !== null) === (entry.type === "choice"))
  .refine(entry => entry.optionsUnavailable === null || entry.type === "choice" && entry.options?.length === 0);
const candidate = z.strictObject({ definitionId: guid, versionId: guid, name: z.string(), values: z.array(value).max(40).refine(values => unique(values.map(entry => entry.fieldId))) });
// Where the same document already is: a response of the form (with its number) or another document of the inbox. VC1-A: the data that
// matched, together and in the reader's language («Repetida: el mismo {dato} que {número}.»), and, for a row that repeats another row of
// the same spreadsheet, that row with its entry instead of a response.
const repetition = z.strictObject({ atUtc: utc, recordId: guid.nullable(), recordNumber: z.string().min(1).nullable(), documentId: guid.nullable(),
  labels: z.array(z.string().min(1)).min(1).refine(values => new Set(values).size === values.length).optional(), row: receivedDocumentRowSchema.optional() })
  .refine(value => value.row === undefined || value.documentId !== null && value.recordNumber === null);
const proposal = z.strictObject({
  outcome: z.enum(["sure", "doubt", "unknown"]), documentType: z.string().min(1).nullable(),
  candidates: z.array(candidate).max(3).refine(values => unique(values.map(entry => entry.definitionId))), repetition: repetition.nullable(),
});
// A load says which of the loads of its message it was, «1/3», up to three; one past them says nothing more.
const load = /^([1-3])\/([1-3])$/;
const sentAs = (detail: string | null) => { const match = detail === null ? null : load.exec(detail); return match !== null && Number(match[1]) <= Number(match[2]); };
const historyEvent = z.strictObject({ atUtc: utc, kind: z.enum(receivedDocumentEventKinds), actor: person.nullable(), detail: z.string().nullable() })
  .refine(event => event.kind !== "sent" || sentAs(event.detail))
  .refine(event => event.kind !== "overLimit" || event.detail === null);
const detail = z.strictObject({
  document: item, reading: reading.nullable(),
  // VC1-A: a row brings its cells with content as they came, each with the header of its column (its letter when that header is empty),
  // instead of the reading of a document.
  rowCells: z.array(z.strictObject({ header: z.string().min(1), value: z.string().min(1) })).min(1).optional(),
  proposal: proposal.nullable(),
  // The change of form that runs, while it runs.
  extraction: z.strictObject({ requestId: guid, definitionId: guid, requestedAtUtc: utc }).nullable(),
  history: z.array(historyEvent), canReview: z.boolean(),
  // The forms it can be read for, only for whoever reviews it.
  forms: z.array(form).refine(values => unique(values.map(entry => entry.definitionId))),
}).refine(entry => entry.canReview || entry.forms.length === 0)
  .refine(entry => (entry.rowCells !== undefined) === (entry.document.row !== undefined) && (entry.rowCells === undefined || entry.reading === null))
  // Only a row is one of the loads of its spreadsheet, or goes over their limit.
  .refine(entry => entry.document.row !== undefined || !entry.history.some(event => event.kind === "sent" || event.kind === "overLimit"));
// A change of form while it runs, after it or when it failed with its code.
const extraction = z.strictObject({ requestId: guid, state: z.enum(["pending", "completed", "failed"]), failureCode: z.string().min(1).nullable() })
  .refine(entry => (entry.failureCode !== null) === (entry.state === "failed"));
const recordResponse = z.strictObject({ documentId: guid, recordId: guid, number: z.string().min(1), state: z.string().min(1) });
// Up to fifty options of a choice the server does not list, searched by their text, and whether there were more.
const optionPage = z.strictObject({ items: z.array(option).max(50).refine(values => unique(values.map(entry => entry.id))), truncated: z.boolean() });

export type ReceivedDocument = z.infer<typeof item>;
export type ReceivedDocumentsPage = z.infer<typeof page>;
export type ReceivedDocumentFacets = z.infer<typeof facets>;
export type ReceivedDocumentCounts = z.infer<typeof counts>;
export type ReceivedDocumentMenuCounts = z.infer<typeof menuCounts>;
export type ReceivedDocumentDetail = z.infer<typeof detail>;
export type ReceivedDocumentValue = z.infer<typeof value>;
export type ReceivedDocumentCandidate = z.infer<typeof candidate>;
export type ReceivedDocumentEvent = z.infer<typeof historyEvent>;
export type ReceivedDocumentExtraction = z.infer<typeof extraction>;
export type ReceivedDocumentRecord = z.infer<typeof recordResponse>;
export type ReceivedDocumentOption = z.infer<typeof option>;
export type ReceivedDocumentOptionPage = z.infer<typeof optionPage>;
export type ReceivedDocumentTopic = z.infer<typeof topic>;
export type ReceivedDocumentGroup = z.infer<typeof group>;
/** A document as the list shows it, and a topic of «Formularios que faltan»: «Armar formulario con la IA» (DOC6) reads them too. */
export const receivedDocumentItemSchema = item;
export const receivedDocumentTopicSchema = topic;

/// The columns the server orders by (OT1-C); without one, the last received first. The data read do not order: they are kept encrypted.
export const receivedDocumentSortFields: readonly string[] = ["receivedAtUtc", "document", "sender", "form", "state", "deleteAfterUtc", "record"];
/** The private filters and the paging and order of the list: they travel in a body, never in a URL. */
export interface ReceivedDocumentsQuery {
  page: number;
  pageSize: number;
  /** "field" or "-field", one of `receivedDocumentSortFields`. */
  sort?: string;
  search?: string;
  definitionId?: string;
  senderUserId?: string;
  state?: ReceivedDocumentFilterState;
  receivedFromUtc?: string;
  receivedToUtc?: string;
}
/** An answer as the app sends it: the canonical value of a question, or the chosen option's id. */
export interface ReceivedDocumentAnswer { fieldId: string; value: string }

function read<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new UnsupportedFormResponse();
  return parsed.data;
}
export const readReceivedDocuments = (body: unknown) => read(page, body);
export const readReceivedDocumentMenuCounts = (body: unknown) => read(menuCounts, body);
export const readReceivedDocument = (body: unknown) => read(detail, body);
export const readReceivedDocumentExtraction = (body: unknown) => read(extraction, body);
export const readReceivedDocumentRecord = (body: unknown) => read(recordResponse, body);
export const readReceivedDocumentOptions = (body: unknown) => read(optionPage, body);

const path = (id: string) => `/api/forms/documents/${formId(id)}`;

// Private: the search carries amounts and CUIT, so the list is asked with a body and everything is read without the browser's cache.
export async function fetchReceivedDocuments(query: ReceivedDocumentsQuery, signal?: AbortSignal): Promise<ReceivedDocumentsPage> {
  const body = Object.fromEntries(Object.entries(query).filter(([, entry]) => entry !== undefined && entry !== ""));
  const result = readReceivedDocuments(await api.post<unknown>("/api/forms/documents/search", body, { signal, cache: "no-store" }));
  if (result.page !== query.page || result.pageSize !== query.pageSize) throw new UnsupportedFormResponse();
  return result;
}
export const fetchReceivedDocumentMenuCounts = async (signal?: AbortSignal) =>
  readReceivedDocumentMenuCounts(await api.get<unknown>("/api/forms/documents/counts", { signal, cache: "no-store" }));
export async function fetchReceivedDocument(id: string, signal?: AbortSignal): Promise<ReceivedDocumentDetail> {
  const result = readReceivedDocument(await api.get<unknown>(path(id), { signal, cache: "no-store" }));
  if (result.document.id.toLowerCase() !== id.toLowerCase()) throw new UnsupportedFormResponse();
  return result;
}
export const fetchReceivedDocumentFile = (id: string, signal?: AbortSignal) => api.blob(path(id) + "/file", { signal });

// Discarding and reopening answer the document as it stayed, one revision after the one seen.
async function review(action: "discard" | "reopen", id: string, expectedRevision: number, signal?: AbortSignal): Promise<ReceivedDocumentDetail> {
  const result = readReceivedDocument(await api.post<unknown>(path(id) + "/" + action, { expectedRevision }, { signal, cache: "no-store" }));
  if (result.document.id.toLowerCase() !== id.toLowerCase() || result.document.revision !== expectedRevision + 1) throw new UnsupportedFormResponse();
  return result;
}
export const discardReceivedDocument = (id: string, expectedRevision: number, signal?: AbortSignal) => review("discard", id, expectedRevision, signal);
export const reopenReceivedDocument = (id: string, expectedRevision: number, signal?: AbortSignal) => review("reopen", id, expectedRevision, signal);

// Changing its form: 202 with the request, which is then read until it ends; the same request again answers the same.
export async function changeReceivedDocumentForm(id: string, body: { requestId: string; definitionId: string; expectedRevision: number }, signal?: AbortSignal) {
  const result = readReceivedDocumentExtraction(await api.put<unknown>(path(id) + "/form", body, { signal, cache: "no-store" }));
  if (result.requestId.toLowerCase() !== body.requestId.toLowerCase()) throw new UnsupportedFormResponse();
  return result;
}
export async function fetchReceivedDocumentExtraction(id: string, requestId: string, signal?: AbortSignal) {
  const result = readReceivedDocumentExtraction(await api.get<unknown>(path(id) + "/extraction?requestId=" + formId(requestId), { signal, cache: "no-store" }));
  if (result.requestId.toLowerCase() !== requestId.toLowerCase()) throw new UnsupportedFormResponse();
  return result;
}

// Passing it to its form with what was reviewed, idempotent by the request's UUID: the same request answers its first response.
// A pass that repeats a saved response answers 409 `Forms.ReceivedDocument.Repeated`; the reviewer who saw it passes it again with `confirmRepeated`.
export async function passReceivedDocument(id: string, body: { requestId: string; versionId: string; expectedRevision: number; answers: readonly ReceivedDocumentAnswer[]; confirmRepeated?: boolean },
  signal?: AbortSignal): Promise<ReceivedDocumentRecord> {
  const result = readReceivedDocumentRecord(await api.post<unknown>(path(id) + "/records", body, { signal, cache: "no-store" }));
  if (result.documentId.toLowerCase() !== id.toLowerCase()) throw new UnsupportedFormResponse();
  return result;
}

// The options of a choice the server does not list (too many for its sender), searched with the question and the text in a body.
export const searchReceivedDocumentOptions = async (id: string, body: { fieldId: string; search: string }, signal?: AbortSignal) =>
  readReceivedDocumentOptions(await api.post<unknown>(path(id) + "/options", body, { signal, cache: "no-store" }));
