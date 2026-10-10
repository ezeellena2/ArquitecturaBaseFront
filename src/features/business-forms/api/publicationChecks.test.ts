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
const checked = { definitionId: definition.id, draftRevision: definition.revision, compatibility: "Blocked", canAccept: false,
  acceptanceAvailability: "Unavailable", checkToken: null, checkExpiresAtUtc: null, channels: [], issues: [{ channelId: null, fieldId: definition.draft.fields[0]!.fieldId, choiceId: null,
    path: "draft.fields[0].help.en", code: "Forms.Publication.MissingTranslation", message: "Completá el inglés.", limit: null, culture: "en" }],
  diff: { baseVersionId: null, added: definition.draft.fields.map(q => q.fieldId), changed: [], removed: [] } };
afterEach(resetHttpClient);
describe("publication checks", () => {
  it("checks only the saved localized body without a draft UUID or external effects", async () => {
    let received: unknown;
    server.use(http.post("/api/forms/definitions/:id/publication-checks", async ({ request }) => {
      received = await request.json(); return HttpResponse.json(checked);
    }));
    const result = await checkFormPublication(definition.id, body);
    expect(received).toEqual(body);
    expect(received).not.toHaveProperty("requestId");
    expect(result.issues[0]).toMatchObject({ fieldId: definition.draft.fields[0]!.fieldId, culture: "en" });
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
