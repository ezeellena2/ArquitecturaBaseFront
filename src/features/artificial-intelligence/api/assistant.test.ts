import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { assistantApi } from "./assistant";
const requestId = "0199a0c0-0000-7000-8000-000000000333";
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
});
