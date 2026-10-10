import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { findOutgoing, type Outgoing } from "./chat";
import type { FormMessageRequest } from "../lib/formSendSession";

export type RecipientCulture = "es" | "en";
export interface LinkedAccount { userId: string; displayName: string; email: string | null; isActive: boolean }
export interface FormEligibility { status: "Eligible" | "NoLinkedAccount" | "InactiveAccount" | "NoEligibleForms"; recipientCulture: RecipientCulture | null; recipientContextRevision: string | null }
const culture = z.enum(["es", "en"]);
const guid = z.string().uuid();
const optionSchema = z.object({ definitionId: guid, versionId: guid, versionNumber: z.number().int().positive(), name: z.string().min(1), questionCount: z.number().int().nonnegative(), submitLabel: z.string().min(1) }).strict();
export type ChatFormOption = z.infer<typeof optionSchema>;
const formsSchema = z.object({ page: z.object({ items: z.array(optionSchema), page: z.number().int().positive(), pageSize: z.number().int().positive(), totalCount: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative(), hasPrevious: z.boolean(), hasNext: z.boolean() }).strict(), recipientCulture: culture, recipientContextRevision: z.string().min(1) }).strict();
export type ChatForms = z.infer<typeof formsSchema>;
const formMetadataSchema = z.object({ definitionId: guid, versionId: guid, versionNumber: z.number().int().positive(), name: z.string().min(1), culture }).strict();
export type ChatFormMetadata = z.infer<typeof formMetadataSchema>;
export function readFormMetadata(value: unknown): ChatFormMetadata | null { const parsed = formMetadataSchema.safeParse(value); return parsed.success ? parsed.data : null; }
const outgoingSchema = z.object({ id: guid, requestId: guid, operatorUserId: z.string().min(1), body: z.string().nullable(), requestedAtUtc: z.string().datetime({offset:true}), state: z.enum(["Pending", "Sending", "Accepted", "Failed", "Uncertain", "Reviewed"]), waMessageId: z.string().nullable(), kind: z.literal("Flow"), form: formMetadataSchema }).strict();

export class UnsupportedChatFormResponse extends Error { constructor() { super("Unsupported chat form response."); this.name = "UnsupportedChatFormResponse"; } }
function read<T>(schema: z.ZodType<T>, value: unknown): T { const result = schema.safeParse(value); if (!result.success) throw new UnsupportedChatFormResponse(); return result.data; }
export function parseChatForms(value: unknown): ChatForms { return read(formsSchema,value); }
export function parseFormOutgoing(value: unknown, request: FormMessageRequest, actor: string): Outgoing {
  const receipt = read(outgoingSchema,value);
  if (receipt.requestId !== request.requestId || receipt.operatorUserId !== actor || receipt.form.definitionId !== request.definitionId || receipt.form.versionId !== request.versionId || receipt.body !== request.message) throw new UnsupportedChatFormResponse();
  return receipt;
}
const base = "/api/whatsapp/chats";
export async function listChatForms(id: string, page: number, search: string, signal?: AbortSignal) {
  const query = new URLSearchParams({page:String(page),pageSize:"4",search});
  return parseChatForms(await api.get<unknown>(`${base}/${id}/forms?${query}`,{signal}));
}
export async function sendFormMessage(id: string, request: FormMessageRequest, actor: string) {
  return parseFormOutgoing(await api.post<unknown>(`${base}/${id}/form-messages`, request), request, actor);
}
export async function recoverFormMessage(id: string, request: FormMessageRequest, actor: string) {
  return parseFormOutgoing(await findOutgoing(id, request.requestId), request, actor);
}
