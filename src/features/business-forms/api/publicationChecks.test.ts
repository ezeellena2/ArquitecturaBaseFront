import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { checkFormPublication } from "./forms";
import { fixtureDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";

const definition = fixtureDefinition();
const value = openDraftSession({ actorId: "actor", editorId: "check" }, definition).value;
const body = { ...value, expectedRevision: definition.revision };
const checked = { definitionId: definition.id, draftRevision: definition.revision, nextVersionNumber: 1, compatibility: "Blocked", canAccept: false,
  acceptanceAvailability: "Unavailable", checkToken: null, checkExpiresAtUtc: null, channels: [], issues: [{ channelId: null, fieldId: definition.draft.fields[0]!.fieldId, choiceId: null,
    path: "draft.fields[0].help.es", code: "Forms.Publication.MissingTranslation", message: "Completá el original.", limit: null, culture: "es" }],
  cultures: [{ culture: "es" as const, isOriginal: true, isComplete: false, missing: [] }, { culture: "en" as const, isOriginal: false, isComplete: true, missing: [] }], warnings: [], diff: { baseVersionId: null, added: definition.draft.fields.map(q => q.fieldId), changed: [], removed: [], addedCultures: [], removedCultures: [] } };
afterEach(resetHttpClient);
describe("publication checks", () => {
  it("checks only the saved localized body without a draft UUID or external effects", async () => {
    let received: unknown;
    server.use(http.post("/api/forms/definitions/:id/publication-checks", async ({ request }) => {
      received = await request.json(); return HttpResponse.json(checked);
    }));
    const result = await checkFormPublication(definition.id, body);
    expect(received).toEqual({ name: body.name, prefix: body.prefix, draft: body.draft, expectedRevision: body.expectedRevision });
    expect(received).not.toHaveProperty("requestId");
    expect(result.issues[0]).toMatchObject({ fieldId: definition.draft.fields[0]!.fieldId, culture: "es" });
    expect(result.canAccept).toBe(false);
  });
  it.each([{ draftRevision: 2 }, { definitionId: "01990000-0000-7000-8000-000000000099" },
    { compatibility: "Published" }, { canAccept: true }, { previewUrl: "https://private.invalid/PRIVATE" }])("rejects a response that is not the current closed check: %j", async change => {
    server.use(http.post("/api/forms/definitions/:id/publication-checks", () => HttpResponse.json({ ...checked, ...change })));
    await expect(checkFormPublication(definition.id, body)).rejects.toThrow("Unsupported form response.");
  });
  it("reads an available ticket without inventing a published version", async () => {
    server.use(http.post("/api/forms/definitions/:id/publication-checks", () => HttpResponse.json({ ...checked, compatibility: "LocallyValidated", canAccept: true, acceptanceAvailability: "Available", issues: [], checkToken: "private-ticket", checkExpiresAtUtc: "2026-10-10T16:00:00Z" })));
    expect(await checkFormPublication(definition.id, body)).toMatchObject({ canAccept: true, checkToken: "private-ticket" });
  });
  it("reads an operation already in progress without an acceptance ticket", async () => {
    server.use(http.post("/api/forms/definitions/:id/publication-checks", () => HttpResponse.json({ ...checked, compatibility: "LocallyValidated", acceptanceAvailability: "InProgress", issues: [] })));
    expect(await checkFormPublication(definition.id, body)).toMatchObject({ canAccept: false, acceptanceAvailability: "InProgress" });
  });

  it("rejects question or option issues belonging outside the checked snapshot", async () => {
    for (const issue of [
      { ...checked.issues[0]!, fieldId: "01990000-0000-7000-8000-000000000099" },
      { ...checked.issues[0]!, choiceId: "01990000-0000-7000-8000-000000000099" },
    ]) {
      server.use(http.post("/api/forms/definitions/:id/publication-checks", () => HttpResponse.json({ ...checked, issues: [issue] })));
      await expect(checkFormPublication(definition.id, body)).rejects.toThrow("Unsupported form response.");
    }
  });
  it("does not retry a failed check automatically", async () => {
    let calls = 0;
    server.use(http.post("/api/forms/definitions/:id/publication-checks", () => { calls++; return HttpResponse.json({ code: "General.Unexpected" }, { status: 500 }); }));
    await expect(checkFormPublication(definition.id, body)).rejects.toThrow();
    expect(calls).toBe(1);
  });
});

it("uses the server's next version number and rejects a missing or invalid number", async () => {
  server.use(http.post("/api/forms/definitions/:id/publication-checks", () => HttpResponse.json({ ...checked, nextVersionNumber: 3 })));
  expect((await checkFormPublication(definition.id, body)).nextVersionNumber).toBe(3);
});

it.each([undefined, null, 0, -1, 1.5])("rejects invalid nextVersionNumber %s", async nextVersionNumber => {
  server.use(http.post("/api/forms/definitions/:id/publication-checks", () => HttpResponse.json({ ...checked, nextVersionNumber })));
  await expect(checkFormPublication(definition.id, body)).rejects.toThrow("Unsupported form response.");
});

it("excludes the live offer instruction from the closed publication check body", async () => {
  let received: unknown;
  server.use(http.post("/api/forms/definitions/:id/publication-checks", async ({ request }) => { received = await request.json(); return HttpResponse.json(checked); }));
  await checkFormPublication(definition.id, { ...body, offerWhen: "Cuando visita a un cliente" });
  expect(received).not.toHaveProperty("offerWhen");
  expect(received).toMatchObject({ name: body.name, prefix: body.prefix, draft: body.draft, expectedRevision: body.expectedRevision });
});

it("allows an incomplete secondary culture while preserving its missing texts outside blocking issues", async () => {
  const missing = checked.issues.map(issue => ({ ...issue, path: "draft.fields[0].help.en", culture: "en" }));
  const cultures = [{ culture: "es", isOriginal: true, isComplete: true, missing: [] }, { culture: "en", isOriginal: false, isComplete: false, missing }];
  const diff = { ...checked.diff, addedCultures: ["es"], removedCultures: [] };
  server.use(http.post("/api/forms/definitions/:id/publication-checks", () => HttpResponse.json({ ...checked, cultures, diff,
    compatibility: "LocallyValidated", canAccept: true, acceptanceAvailability: "Available", issues: [], checkToken: "private-ticket", checkExpiresAtUtc: "2099-10-10T16:00:00Z",
    channels: [{ channelId: "WhatsApp", profileRevision: "1", compatibility: "LocallyValidated", externalEvidence: "Pending", cultures: ["es"] }] })));
  expect(await checkFormPublication(definition.id, body)).toMatchObject({ canAccept: true, issues: [], cultures, diff });
});

it.each([{ cultures: undefined }, { diff: { ...checked.diff, addedCultures: undefined } }, { diff: { ...checked.diff, removedCultures: undefined } }])("rejects a check without the required language report or diff", async change => {
  server.use(http.post("/api/forms/definitions/:id/publication-checks", () => HttpResponse.json({ ...checked, ...change })));
  await expect(checkFormPublication(definition.id, body)).rejects.toThrow("Unsupported form response.");
});
it("rejects optional missing texts that belong to another snapshot", async () => {
  server.use(http.post("/api/forms/definitions/:id/publication-checks", () => HttpResponse.json({ ...checked, cultures: [{ culture: "en", isOriginal: false, isComplete: false, missing: [{ ...checked.issues[0]!, fieldId: "01990000-0000-7000-8000-000000000099" }] }] })));
  await expect(checkFormPublication(definition.id, body)).rejects.toThrow("Unsupported form response.");
});
