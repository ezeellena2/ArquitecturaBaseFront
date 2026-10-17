import { expect, it } from "vitest";
import { http } from "msw";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { getThread } from "./chat";
import { chatAudioSchema, requestAudioTranscription } from "./audio";
it("consumes the unchanged Read-only audio request and transcript projections produced by the API", async () => {
 const cohort = httpCohort("whatsappAudio"); const provenance = cohort.verify();
 expect(provenance.sources.some(source => source.path.endsWith("WhatsAppChatTests.Audio.cs"))).toBe(true);
 const requested = chatAudioSchema.parse(cohort.json("audio-request.json")); expect(requested.state).toBe("Pending");
 const metadata = cohort.json("audio-thread-pending.json") as { contact: { id: string }; messages: { id: string }[] };
 const contactId = metadata.contact.id; const messageId = metadata.messages[0].id;
 for (const state of ["pending", "completed"] as const) {
  const name = "audio-thread-" + state + ".json";
  server.use(http.get("/api/whatsapp/chats/" + contactId + "/messages", () => cohort.response(name)));
  const thread = await getThread(contactId); const message = thread.messages.find(row => row.kind === "Audio")!;
  expect(message.audio?.state).toBe(state === "pending" ? "Pending" : "Completed");
  expect(message.audio?.canPlay).toBe(true); expect(message.body).toBe(state === "pending" ? null : "Visité el local y tomé una foto.");
  expect(message.origin).toBe("Conversation");
 }
 server.use(http.post("/api/whatsapp/chats/" + contactId + "/messages/" + messageId + "/audio-transcription", () => cohort.response("audio-request.json", 202)));
 expect(await requestAudioTranscription(contactId, messageId, new AbortController().signal)).toEqual(requested);
});
