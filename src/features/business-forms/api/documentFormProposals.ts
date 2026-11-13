import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { documentFormProposalSchema, type ProposedQuestion } from "../assistantProposal";
import { receivedDocumentItemSchema, receivedDocumentTopicSchema } from "./receivedDocuments";
import { formId, guid, UnsupportedFormResponse } from "./response";

// «Armar formulario con la IA» (DOC6, task 14): whoever reviews documents and designs forms asks for a form from one unclassified
// document or from the group of a topic (the notice of similar documents), waits for it like a dictation (202, then the same request until
// it ends) and creates the draft from its proposal as edited (201). Apart from the inbox's module: the menu's counter does not load the
// proposal's reading. Strict guards on the backend's shape; synthetic bodies in the tests until the coordinator exports the cohort
// `forms-documents-http`.
const unique = (ids: readonly string[]) => new Set(ids.map(id => id.toLowerCase())).size === ids.length;
// The proposal the assistant closed on, as Home shows one: its identity, what «Crear borrador» names, and the content of propose-form@2.
const proposal = z.strictObject({ id: guid, capability: z.literal("forms.authoring.propose-form"), version: z.literal(2), content: documentFormProposalSchema });
// A request while the assistant builds it, once it proposed a form or when it could not, with the code of why (the inbox's own, or the
// engine's as it is): the topic of its group, if it was asked for one; its documents, in the order they were attached and as the inbox
// lists them (the ones it already deleted are left out); and the draft «Crear borrador» created from it, which stays in any state.
const formProposal = z.strictObject({
  requestId: guid, state: z.enum(["pending", "completed", "failed"]), failureCode: z.string().min(1).nullable(), topic: receivedDocumentTopicSchema.nullable(),
  documents: z.array(receivedDocumentItemSchema).max(20).refine(values => unique(values.map(value => value.id))), proposal: proposal.nullable(),
  definitionId: guid.nullable(),
}).refine(value => (value.failureCode !== null) === (value.state === "failed"))
  .refine(value => (value.proposal !== null) === (value.state === "completed"));
const draft = z.strictObject({ proposalId: guid, definitionId: guid });

export type DocumentFormProposal = z.infer<typeof formProposal>;
export type DocumentFormDraft = z.infer<typeof draft>;
/** Asking for a form: the request's UUID (its repetition answers the same) and either one unclassified document or a topic. */
export type DocumentFormProposalBody =
  | { readonly requestId: string; readonly documentId: string; readonly topicId?: never }
  | { readonly requestId: string; readonly topicId: string; readonly documentId?: never };
/** A question of the edited form, as the proposal names them: its type, whether it is required and its own options or its catalog. */
export interface DocumentFormDraftQuestion {
  readonly label: string; readonly type: ProposedQuestion["type"]; readonly required: boolean; readonly options: readonly string[]; readonly catalogId: string | null;
}
/** «Crear borrador»: the request and the proposal it closed on, and the form as edited, with «Cómo reconocerlo» (the reading goes on). */
export interface DocumentFormDraftBody {
  readonly requestId: string; readonly proposalId: string; readonly name: string; readonly prefix: string; readonly submitLabel: string; readonly recognition: string;
  readonly questions: readonly DocumentFormDraftQuestion[];
}

function read<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new UnsupportedFormResponse();
  return parsed.data;
}
export const readDocumentFormProposal = (body: unknown) => read(formProposal, body);
export const readDocumentFormDraft = (body: unknown) => read(draft, body);

const path = "/api/forms/documents/form-proposals";
// The answer of another request is not this one.
function ofRequest(result: DocumentFormProposal, requestId: string): DocumentFormProposal {
  if (result.requestId.toLowerCase() !== requestId.toLowerCase()) throw new UnsupportedFormResponse();
  return result;
}
// Private: the proposal carries what the documents read, so nothing is cached.
export const requestDocumentFormProposal = async (body: DocumentFormProposalBody, signal?: AbortSignal) =>
  ofRequest(readDocumentFormProposal(await api.post<unknown>(path, body, { signal, cache: "no-store" })), body.requestId);
export const fetchDocumentFormProposal = async (requestId: string, signal?: AbortSignal) =>
  ofRequest(readDocumentFormProposal(await api.get<unknown>(path + "/" + formId(requestId), { signal, cache: "no-store" })), requestId);
// The same request again answers the draft it created and the proposal it was created from, whatever the body names.
export const createDocumentFormDraft = async (body: DocumentFormDraftBody, signal?: AbortSignal): Promise<DocumentFormDraft> =>
  readDocumentFormDraft(await api.post<unknown>("/api/forms/definitions/document-proposals", body, { signal, cache: "no-store" }));
