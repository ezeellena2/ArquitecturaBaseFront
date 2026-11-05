import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/test/mocks/server";
import { captureUploads } from "@/test/mocks/xhrUpload";
import { assistantApi } from "./assistant";
const requestId = "0199a0c0-0000-7000-8000-000000000333";
const audioRequestId = "0199a0c0-0000-7000-8000-000000000555";
const turn = {
  turnId: "0199a0c0-0000-7000-8000-000000000222",
  conversationId: "0199a0c0-0000-7000-8000-000000000111",
  requestId,
  ordinal: 1,
  conversationRevision: 2,
  turnRevision: 4,
  state: "completed",
  stage: "finished",
  contentAccess: "allowed",
  question: "¿Cuántos usuarios activos hay?",
  answer: {
    kind: "answer",
    text: "Hay tres usuarios activos.",
    evidenceIds: ["0199a0c0-0000-7000-8000-000000000444"],
  },
  evidences: [
    {
      id: "0199a0c0-0000-7000-8000-000000000444",
      sourceId: "users.summary",
      sourceVersion: 1,
      observedAtUtc: "2026-10-04T12:00:01Z",
      revision: null,
      destination: "users",
      requiredPermissions: ["users.read"],
      rows: [{ id: null, values: [{ label: "Activos", value: "3" }] }],
      isComplete: true,
    },
  ],
  failure: null,
  usage: { inputTokens: 20, outputTokens: 4, audioSeconds: null },
  culture: "es",
  timeZoneId: "America/Argentina/Buenos_Aires",
  submittedAtUtc: "2026-10-04T12:00:00Z",
  serverNowUtc: "2026-10-04T12:00:02Z",
  pollingAfterSeconds: 1,
  cancelRequestedAtUtc: null,
};
describe("assistant contract", () => {
  it("rejects a turn whose state is outside the published lowercase values", async () => {
    server.use(
      http.get("/api/ai/assistant/turns/:id", () =>
        HttpResponse.json({ ...turn, state: "Pending" }),
      ),
    );
    await expect(assistantApi.turn(requestId)).rejects.toThrow(
      "Invalid assistant contract.",
    );
  });
  it("rejects an acceptance receipt with fields outside the contract", async () => {
    server.use(
      http.post("/api/ai/assistant/turns", () =>
        HttpResponse.json(turn, { status: 202 }),
      ),
    );
    await expect(
      assistantApi.submit({
        requestId,
        conversationId: null,
        expectedRevision: null,
        expectedConnectionRevision: 7,
        question: turn.question,
      }),
    ).rejects.toThrow("Invalid assistant contract.");
  });
  it("reads a complete turn including usage and cancellation time", async () => {
    server.use(
      http.get("/api/ai/assistant/turns/:id", () => HttpResponse.json(turn)),
    );
    await expect(assistantApi.turn(requestId)).resolves.toEqual(turn);
  });
  it("reads a dictated turn with its recording and what the server heard", async () => {
    const dictated = { ...turn, question: "", audio: { requestId: audioRequestId, transcript: "Armame un formulario de visitas" } };
    server.use(http.get("/api/ai/assistant/turns/:id", () => HttpResponse.json(dictated)));
    await expect(assistantApi.turn(requestId)).resolves.toEqual(dictated);
    server.use(http.get("/api/ai/assistant/turns/:id", () => HttpResponse.json({ ...dictated, audio: { ...dictated.audio, extra: 1 } })));
    await expect(assistantApi.turn(requestId)).rejects.toThrow("Invalid assistant contract.");
  });
  it("uploads a recording in multipart under its own request and follows its normalization", async () => {
    const sends = captureUploads([{ status: 202,
      body: { requestId: audioRequestId, state: "pending", transcript: null, failure: null, pollingAfterSeconds: 1 } }]);
    server.use(http.get("/api/ai/assistant/audio/:id", () => HttpResponse.json(
      { requestId: audioRequestId, state: "completed", transcript: "Armame un formulario", failure: null, pollingAfterSeconds: 1 })));
    try {
      await expect(assistantApi.uploadAudio(audioRequestId, new Blob(["webm"], { type: "audio/webm;codecs=opus" })))
        .resolves.toMatchObject({ state: "pending", transcript: null });
      expect(sends[0].url).toBe("/api/ai/assistant/audio");
      expect(sends[0].body.get("requestId")).toBe(audioRequestId);
      expect((sends[0].body.get("file") as File).name).toBe("recording.webm");
      await assistantApi.uploadAudio(audioRequestId, new Blob(["mp4"], { type: "audio/mp4" }));
      expect((sends[1].body.get("file") as File).name).toBe("recording.m4a");
    } finally { vi.unstubAllGlobals(); }
    await expect(assistantApi.audio(audioRequestId)).resolves.toMatchObject({ state: "completed", transcript: "Armame un formulario" });
  });
  it("rejects a normalization status outside the contract", async () => {
    server.use(http.get("/api/ai/assistant/audio/:id", () => HttpResponse.json(
      { requestId: audioRequestId, state: "completed", transcript: "Hola", failure: null, pollingAfterSeconds: 1, text: "Hola" })));
    await expect(assistantApi.audio(audioRequestId)).rejects.toThrow("Invalid assistant contract.");
  });
});
