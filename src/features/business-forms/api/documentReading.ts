import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { formId, guid, UnsupportedFormResponse } from "./response";

// DOC1, «Cómo viene leyendo»: since the start of the window (`sinceUtc`, 30 days back), the documents confirmed into a response of the form;
// per question that received read data, how many it received and how many were confirmed without changes; the question corrected
// most often (null without corrections); the questions whose values mark a repeated document (empty for an own form); and the latest
// corrections, values of responses that come only with «Ver respuestas» (the key is omitted without it). Each question, once.
const count = z.number().int().nonnegative();
const unique = (ids: readonly string[]) => new Set(ids.map(id => id.toLowerCase())).size === ids.length;
const question = z.strictObject({ questionId: guid, read: count, unchanged: count }).refine(value => value.unchanged <= value.read);
// A correction: the response and its number, when it was confirmed, the question, and the value read and the one confirmed as display
// text in the language of whoever asks (empty when it was left empty).
const example = z.strictObject({ recordId: guid, recordNumber: z.string().min(1), confirmedAtUtc: z.iso.datetime(), questionId: guid, read: z.string(), confirmed: z.string() });
const reading = z.strictObject({
  sinceUtc: z.iso.datetime(), documents: count,
  questions: z.array(question).refine(items => unique(items.map(item => item.questionId))),
  mostCorrected: z.strictObject({ questionId: guid, corrections: z.number().int().min(1) }).nullable(),
  duplicateQuestionIds: z.array(guid).refine(unique),
  examples: z.array(example).max(10).optional(),
});

export type FormDocumentReadingStats = z.infer<typeof reading>;
export type FormDocumentReadingExample = z.infer<typeof example>;

export function readFormDocumentReading(body: unknown): FormDocumentReadingStats {
  const parsed = reading.safeParse(body);
  if (!parsed.success) throw new UnsupportedFormResponse();
  return parsed.data;
}

// Private: the corrections are values of responses, so it is read every time without the browser's cache.
export const fetchFormDocumentReading = async (id: string, signal?: AbortSignal): Promise<FormDocumentReadingStats> =>
  readFormDocumentReading(await api.get<unknown>(`/api/forms/definitions/${formId(id)}/document-reading`, { signal, cache: "no-store" }));
