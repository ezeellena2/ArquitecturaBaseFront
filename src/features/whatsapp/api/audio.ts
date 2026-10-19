import { z } from "zod";
import { api } from "@/shared/api/httpClient";
export const chatAudioSchema = z.strictObject({ state: z.enum(["Pending", "Transcribing", "Completed", "Failed", "Uncertain", "Unavailable", "Expired"]), canPlay: z.boolean(), reasonCode: z.literal("tooLarge").nullable().optional() });
export type ChatAudio = z.infer<typeof chatAudioSchema>;
const path = (contactId: string, messageId: string) => "/api/whatsapp/chats/" + encodeURIComponent(contactId) + "/messages/" + encodeURIComponent(messageId);
export async function requestAudioTranscription(contactId: string, messageId: string, signal: AbortSignal) {
 const result = chatAudioSchema.safeParse(await api.post<unknown>(path(contactId, messageId) + "/audio-transcription", undefined, { signal, cache: "no-store" }));
 if (!result.success) throw new Error("Unsupported chat audio response.");
 return result.data;
}
export async function fetchChatAudio(contactId: string, messageId: string, signal: AbortSignal) {
 const blob = await api.blob(path(contactId, messageId) + "/audio", { signal, headers: { accept: "audio/ogg" } });
 if (blob.type.split(";")[0].trim().toLowerCase() !== "audio/ogg" || blob.size === 0) throw new Error("Unsupported chat audio response.");
 return blob;
}
