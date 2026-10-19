import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { getThread } from "./chat";
import { fetchChatAudio, requestAudioTranscription } from "./audio";
const message = { id: "message-1", direction: "Inbound", kind: "Audio", body: null, occurredAtUtc: "2026-10-17T12:00:00Z", inboundSequence: 1, operatorUserId: null, status: null, errorCode: null, origin: "Conversation", assistant: null, quickReplies: null, audio: { state: "Pending", canPlay: true } };
const thread = { assistantAvailability: { state: "available" }, assistantSuggestion: null, contact: { id: "chat-1", mode: "Manual" }, messages: [message], outgoing: [], beforeAtUtc: null, beforeId: null };
it.each([
 { ...message, audio: undefined },
 { ...message, audio: { state: "Invented", canPlay: true } },
 { ...message, audio: { state: "Pending", canPlay: true, providerUrl: "PRIVATE" } },
])("rejects absent or unsupported audio metadata without retaining its payload %#", async row => {
 server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json({ ...thread, messages: [row] })));
 await expect(getThread("chat-1")).rejects.toThrow("Unsupported chat response.");
});
it.each(["Pending", "Transcribing", "Completed", "Failed", "Uncertain", "Unavailable", "Expired"])("preserves the explicit %s audio state", async state => {
 const body = { ...thread, messages: [{ ...message, audio: { state, canPlay: state !== "Expired" }, body: state === "Completed" ? "Transcripción histórica" : null }] };
 server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json(body)));
 expect((await getThread("chat-1")).messages[0]).toMatchObject(body.messages[0]);
});

it.each(["application/json", "text/html", "application/octet-stream"])("rejects %s instead of publishing private bytes as playable audio", async contentType => {
 server.use(http.get("/api/whatsapp/chats/chat-1/messages/audio-1/audio", () => new HttpResponse("PRIVATE bytes", { headers: { "content-type": contentType } })));
 await expect(fetchChatAudio("chat-1", "audio-1", new AbortController().signal)).rejects.toThrow("Unsupported chat audio response.");
});

for (const reasonCode of [undefined, null, "tooLarge"] as const) {
  const audio = { state: reasonCode === "tooLarge" ? "Unavailable" : "Pending", canPlay: true, ...(reasonCode === undefined ? {} : { reasonCode }) };
  const label = reasonCode === undefined ? "absent" : reasonCode === null ? "null" : reasonCode;
  it("preserves the safe " + label + " audio reason in a transcription receipt without changing playback", async () => {
    server.use(http.post("/api/whatsapp/chats/chat-1/messages/message-1/audio-transcription", () => HttpResponse.json(audio, { status: 202 })));
    expect(await requestAudioTranscription("chat-1", "message-1", new AbortController().signal)).toStrictEqual(audio);
  });
  it("preserves the safe " + label + " audio reason in the thread without changing playback", async () => {
    server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json({ ...thread, messages: [{ ...message, audio }] })));
    expect((await getThread("chat-1")).messages[0].audio).toStrictEqual(audio);
  });
}
it.each(["Files.Content.TooLarge", "unsupported", "", 42])("rejects an unsafe audio reason in both response paths without exposing it %#", async reasonCode => {
  const audio = { state: "Unavailable", canPlay: true, reasonCode };
  server.use(http.post("/api/whatsapp/chats/chat-1/messages/message-1/audio-transcription", () => HttpResponse.json(audio, { status: 202 })),
    http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json({ ...thread, messages: [{ ...message, audio }] })));
  await expect(requestAudioTranscription("chat-1", "message-1", new AbortController().signal)).rejects.toThrow("Unsupported chat audio response.");
  await expect(getThread("chat-1")).rejects.toThrow("Unsupported chat response.");
});
