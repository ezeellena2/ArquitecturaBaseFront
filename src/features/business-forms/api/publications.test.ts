
import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { acceptFormPublication, fetchFormPublication } from "./forms";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
const definition = fixtureDefinition();
const requestId = "01990000-0000-7000-8000-000000000090";
const body = { ...openDraftSession({ actorId: "a", editorId: "p" }, definition).value, expectedRevision: 1, requestId, checkToken: "private-ticket" };
const path = `/api/forms/definitions/${definition.id}/publications/${requestId}`;
const receipt = { requestId, operationId: "01990000-0000-7000-8000-000000000091", definitionId: definition.id,
  versionId: "01990000-0000-7000-8000-000000000092", versionNumber: 1, draftRevision: 1, state: "Accepted",
  acceptedAtUtc: "2026-10-10T16:00:00Z", recoveryPath: path };
const status = { ...receipt, recoveryPath: undefined, stage: "Accepted", updatedAtUtc: receipt.acceptedAtUtc,
  nextCheckAtUtc: null, canRetry: false, requiresReview: false, issues: [], cultures: ["es", "en"] };
afterEach(resetHttpClient);
describe("publication acceptance and own status", () => {
  it("posts the exact checked body and reads 202 as acceptance", async () => {
    let received: unknown;
    server.use(http.post("/api/forms/definitions/:id/publications", async ({ request }) => { received = await request.json(); return HttpResponse.json(receipt, { status: 202 }); }));
    expect(await acceptFormPublication(definition.id, body)).toEqual(receipt);
    expect(received).toEqual({ name: body.name, prefix: body.prefix, draft: body.draft, expectedRevision: body.expectedRevision, requestId: body.requestId, checkToken: body.checkToken });
  });
  it("constructs its own status path and reads publishing without calling POST", async () => {
    server.use(http.get(path, () => HttpResponse.json({ ...status, state: "Publishing", stage: "Validate" })));
    expect(await fetchFormPublication(definition.id, requestId)).toMatchObject({ state: "Publishing", stage: "Validate" });
  });
  it.each([{ recoveryPath: "https://private.invalid/ticket" }, { requestId: "01990000-0000-7000-8000-000000000099" },
    { definitionId: "01990000-0000-7000-8000-000000000099" }, { draftRevision: 2 }, { state: "Published" }])("rejects a mismatched acceptance receipt: %j", async change => {
    server.use(http.post("/api/forms/definitions/:id/publications", () => HttpResponse.json({ ...receipt, ...change }, { status: 202 })));
    await expect(acceptFormPublication(definition.id, body)).rejects.toThrow("Unsupported form response.");
  });
  it.each([{ cultures: undefined }, { state: "Unknown" }, { stage: null }, { previewUrl: "https://private.invalid/ticket" }])("rejects unsupported status: %j", async change => {
    server.use(http.get(path, () => HttpResponse.json({ ...status, ...change })));
    await expect(fetchFormPublication(definition.id, requestId)).rejects.toThrow("Unsupported form response.");
  });
  it("keeps a 404 as a read failure without repeating acceptance", async () => {
    let posts = 0;
    server.use(http.get(path, () => HttpResponse.json({ code: "Forms.Publication.NotFound" }, { status: 404 })),
      http.post("/api/forms/definitions/:id/publications", () => { posts++; return HttpResponse.json(receipt, { status: 202 }); }));
    await expect(fetchFormPublication(definition.id, requestId)).rejects.toThrow();
    expect(posts).toBe(0);
  });
});

it("reads translated rejection issues from own status without exposing technical metadata", async () => {
 const issues = [{channelId:"WhatsApp",fieldId:null,choiceId:null,path:"channel",code:"WhatsApp.Flow.ValidationFailed",message:"WhatsApp rechazó la validación del formulario.",limit:null,culture:"en"}];
 server.use(http.get(path,()=>HttpResponse.json({...status,state:"Failed",issues})));
 expect((await fetchFormPublication(definition.id,requestId)).issues).toEqual(issues);
});

it("excludes the live offer instruction from the closed publication acceptance body", async () => {
  let received: unknown;
  server.use(http.post("/api/forms/definitions/:id/publications", async ({ request }) => { received = await request.json(); return HttpResponse.json(receipt, { status: 202 }); }));
  const editorBody = { ...body, offerWhen: "Cuando visita a un cliente" };
  await acceptFormPublication(definition.id, editorBody);
  expect(received).not.toHaveProperty("offerWhen");
  expect(received).toMatchObject({ requestId: body.requestId, expectedRevision: body.expectedRevision, checkToken: body.checkToken });
});

it("reads the operation's captured cultures without deriving them from the draft", async () => {
  server.use(http.get(path, () => HttpResponse.json({ ...status, state: "Published", cultures: ["es"] })));
  expect(await fetchFormPublication(definition.id, requestId)).toMatchObject({ state: "Published", cultures: ["es"] });
});
