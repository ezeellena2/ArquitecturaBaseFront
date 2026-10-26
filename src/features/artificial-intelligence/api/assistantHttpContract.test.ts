import { http } from "msw";
import { expect, it } from "vitest";
import { z } from "zod";
import en from "@/locales/en/assistant.json";
import es from "@/locales/es/assistant.json";
import { httpCohort } from "@/test/httpCohort";
import { server } from "@/test/mocks/server";
import { createSubmission, isActiveTurn, projectMessages } from "../assistant/model";
import { assistantApi, type AssistantTurn } from "./assistant";

// The Home assistant bodies come unchanged from the joint backend export; nothing here is serialized by hand.
const cohort = httpCohort("aiAssistant");
const names = ["bootstrap.json", "submitted.json", "turn-pending.json", "turn-completed.json", "turns.json", "canceled.json"];
const identity = z.object({ requestId: z.uuid(), conversationId: z.uuid() });

it("qualifies the six Home assistant captures and their actual producer", () => {
  const provenance = cohort.verify();
  expect(provenance.captures.map(capture => capture.name).sort()).toEqual([...names].sort());
  for (const source of ["AiAssistantHttpContractTests.cs", "AiAssistantContractCapture.cs", "AiAssistantResponses.cs"])
    expect(provenance.sources.some(item => item.path.endsWith("/" + source))).toBe(true);
});

it("reads bootstrap, acceptance, turn, turns and cancellation through the strict client, MSW and the adapters", async () => {
  const submitted = identity.parse(cohort.json("submitted.json"));
  const canceledIdentity = identity.parse(cohort.json("canceled.json"));
  const received: { path: string; body?: unknown }[] = [];
  // The producer read the same turn twice: pending right after accepting it and completed after processing it.
  const turnBodies = ["turn-pending.json", "turn-completed.json"];
  server.use(
    http.get("/api/ai/assistant/bootstrap", () => cohort.response("bootstrap.json")),
    http.post("/api/ai/assistant/turns", async ({ request }) => {
      received.push({ path: new URL(request.url).pathname, body: await request.json() });
      return cohort.response("submitted.json", 202);
    }),
    http.get("/api/ai/assistant/turns/:requestId", ({ request }) => {
      received.push({ path: new URL(request.url).pathname });
      return cohort.response(turnBodies.shift()!);
    }),
    http.get("/api/ai/assistant/conversations/:conversationId/turns", ({ request }) => {
      const url = new URL(request.url);
      received.push({ path: url.pathname + url.search });
      return cohort.response("turns.json");
    }),
    http.post("/api/ai/assistant/turns/:requestId/cancel", ({ request }) => {
      received.push({ path: new URL(request.url).pathname });
      return cohort.response("canceled.json");
    }),
  );

  const bootstrap = await assistantApi.bootstrap();
  expect(bootstrap).toEqual(cohort.json("bootstrap.json"));
  expect(bootstrap.availability).toBe("available");

  // The captured acceptance answers the body the producer sent: «Hola», a new conversation and the connection revision.
  const body = createSubmission(submitted.requestId, "Hola", bootstrap.connectionRevision);
  const accepted = await assistantApi.submit(body);
  expect(accepted).toEqual(cohort.json("submitted.json"));
  expect(accepted).toMatchObject({ requestId: body.requestId, state: "pending", stage: "pending" });

  // Pending is active: the page keeps polling and shows only the question.
  const pending = await assistantApi.turn(accepted.requestId);
  expect(pending).toEqual(cohort.json("turn-pending.json"));
  expect(pending).toMatchObject({ state: "pending", stage: "pending", question: body.question, answer: null });
  expect(isActiveTurn(pending)).toBe(true);
  expect(projectMessages([pending]).map(message => message.role)).toEqual(["user"]);

  // Completed stops polling and shows the answer, with the evidence it cites.
  const completed = await assistantApi.turn(accepted.requestId);
  expect(completed).toEqual(cohort.json("turn-completed.json"));
  expect(completed).toMatchObject({ state: "completed", stage: "finished", failure: null });
  expect(isActiveTurn(completed)).toBe(false);
  expect(projectMessages([completed]).map(message => [message.role, message.content])).toEqual([
    ["user", [{ type: "text", text: body.question }]],
    ["assistant", [{ type: "text", text: completed.answer!.text }]],
  ]);
  expect(completed.answer!.evidenceIds).toEqual(completed.evidences.map(evidence => evidence.id));

  const turns = await assistantApi.turns(accepted.conversationId);
  expect(turns).toEqual(cohort.json("turns.json"));
  expect(turns.items).toEqual([completed]);

  // Canceled is finished: no answer, and the failure offers a new attempt.
  const canceled = await assistantApi.cancel(canceledIdentity.requestId);
  expect(canceled).toEqual(cohort.json("canceled.json"));
  expect(canceled).toMatchObject({ conversationId: accepted.conversationId, state: "canceled", stage: "finished", answer: null, failure: { code: "Ai.Assistant.Canceled", recovery: "newAttempt" } });
  expect(canceled.cancelRequestedAtUtc).not.toBeNull();
  expect(isActiveTurn(canceled)).toBe(false);
  expect(projectMessages([canceled]).map(message => message.role)).toEqual(["user"]);

  expect(received).toEqual([
    { path: "/api/ai/assistant/turns", body },
    { path: "/api/ai/assistant/turns/" + submitted.requestId },
    { path: "/api/ai/assistant/turns/" + submitted.requestId },
    { path: "/api/ai/assistant/conversations/" + submitted.conversationId + "/turns?page=1&pageSize=20&sort=-ordinal" },
    { path: "/api/ai/assistant/turns/" + canceledIdentity.requestId + "/cancel" },
  ]);
});

it.each([["es", es], ["en", en]] as const)("has the %s text of every captured state and of the stage of the active one", (_, texts) => {
  const states: Readonly<Record<string, string>> = texts.states, stages: Readonly<Record<string, string>> = texts.stages;
  const captured = ["turn-pending.json", "turn-completed.json", "canceled.json"].map(name => cohort.json(name) as AssistantTurn);
  expect(captured.map(turn => turn.state)).toEqual(["pending", "completed", "canceled"]);
  for (const turn of captured) {
    // AssistantOperationState shows the stage of an active turn and the state of a finished one.
    expect(states[turn.state]?.trim(), turn.state).toBeTruthy();
    if (isActiveTurn(turn)) expect(stages[turn.stage]?.trim(), turn.stage).toBeTruthy();
  }
});
