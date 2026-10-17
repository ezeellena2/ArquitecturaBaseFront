import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { formMetadataSchema } from "./formMetadata";
import type { Outgoing } from "./chat";
const guid = z.string().uuid();
const field = z.strictObject({ fieldId: guid, label: z.string(), displayValue: z.string() });
const fields = z.array(field).max(40).refine(items => new Set(items.map(item => item.fieldId)).size === items.length);
export const assistantQuickRepliesSchema = z.array(z.string().min(1).max(20)).min(1).max(3);
export const assistantExplanationSchema = z.strictObject({ reason: z.string(), proposedFields: fields });
export type AssistantField = z.infer<typeof field>;
export type AssistantExplanation = z.infer<typeof assistantExplanationSchema>;
const state = z.enum(["Pending", "Ready", "NoReply", "Blocked", "Discarded", "Sent"]);
export type AssistantRequestState = z.infer<typeof state>;
export const assistantSuggestionPointerSchema = z.strictObject({ requestId: guid, sourceMessageId: guid, state });
export type AssistantSuggestionPointer = z.infer<typeof assistantSuggestionPointerSchema>;
const proposal = z.strictObject({ proposalId: guid, definitionId: guid, versionId: guid, versionNumber: z.number().int().positive().max(Number.MAX_SAFE_INTEGER), name: z.string(), culture: z.enum(["es", "en"]), reason: z.string(), fields });
export type AssistantProposal = z.infer<typeof proposal>;
const outgoing = z.strictObject({ id: guid, requestId: guid, operatorUserId: guid, body: z.string().nullable(), requestedAtUtc: z.string().datetime({ offset: true }), state: z.enum(["Pending", "Sending", "Accepted", "Failed", "Uncertain", "Reviewed"]), waMessageId: z.string().nullable(), kind: z.literal("Flow"), quickReplies: z.null(), origin: z.literal("Conversation"), form: formMetadataSchema, recoveryPath: z.string().nullable(), assistant: assistantExplanationSchema.nullable() });
const suggestion = assistantSuggestionPointerSchema.extend({ proposal: proposal.nullable(), outgoing: outgoing.nullable() }).refine(value => value.state === "Ready" ? value.proposal !== null && value.outgoing === null : value.state === "Sent" ? value.proposal === null && value.outgoing !== null : value.proposal === null && value.outgoing === null);
export type AssistantSuggestion = z.infer<typeof suggestion>;
export interface AssistantSuggestionRequest { requestId: string; sourceMessageId: string; expectedModeRevision: number }
export interface AssistantSendRequest { requestId: string; includedFieldIds: readonly string[] }
function unsupported(): never { throw new Error("Unsupported assistant response."); }
function ownedReceipt(receipt: Outgoing, contactId: string) { return receipt.recoveryPath == null || receipt.recoveryPath === "/api/whatsapp/chats/" + contactId + "/outgoing/" + receipt.requestId; }
export function parseAssistantSuggestion(value: unknown, contactId: string, expected: { sourceMessageId?: string; requestId?: string } = {}): AssistantSuggestion {
  const result = suggestion.safeParse(value);
  if (!result.success || expected.sourceMessageId && result.data.sourceMessageId !== expected.sourceMessageId || expected.requestId && result.data.requestId !== expected.requestId || result.data.outgoing && !ownedReceipt(result.data.outgoing, contactId)) return unsupported();
  return result.data;
}
const base = (contactId: string) => "/api/whatsapp/chats/" + contactId + "/assistant-suggestions";
export async function requestAssistantSuggestion(contactId: string, request: AssistantSuggestionRequest, signal?: AbortSignal) {
  return parseAssistantSuggestion(await api.post<unknown>(base(contactId), request, { signal }), contactId, { sourceMessageId: request.sourceMessageId });
}
export async function getAssistantSuggestion(contactId: string, requestId: string, signal?: AbortSignal) {
  return parseAssistantSuggestion(await api.get<unknown>(base(contactId) + "/" + requestId, { signal, cache: "no-store" }), contactId, { requestId });
}
export async function discardAssistantSuggestion(contactId: string, requestId: string, signal?: AbortSignal) {
  return parseAssistantSuggestion(await api.post<unknown>(base(contactId) + "/" + requestId + "/discard", undefined, { signal }), contactId, { requestId });
}
export async function sendAssistantSuggestion(contactId: string, suggestionId: string, request: AssistantSendRequest, signal?: AbortSignal) {
  const result = outgoing.safeParse(await api.post<unknown>(base(contactId) + "/" + suggestionId + "/send", request, { signal }));
  if (!result.success || !ownedReceipt(result.data, contactId)) return unsupported();
  return result.data;
}
