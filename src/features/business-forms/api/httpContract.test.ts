// Bodies are unchanged HTTP bytes from the backend producer; see fixtures/forms-http/provenance.json.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { httpCohort } from "@/test/httpCohort";
import { openDraftSession } from "../draftSession";
import acceptedFixture from "@/test/fixtures/forms-http/published/accepted.json";
import acceptedStatusFixture from "@/test/fixtures/forms-http/published/accepted-status.json";
import publishedStatusFixture from "@/test/fixtures/forms-http/published/status-es.json";
import failedStatusFixture from "@/test/fixtures/forms-http/failed/status-en.json";
import publishedListFixture from "@/test/fixtures/forms-http/published/list-es.json";
import draftListFixture from "@/test/fixtures/forms-http/published/draft-list.json";
import failedDetailFixture from "@/test/fixtures/forms-http/failed/detail-es.json";
import { readFormDetail, readFormPage, readFormPublicationReceipt, readFormPublicationStatus, readFormPublicationCheck } from "./response";

import firstCheckFixture from "@/test/fixtures/forms-http/published/check-unavailable.json";
import nextCheckFixture from "@/test/fixtures/forms-http/published/check-next-unavailable.json";

// A fresh producer directory exercises these same guards without updating checked-in fixtures.
const input = process.env.FORMS_HTTP_CONTRACT_INPUT;
const body = <T,>(fallback: T, path: string): T => input ? JSON.parse(readFileSync(resolve(input, path), "utf8")) as T : fallback;
const accepted = body(acceptedFixture, "published/accepted.json");
const acceptedStatus = body(acceptedStatusFixture, "published/accepted-status.json");
const publishedStatus = body(publishedStatusFixture, "published/status-es.json");
const failedStatus = body(failedStatusFixture, "failed/status-en.json");
const publishedList = body(publishedListFixture, "published/list-es.json");
const draftList = body(draftListFixture, "published/draft-list.json");
const failedDetail = body(failedDetailFixture, "failed/detail-es.json");
const firstCheck = body(firstCheckFixture, "published/check-unavailable.json");
const nextCheck = body(nextCheckFixture, "published/check-next-unavailable.json");

describe("Actual backend HTTP contract", () => {
  it("reads Draft and Published lists including the active version number", () => {
    expect(readFormPage(draftList).items[0]?.displayState).toBe("Draft");
    expect(readFormPage(publishedList).items[0]).toMatchObject({ displayState: "Published", activeVersionNumber: 1 });
  });
  it("reads acceptance, empty issues during polling, publication and translated failure", () => {
    expect(readFormPublicationReceipt(accepted, accepted.definitionId, accepted.requestId, accepted.draftRevision).state).toBe("Accepted");
    for (const body of [acceptedStatus, publishedStatus, failedStatus]) expect(readFormPublicationStatus(body, body.definitionId, body.requestId)).toEqual(body);
    expect(readFormDetail(failedDetail).publication.currentOperation?.state).toBe("Failed");
    expect(failedStatus.issues[0]).toMatchObject({ fieldId: failedDetail.definition.draft.fields[0]?.fieldId, culture: "en" });
  });
  it("reads the next version number from actual checks before and after publication", () => {
    expect(readFormPublicationCheck(firstCheck, firstCheck.definitionId, firstCheck.draftRevision, [])).toEqual(firstCheck);
    expect(readFormPublicationCheck(nextCheck, nextCheck.definitionId, nextCheck.draftRevision, [])).toEqual(nextCheck);
    expect([firstCheck.nextVersionNumber, nextCheck.nextVersionNumber]).toEqual([1, 2]);
    expect(firstCheck.checkToken).toBeNull();
    expect(nextCheck.canAccept).toBe(false);
  });
  it("rejects missing or null issues rather than concealing drift from the actual HTTP contract", () => {
    const { issues, ...missing } = acceptedStatus;
    expect(issues).toEqual([]);
    expect(() => readFormPublicationStatus(missing, accepted.definitionId, accepted.requestId)).toThrow("Unsupported form response.");
    expect(() => readFormPublicationStatus({ ...acceptedStatus, issues: null }, accepted.definitionId, accepted.requestId)).toThrow("Unsupported form response.");
  });
});

it("verifies all sixty exact form captures from the common final run", () => {
 const provenance=httpCohort("forms").verify();
 expect(provenance.sources.some(source=>source.path.endsWith("FormHttpContractFixturesTests.cs"))).toBe(true);
 expect(provenance.sources.some(source=>source.path.endsWith("FormPublicationCheckTests.cs"))).toBe(true);
 expect(provenance.sources.some(source=>source.path.endsWith("FormPublicationLanguageTests.cs"))).toBe(true);
 expect(provenance.sources.some(source=>source.path.endsWith("FormRecipientFilterIntegrationTests.cs"))).toBe(true);
 expect(provenance.captures.map(entry=>entry.name).sort()).toEqual(["published/accepted-status.json","published/accepted.json","published/check-next-unavailable.json","published/check-unavailable.json","published/created.json","published/detail-en.json","published/detail-es.json","published/draft-detail.json","published/draft-list.json","published/list-en.json","published/list-es.json","published/status-en.json","published/status-es.json","failed/accepted-status.json","failed/accepted.json","failed/check-next-unavailable.json","failed/check-unavailable.json","failed/created.json","failed/detail-en.json","failed/detail-es.json","failed/draft-detail.json","failed/draft-list.json","failed/list-en.json","failed/list-es.json","failed/status-en.json","failed/status-es.json","budget-http/es.json","budget-http/en.json","multiple-choice/draft.json","multiple-choice/catalog-too-large.json",...(["es","en"] as const).flatMap(culture=>["recipient-missing","recipient-ready","recipient-samples","recipient-unavailable","source-check-warnings","source-draft"].map(kind=>"recipient-filters/"+kind+"-"+culture+".json")),...(["es","en"] as const).flatMap(original=>[1,2,3].flatMap(version=>["check","status","detail"].map(kind=>"languages/"+original+"/v"+version+"-"+kind+".json")))].sort());
});

// Run after the joint backend export; missing captures are not replaced with synthetic defaults.
for (const original of ["es", "en"] as const) it("reads sealed language additions and removals with " + original + " as the original from actual HTTP", () => {
  const secondary = original === "es" ? "en" : "es";
  const cohort = httpCohort("forms");
  const versionIds: string[] = [];
  for (const version of [1, 2, 3]) {
    const path = "languages/" + original + "/v" + version;
    const detail = readFormDetail(cohort.json(path + "-detail.json"));
    const fields = openDraftSession({ actorId: "contract", editorId: "language" }, detail.definition).value.draft.fields;
    const checked = readFormPublicationCheck(cohort.json(path + "-check.json"), detail.definition.id, detail.definition.revision, fields);
    const operation = detail.publication.currentOperation!;
    const status = readFormPublicationStatus(cohort.json(path + "-status.json"), detail.definition.id, operation.requestId!);
    const active = detail.publication.activeVersion!;
    const cultures = version === 2 ? ["en", "es"] : [original];
    expect(checked.nextVersionNumber).toBe(version);
    expect(checked.issues).toEqual([]);
    expect(checked.channels.flatMap(channel => channel.cultures).sort()).toEqual(cultures);
    expect(checked.cultures.find(item => item.isOriginal)).toMatchObject({ culture: original, isComplete: true, missing: [] });
    const report = checked.cultures.find(item => item.culture === secondary)!;
    expect(report.isComplete).toBe(version === 2);
    expect(report.missing.length > 0).toBe(version !== 2);
    expect(checked.diff).toMatchObject({ baseVersionId: versionIds.at(-1) ?? null, addedCultures: version === 1 ? [original] : version === 2 ? [secondary] : [], removedCultures: version === 3 ? [secondary] : [] });
    expect(status).toMatchObject({ state: "Published", versionId: active.versionId, versionNumber: version, cultures: active.cultures });
    expect([...active.cultures].sort()).toEqual(cultures);
    versionIds.push(active.versionId);
  }
  expect(new Set(versionIds).size).toBe(3);
});
