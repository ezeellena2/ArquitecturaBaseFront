import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { fixtureDefinition, fixtureFormId, fixtureLifecycle, wireDefinition } from "@/test/visual/formFixtures";
import { openDraftSession } from "../draftSession";
import { createDraftReview, resolveDraftReview } from "../editorModel";
import { acceptFormPublication } from "./forms";
import { readFormDeactivation, readFormDetail, readFormPage } from "./response";

// SA1-A to SA5 (2026-11-09): what the backend adds for a form completed only in the app appears only when it is true, so every
// existing form keeps its bytes.
const definition = wireDefinition(fixtureDefinition());
const audit = { createdAtUtc: "2026-11-09T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-11-09T12:00:00Z", lastChangedBy: null };
const activeVersion = { versionId: "01990000-0000-7000-8000-000000000089", versionNumber: 4, draftRevision: 6, cultures: ["es"] };
const detail = { definition, lifecycle: fixtureLifecycle(definition.revision), audit, capabilities: { canSave: true, canPublish: true, canPreview: false },
  publication: { activeVersion, currentOperation: null, displayState: "Published" } };
const row = { id: fixtureFormId, name: { es: "Remito de prueba" }, prefix: "REM", questionCount: 6, activeVersionNumber: 4, displayState: "Published",
  lastChangedAtUtc: "2026-11-09T12:00:00Z", lastChangedBy: null, canEdit: true, lifecycle: fixtureLifecycle(definition.revision) };
const page = (item: object) => ({ items: [item], page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false });
afterEach(resetHttpClient);

describe("forms completed only in the app", () => {
  it("reads «Sólo en la app» in the draft and in the active version, and nothing when it is not", () => {
    const read = readFormDetail({ ...detail, definition: { ...definition, draft: { ...definition.draft, appOnly: true } },
      publication: { ...detail.publication, activeVersion: { ...activeVersion, appOnly: true } } });
    expect(read.definition.draft.appOnly).toBe(true);
    expect(read.publication.activeVersion?.appOnly).toBe(true);
    const plain = readFormDetail(detail);
    expect("appOnly" in plain.definition.draft).toBe(false);
    expect(plain.publication.activeVersion).not.toHaveProperty("appOnly");
  });

  it.each([{ draft: false }, { version: false }])("rejects a false that the backend never sends: %j", ({ draft, version }) => {
    expect(() => readFormDetail({ ...detail, definition: { ...definition, draft: { ...definition.draft, ...draft === undefined ? {} : { appOnly: draft } } },
      publication: { ...detail.publication, activeVersion: { ...activeVersion, ...version === undefined ? {} : { appOnly: version } } } })).toThrow("Unsupported form response.");
  });

  it("reads where each form of the list is completed and whether all its versions were only in the app", () => {
    const read = readFormPage(page({ ...row, appOnly: true, lifecycle: { ...row.lifecycle, publishedOnlyInApp: true } }));
    expect(read.items[0]).toMatchObject({ appOnly: true, lifecycle: { publishedOnlyInApp: true } });
    expect(readFormPage(page(row)).items[0]).not.toHaveProperty("appOnly");
    expect(() => readFormPage(page({ ...row, appOnly: false }))).toThrow("Unsupported form response.");
  });

  it("reads the lifecycle of a deactivation published only in the app", () => {
    const lifecycle = { ...fixtureLifecycle(2), publishedOnlyInApp: true as const };
    expect(readFormDeactivation({ definitionId: fixtureFormId, revision: 2, lifecycle }, fixtureFormId).lifecycle.publishedOnlyInApp).toBe(true);
  });

  it("reads a receipt published at once (SA3-A)", async () => {
    const requestId = "01990000-0000-7000-8000-000000000090";
    const path = `/api/forms/definitions/${definition.id}/publications/${requestId}`;
    const receipt = { requestId, operationId: "01990000-0000-7000-8000-000000000091", definitionId: definition.id, versionId: activeVersion.versionId,
      versionNumber: 4, draftRevision: 1, state: "Published", acceptedAtUtc: "2026-11-09T15:08:00Z", recoveryPath: path };
    server.use(http.post("/api/forms/definitions/:id/publications", () => HttpResponse.json(receipt, { status: 202 })));
    const body = { ...openDraftSession({ actorId: "a", editorId: "e" }, fixtureDefinition()).value, expectedRevision: 1, requestId, checkToken: "private-ticket" };
    expect((await acceptFormPublication(definition.id, body)).state).toBe("Published");
  });

  // A 409 lists «Dónde se completa» as one change and keeps the value chosen: the review rebuilds the draft from the saved one.
  it("compares «Dónde se completa» in a conflict and keeps the chosen value", () => {
    const saved = readFormDetail(detail).definition;
    const opened = openDraftSession({ actorId: "a", editorId: "e" }, saved).value;
    const review = createDraftReview({ ...opened, draft: { ...opened.draft, appOnly: true } }, saved);
    expect(review.rows.find(item => item.kind === "appOnly")).toMatchObject({ id: "appOnly", mine: "app", current: "channels", canKeep: true });
    const choose = (choice: "mine" | "current") => resolveDraftReview(review, Object.fromEntries(review.rows.map(item => [item.id, item.id === "appOnly" ? choice : "current"])));
    expect(choose("mine")?.draft.appOnly).toBe(true);
    expect(choose("current")?.draft).not.toHaveProperty("appOnly");
    expect(createDraftReview(opened, saved).rows.some(item => item.kind === "appOnly")).toBe(false);
  });
});
