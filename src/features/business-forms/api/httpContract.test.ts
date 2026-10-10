// Bodies are unchanged HTTP bytes from the backend producer; see fixtures/forms-http/provenance.json.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
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
