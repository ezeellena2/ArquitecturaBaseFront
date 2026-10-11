import { api } from "@/shared/api/httpClient";
import { readThreadFormReplies, type FormReply } from "./formReplies";
import type { ChatFormMetadata, FormEligibility, LinkedAccount } from "./forms";

export type ChatMode = "Bot" | "Manual";
export type MessagePurpose = "Unclassified" | "Business" | "Access";
export type AccessEventKind = "SignInCode" | "VerifyPhoneCode" | "Invitation" | "AccessRequested" | "AccessInstructions";
export type OutgoingState = "Pending" | "Sending" | "Accepted" | "Failed" | "Uncertain" | "Reviewed";
export interface Chat {
  linkedAccount?: LinkedAccount | null; formEligibility?: FormEligibility | null;
  id: string; profileName: string | null; phoneNumber: string | null; mode: ChatMode; modeRevision: number;
  lastInboundAtUtc: string; lastInboundSequence: number; unreadCount: number; preview: string | null;
  previewPurpose?: MessagePurpose; previewAccessEventKind?: AccessEventKind | null;
}
export interface ChatMessage {
  id: string; direction: "Inbound" | "Outbound"; kind: string; body: string | null; occurredAtUtc: string;
  inboundSequence: number; operatorUserId: string | null; status: string | null; errorCode: number | null;
  purpose?: MessagePurpose; accessEventKind?: AccessEventKind | null;
  form?: ChatFormMetadata | null;
  formReply?: FormReply | null;
}
export interface Outgoing {
  kind?: "Text" | "Flow"; form?: ChatFormMetadata | null; recoveryPath?: string | null;
  id: string; requestId: string; operatorUserId: string; body: string | null; requestedAtUtc: string;
  state: OutgoingState; waMessageId: string | null;
}
export interface Thread { contact: Chat; messages: ChatMessage[]; outgoing: Outgoing[]; beforeAtUtc: string | null; beforeId: string | null; canReadFormRecords?: boolean }
export interface Chats { page: { items: Chat[]; totalCount: number; page: number; pageSize: number; totalPages: number }; allCount: number; unreadCount: number }
export const chatKey = ["whatsapp-chat"] as const;
const base = "/api/whatsapp/chats";
export const listChats = (page: number, search: string, unreadOnly: boolean, signal?: AbortSignal) =>
  api.get<Chats>(`${base}?${new URLSearchParams({ page: String(page), pageSize: "20", search, unreadOnly: String(unreadOnly) })}`, { signal });
export const getThread = async (id: string, cursor?: { at: string; id: string }, signal?: AbortSignal) =>
  readThreadFormReplies(await api.get<Thread>(`${base}/${id}/messages${cursor ? `?${new URLSearchParams({ beforeAtUtc: cursor.at, beforeId: cursor.id })}` : ""}`, { signal }));
export const markRead = (id: string, throughSequence: number) => api.put<void>(`${base}/${id}/read`, { throughSequence });
export const changeMode = (id: string, mode: ChatMode, expectedRevision: number) => api.put<void>(`${base}/${id}/mode`, { mode, expectedRevision });
export const sendText = (id: string, requestId: string, body: string) => api.post<Outgoing>(`${base}/${id}/messages`, { requestId, body });
export const findOutgoing = (id: string, requestId: string) => api.get<Outgoing>(`${base}/${id}/outgoing/${requestId}`);
export const reviewOutgoing = (id: string, requestId: string) => api.post<void>(`${base}/${id}/outgoing/${requestId}/review`);
