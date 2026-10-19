import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ChatAudio } from "../api/audio";
import { buildTimeline } from "../lib/timeline";
import { ChatTimeline } from "./ChatTimeline";
const base = { audio: null, id: "audio-1", direction: "Inbound" as const, kind: "Audio", body: null as string | null, occurredAtUtc: "2026-10-17T12:00:00Z", inboundSequence: 1, operatorUserId: null, status: null, errorCode: null, origin: "Conversation" as const, assistant: null, quickReplies: null };
function view(state: ChatAudio["state"] = "Pending", canPlay = true, body: string | null = null, owner = "actor-a", denied = vi.fn(), reasonCode?: "tooLarge" | null) {
 const message = { ...base, audio: { state, canPlay, ...(reasonCode === undefined ? {} : { reasonCode }) }, body };
 return <ChatTimeline items={buildTimeline([message], [])} contactId="chat-1" readOwner={owner} onAudioForbidden={denied} actor="actor-a" canSend={false} canReuse={false} reviewing={false} onReview={vi.fn()} onReuse={vi.fn()} atBottom onAtBottomChange={vi.fn()} hasOlder={false} loadingOlder={false} historyError={false} loadOlder={vi.fn()}/>;
}
afterEach(async () => { vi.unstubAllGlobals(); vi.restoreAllMocks(); await act(async () => { await i18n.changeLanguage("es"); }); });
it("lets a read-only operator listen while transcription is pending without loading bytes on render", async () => {
 let reads = 0; server.use(http.get("/api/whatsapp/chats/chat-1/messages/audio-1/audio", () => { reads++; return new HttpResponse("OggS", { headers: { "content-type": "audio/ogg" } }); }));
 renderWithProviders(view());
 expect(await screen.findByRole("button", { name: "Escuchar audio" })).toBeEnabled();
 expect(screen.getByText("Pasando el audio a texto…")).toBeVisible();
 expect(reads).toBe(0);
});
it("keeps the completed transcription below the audio and never presents it as an ordinary text message", async () => {
 await act(async () => { renderWithProviders(view("Completed", true, "Texto transcripto histórico")); });
 expect(screen.getByText("Transcripción")).toBeVisible(); expect(screen.getByText("Texto transcripto histórico")).toBeVisible();
});
it("withdraws an expired transcript and offers no playback even if a stale body is present", async () => {
 await act(async () => { renderWithProviders(view("Expired", false, "PRIVATE expired transcript")); });
 expect(screen.queryByText("PRIVATE expired transcript")).not.toBeInTheDocument();
 expect(screen.queryByRole("button", { name: "Escuchar audio" })).not.toBeInTheDocument();
 expect(screen.getByText("El audio y su transcripción ya no están disponibles.")).toBeVisible();
});
it("keeps private playback bytes outside caches and revokes the URL on owner change", async () => {
 const create = vi.fn(() => "blob:private-audio"); const revoke = vi.fn();
 vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
 vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(); vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
 server.use(http.get("/api/whatsapp/chats/chat-1/messages/audio-1/audio", () => new HttpResponse("OggS", { headers: { "content-type": "audio/ogg" } })));
 const rendered = renderWithProviders(view()); await userEvent.click(screen.getByRole("button", { name: "Escuchar audio" }));
 await waitFor(() => expect(screen.getByLabelText("Audio recibido")).toHaveAttribute("src", "blob:private-audio"));
 rendered.rerender(view("Pending", true, null, "actor-b"));
 await waitFor(() => expect(revoke).toHaveBeenCalledWith("blob:private-audio"));
 expect(screen.queryByLabelText("Audio recibido")).not.toBeInTheDocument();
});
it("retires playback when the private endpoint confirms revoked read permission", async () => {
 const denied = vi.fn(); server.use(http.get("/api/whatsapp/chats/chat-1/messages/audio-1/audio", () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 })));
 renderWithProviders(view("Completed", true, "Texto privado", "actor-a", denied));
 await userEvent.click(screen.getByRole("button", { name: "Escuchar audio" }));
 await waitFor(() => expect(denied).toHaveBeenCalledOnce());
 expect(screen.queryByLabelText("Audio recibido")).not.toBeInTheDocument();
});
it("aborts a pending audio read and ignores its late bytes after unmount", async () => {
 let release!: () => void; let requested = false; const gate = new Promise<void>(resolve => { release = resolve; });
 const create = vi.fn(); vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = vi.fn(); });
 server.use(http.get("/api/whatsapp/chats/chat-1/messages/audio-1/audio", async () => { requested = true; await gate; return new HttpResponse("OggS", { headers: { "content-type": "audio/ogg" } }); }));
 const rendered = renderWithProviders(view()); await userEvent.click(screen.getByRole("button", { name: "Escuchar audio" })); await waitFor(() => expect(requested).toBe(true));
 rendered.unmount(); await act(async () => release()); expect(create).not.toHaveBeenCalled();
});

it("keeps the playback action paused after 429 without retrying when its wait expires", async () => {
 let reads = 0; server.use(http.get("/api/whatsapp/chats/chat-1/messages/audio-1/audio", () => { reads++; return HttpResponse.json({ code: "RateLimit.Exceeded", retryAfter: 60 }, { status: 429 }); }));
 renderWithProviders(view()); await userEvent.click(screen.getByRole("button", { name: "Escuchar audio" }));
 await waitFor(() => expect(screen.getByRole("button", { name: "Escuchar audio" })).toBeDisabled());
 const now = performance.now(); vi.spyOn(performance, "now").mockReturnValue(now + 61000);
 await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
 await waitFor(() => expect(screen.getByRole("button", { name: "Escuchar audio" })).toBeEnabled());
 expect(reads).toBe(1);
});

it("keeps a stored audio playable when transcription is unavailable", async () => {
 await act(async () => { renderWithProviders(view("Unavailable", true)); });
 expect(screen.getByRole("button", { name: "Escuchar audio" })).toBeEnabled();
 expect(screen.getByText("No pudimos pasar este audio a texto. Escuchalo: el asistente no lo va a responder.")).toBeVisible();
});

for (const language of ["es", "en"] as const) {
  it("explains an oversized transcript in " + language + " while retaining authorized listening and retiring expired text", async () => {
    await act(async () => { await i18n.changeLanguage(language); });
    const text = language === "es" ? "El audio es demasiado grande para pasarlo a texto." : "The audio is too large to transcribe.";
    const listen = language === "es" ? "Escuchar audio" : "Listen to audio";
    let rendered!: ReturnType<typeof renderWithProviders>;
    await act(async () => { rendered = renderWithProviders(view("Unavailable", true, null, "actor-a", vi.fn(), "tooLarge")); });
    expect(screen.getByText(text)).toBeVisible();
    expect(screen.getByRole("button", { name: listen })).toBeEnabled();
    expect(screen.queryByText(/tooLarge|Files\.Content/)).not.toBeInTheDocument();
    rendered.rerender(view("Unavailable", false, null, "actor-a", vi.fn(), "tooLarge"));
    expect(screen.getByText(text)).toBeVisible();
    expect(screen.queryByRole("button", { name: listen })).not.toBeInTheDocument();
    rendered.rerender(view("Expired", false, "PRIVATE expired transcript", "actor-a", vi.fn(), "tooLarge"));
    expect(screen.queryByText(text)).not.toBeInTheDocument();
    expect(screen.queryByText("PRIVATE expired transcript")).not.toBeInTheDocument();
    expect(screen.getByText(language === "es" ? "El audio y su transcripción ya no están disponibles." : "The audio and its transcription are no longer available.")).toBeVisible();
    expect(screen.queryByRole("button", { name: listen })).not.toBeInTheDocument();
  });
}
