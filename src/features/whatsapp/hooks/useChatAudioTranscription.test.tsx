import { act, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { useChatAudioTranscription } from "./useChatAudioTranscription";
import * as audioApi from "../api/audio";
import { ApiError } from "@/shared/api/ApiError";
import { toast } from "sonner";
const message = { id: "audio-1", direction: "Inbound" as const, kind: "Audio", body: null, occurredAtUtc: "2026-10-17T12:00:00Z", inboundSequence: 1, operatorUserId: null, status: null, errorCode: null, origin: "Conversation" as const, assistant: null, quickReplies: null, audio: { state: "Pending" as const, canPlay: true } };
function Harness({ completed = false, enabled = true, owner = "actor-a", changed = vi.fn(), forbidden = vi.fn() }) {
 useChatAudioTranscription({ owner, contactId: "chat-1", enabled, messages: [{ ...message, audio: { state: completed ? "Completed" : "Pending", canPlay: true } }, { ...message, id: "audio-completed", audio: { state: "Completed", canPlay: true } }], onChanged: changed, onForbidden: forbidden });
 return <p>Audio abierto</p>;
}
it("requests only pending transcription once in Manual read scope, without requiring send or posting a body", async () => {
 const calls: string[] = []; const changed = vi.fn();
 server.use(http.post("/api/whatsapp/chats/chat-1/messages/:id/audio-transcription", async ({ params, request }) => { expect(await request.text()).toBe(""); calls.push(String(params.id)); return HttpResponse.json({ state: "Transcribing", canPlay: true }, { status: 202 }); }));
 const rendered = renderWithProviders(<Harness changed={changed}/>);
 await waitFor(() => expect(calls).toEqual(["audio-1"])); await waitFor(() => expect(changed).toHaveBeenCalledOnce());
 rendered.rerender(<Harness changed={changed}/>); await screen.findByText("Audio abierto"); expect(calls).toEqual(["audio-1"]);
});
it("does not interpret in Assistant mode or without read permission and starts when Manual reading is enabled", async () => {
 let calls = 0; server.use(http.post("/api/whatsapp/chats/chat-1/messages/:id/audio-transcription", () => { calls++; return HttpResponse.json({ state: "Transcribing", canPlay: true }, { status: 202 }); }));
 const rendered = renderWithProviders(<Harness enabled={false}/>); await screen.findByText("Audio abierto"); expect(calls).toBe(0);
 rendered.rerender(<Harness/>); await waitFor(() => expect(calls).toBe(1));
});
it("does not repeat an uncertain failed POST on a render or apply an old owner's completion", async () => {
 let calls = 0; const changed = vi.fn(); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
 server.use(http.post("/api/whatsapp/chats/chat-1/messages/:id/audio-transcription", async () => { calls++; await gate; return HttpResponse.json({ state: "Transcribing", canPlay: true }, { status: 202 }); }));
 const rendered = renderWithProviders(<Harness changed={changed}/>); await waitFor(() => expect(calls).toBe(1));
 rendered.rerender(<Harness enabled={false} owner="actor-b" changed={changed}/>); await act(async () => release()); expect(changed).not.toHaveBeenCalled();
});
it("withdraws the current read scope after a transcription 403", async () => {
 const forbidden = vi.fn(); server.use(http.post("/api/whatsapp/chats/chat-1/messages/:id/audio-transcription", () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 })));
 renderWithProviders(<Harness forbidden={forbidden}/>); await waitFor(() => expect(forbidden).toHaveBeenCalledOnce());
});

it.each([500, 429])("does not repeat a failed transcription request automatically after HTTP %s", async status => {
 let calls = 0; const changed = vi.fn(); server.use(http.post("/api/whatsapp/chats/chat-1/messages/:id/audio-transcription", () => { calls++; return HttpResponse.json({ code: "Test.Audio", retryAfter: 60 }, { status }); }));
 const rendered = renderWithProviders(<Harness changed={changed}/>); await waitFor(() => expect(calls).toBe(1));
 rendered.rerender(<Harness changed={changed}/>); await act(async () => {}); expect(calls).toBe(1); expect(changed).not.toHaveBeenCalled();
});

it("retires an operational request error once a shared completion is observed in the thread", async () => {
 let calls = 0; server.use(http.post("/api/whatsapp/chats/chat-1/messages/:id/audio-transcription", () => { calls++; return HttpResponse.json({ detail: "Transcripción no aceptada." }, { status: 400 }); }));
 const rendered = renderWithProviders(<Harness/>); await screen.findByText("Transcripción no aceptada.");
 rendered.rerender(<Harness completed/>);
 await waitFor(() => expect(screen.queryByText("Transcripción no aceptada.")).not.toBeInTheDocument());
 expect(calls).toBe(1);
});

it("ignores a late request error after the thread has already observed a shared completion", async () => {
 let reject!: (error: unknown) => void; let signal: AbortSignal | undefined;
 const pending = new Promise<never>((_, fail) => { reject = fail; });
 const request = vi.spyOn(audioApi, "requestAudioTranscription").mockImplementation((_contact, _message, current) => { signal = current; return pending; });
 const changed = vi.fn(); const rendered = renderWithProviders(<Harness changed={changed}/>);
 await waitFor(() => expect(request).toHaveBeenCalledOnce());
 rendered.rerender(<Harness completed changed={changed}/>);
 await act(async () => { reject(new ApiError(400, { detail: "Falló la solicitud anterior." })); });
 expect(toast.getToasts().filter(item => "title" in item && item.title === "Falló la solicitud anterior.")).toHaveLength(0);
 expect(signal?.aborted).toBe(true); expect(changed).not.toHaveBeenCalled();
 expect(request).toHaveBeenCalledOnce(); request.mockRestore();
});
