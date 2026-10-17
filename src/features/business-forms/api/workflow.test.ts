import { expect, it } from "vitest";
import { readResponseWorkflow, reviewResponseAction } from "./workflow";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
const recordId = "0199a0c0-0000-7000-8000-000000000011";
it("validates the record owner of a workflow response", () => {
  const body = { recordId, recordState: "Received", ruleRevision: null, task: null, actions: [], documents: [] };
  expect(readResponseWorkflow(body, recordId)).toEqual(body);
  expect(() => readResponseWorkflow(body, crypto.randomUUID())).toThrow("Invalid response workflow contract.");
});
it("rejects unsupported states without exposing private reasons", () => {
  const privateText = "private delivery reason";
  expect(() => readResponseWorkflow({ recordId, reason: privateText, recordState: "Unknown" }, recordId)).toThrow("Invalid response workflow contract.");
});

const runId = "0199a0c0-0000-7000-8000-000000000090";
function actionResponse() {
  return { recordId, recordState: "Received", ruleRevision: 1, task: null, documents: [], actions: [{
    id: runId, ruleId: "0199a0c0-0000-7000-8000-000000000091", kind: "NotifyAuthor", event: "Received", order: 0,
    revision: 0, state: "Uncertain", reasonCode: null, reason: null, canConsult: true, canRetry: false, canReview: true, review: null,
    createdAtUtc: "2026-10-17T12:00:00Z", updatedAtUtc: "2026-10-17T12:00:00Z", completedAtUtc: null,
  }] };
}
it("reads human review evidence separately from a delivery receipt", () => {
  const body = actionResponse();
  const review = { wasSent: true, reviewedAtUtc: "2026-10-17T13:00:00Z", reviewedBy: { userId: recordId, displayName: null } };
  expect(readResponseWorkflow({ ...body, actions: [{ ...body.actions[0], state: "Waiting", canReview: false, review }] }, recordId).actions[0]).toMatchObject({ review, state: "Waiting" });
});
it("requires explicit review capabilities and nullable evidence in every action", () => {
  const body = actionResponse();
  const { canReview: _canReview, review: _review, ...oldAction } = body.actions[0];
  expect(() => readResponseWorkflow({ ...body, actions: [oldAction] }, recordId)).toThrow("Invalid response workflow contract.");
  expect(() => readResponseWorkflow({ ...body, actions: [{ ...body.actions[0], review: { wasSent: true, reviewedAtUtc: "yesterday", reviewedBy: { userId: recordId, displayName: "Private name" } } }] }, recordId)).toThrow("Invalid response workflow contract.");
});

it.each([true, false])("posts an explicit human review wasSent=%s to the same record and run", async wasSent => {
  const body = actionResponse();
  const review = { wasSent, reviewedAtUtc: "2026-10-17T13:00:00Z", reviewedBy: { userId: recordId, displayName: "Luz" } };
  const response = { ...body, actions: [{ ...body.actions[0], state: wasSent ? "Waiting" : "Failed", canConsult: false, canReview: false, canRetry: !wasSent, review }] };
  let posted: unknown;
  server.use(http.post("/api/forms/records/:id/actions/:runId/review", async ({ request, params }) => {
    expect(params).toMatchObject({ id: recordId, runId });
    posted = await request.json();
    return HttpResponse.json(response, { status: 202 });
  }));
  expect(await reviewResponseAction(recordId, runId, wasSent, 0)).toEqual(response);
  expect(posted).toEqual({ expectedRevision: 0, wasSent });
});

it("requires a nonnegative attempt revision for human review", () => {
  const body = actionResponse();
  expect(readResponseWorkflow(body, recordId).actions[0]).toMatchObject({ revision: 0 });
  expect(() => readResponseWorkflow({ ...body, actions: [{ ...body.actions[0], revision: -1 }] }, recordId)).toThrow("Invalid response workflow contract.");
});
