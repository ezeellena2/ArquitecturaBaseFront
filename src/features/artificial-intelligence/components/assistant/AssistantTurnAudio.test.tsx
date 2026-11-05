import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { AssistantTurnAudio } from "./AssistantTurnAudio";

const requestId = "0199a0c0-0000-7000-8000-000000000555";

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:recording");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => { toast.dismiss(); vi.restoreAllMocks(); });

describe("AssistantTurnAudio", () => {
  it("shows what the server heard and fetches the recording only when the person asks to listen", async () => {
    let reads = 0;
    server.use(http.get("/api/ai/assistant/audio/:id/file", () => {
      reads++;
      return new HttpResponse(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), { headers: { "Content-Type": "audio/webm" } });
    }));
    renderWithProviders(<AssistantTurnAudio requestId={requestId} transcript="Armame un formulario de visitas" />);
    expect(screen.getByText("Armame un formulario de visitas")).toHaveClass("assistant-transcript");
    expect(reads).toBe(0);
    await userEvent.click(screen.getByRole("button", { name: "Escuchar" }));
    expect((await screen.findByLabelText("Audio del mensaje")).tagName).toBe("AUDIO");
    expect(reads).toBe(1);
  });

  it("says so when the recording is no longer kept", async () => {
    const error = vi.spyOn(toast, "error");
    server.use(http.get("/api/ai/assistant/audio/:id/file", () => HttpResponse.json(
      { title: "Not found", status: 404, code: "Ai.Assistant.NotFound", detail: "No existe." }, { status: 404 })));
    renderWithProviders(<AssistantTurnAudio requestId={requestId} transcript="Armame un formulario" />);
    await userEvent.click(screen.getByRole("button", { name: "Escuchar" }));
    await waitFor(() => expect(error).toHaveBeenCalledWith("El audio ya no está disponible.", expect.anything()));
    expect(screen.getByRole("button", { name: "Escuchar" })).toBeEnabled();
  });
});
