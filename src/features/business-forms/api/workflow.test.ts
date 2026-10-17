import { expect, it } from "vitest";
import { readResponseWorkflow, reviewResponseAction } from "./workflow";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
const recordId = "0199a0c0-0000-7000-8000-000000000011";
const runId = "0199a0c0-0000-7000-8000-000000000090";
const recipientUserId = "0199a0c0-0000-7000-8000-000000000092";
function actionResponse() {
  return { recordId, recordState: "Received", ruleRevision: 1, task: null, documents: [], actions: [{
    id: runId, ruleId: "0199a0c0-0000-7000-8000-000000000091", kind: "NotifyAuthor", event: "Received", order: 0,
    revision: 0, state: "Uncertain", reasonCode: null, reason: null, canConsult: true, canRetry: false,
    recipients: [{ user: { userId: recipientUserId, displayName: "Juan" }, channelId: "WhatsApp", state: "Uncertain", reasonCode: null, reason: null, canReview: true, deliveredAtUtc: null, readAtUtc: null, review: null }],
    createdAtUtc: "2026-10-17T12:00:00Z", updatedAtUtc: "2026-10-17T12:00:00Z", completedAtUtc: null,
  }] };
}
it("validates the record owner of a workflow response", () => {
  const body = { recordId, recordState: "Received", ruleRevision: null, task: null, actions: [], documents: [] };
  expect(readResponseWorkflow(body, recordId)).toEqual(body);
  expect(() => readResponseWorkflow(body, crypto.randomUUID())).toThrow("Invalid response workflow contract.");
});
it("rejects unsupported states without exposing private reasons", () => {
  const privateText = "private delivery reason";
  expect(() => readResponseWorkflow({ recordId, reason: privateText, recordState: "Unknown" }, recordId)).toThrow("Invalid response workflow contract.");
});
it("reads a failed role member without inventing an unavailable channel", () => {
  const body = actionResponse();
  const recipient = { ...body.actions[0].recipients[0], channelId: null, state: "Failed", canReview: false, reasonCode: "Forms.Action.ChannelUnavailable", reason: "No hay un canal disponible para avisarle." };
  const response = { ...body, actions: [{ ...body.actions[0], kind: "NotifyRole", state: "Completed", canConsult: false, recipients: [recipient] }] };
  expect(readResponseWorkflow(response, recordId).actions[0].recipients[0]).toEqual(recipient);
  expect(() => readResponseWorkflow({ ...response, actions: [{ ...response.actions[0], recipients: [{ ...recipient, channelId: "" }] }] }, recordId)).toThrow("Invalid response workflow contract.");
});
it("reads human recipient review evidence separately from channel delivery receipts", () => {
  const body = actionResponse();
  const review = { wasSent: true, reviewedAtUtc: "2026-10-17T13:00:00Z", reviewedBy: { userId: recordId, displayName: null } };
  const recipient = { ...body.actions[0].recipients[0], state: "Accepted", canReview: false, review };
  expect(readResponseWorkflow({ ...body, actions: [{ ...body.actions[0], state: "Waiting", recipients: [recipient] }] }, recordId).actions[0].recipients[0]).toMatchObject({ review, deliveredAtUtc: null, readAtUtc: null });
});
it("requires recipients and rejects the retired aggregate review contract", () => {
  const body = actionResponse();
  const { recipients: _recipients, ...oldAction } = body.actions[0];
  expect(() => readResponseWorkflow({ ...body, actions: [{ ...oldAction, canReview: true, review: null }] }, recordId)).toThrow("Invalid response workflow contract.");
  expect(() => readResponseWorkflow({ ...body, actions: [{ ...body.actions[0], recipients: [{ ...body.actions[0].recipients[0], review: { wasSent: true, reviewedAtUtc: "yesterday", reviewedBy: { userId: recordId, displayName: "Private name" } } }] }] }, recordId)).toThrow("Invalid response workflow contract.");
});
it.each(["NotFound", "Pending", "Sending", "Accepted", "Failed", "Uncertain"])("reads the explicit %s channel recipient state", state => {
  const body = actionResponse();
  expect(readResponseWorkflow({ ...body, actions: [{ ...body.actions[0], recipients: [{ ...body.actions[0].recipients[0], state }] }] }, recordId).actions[0].recipients[0].state).toBe(state);
});
it("rejects invented recipient delivery states and preserves actual receipt timestamps", () => {
  const body = actionResponse();
  const recipient = { ...body.actions[0].recipients[0], state: "Accepted", deliveredAtUtc: "2026-10-17T13:00:00Z", readAtUtc: "2026-10-17T13:01:00Z" };
  expect(readResponseWorkflow({ ...body, actions: [{ ...body.actions[0], recipients: [recipient] }] }, recordId).actions[0].recipients[0]).toEqual(recipient);
  expect(() => readResponseWorkflow({ ...body, actions: [{ ...body.actions[0], recipients: [{ ...recipient, state: "Delivered" }] }] }, recordId)).toThrow("Invalid response workflow contract.");
});
it.each([true, false])("posts a human review wasSent=%s to the exact recipient and run revision", async wasSent => {
  const body = actionResponse();
  const review = { wasSent, reviewedAtUtc: "2026-10-17T13:00:00Z", reviewedBy: { userId: recordId, displayName: "Luz" } };
  const response = { ...body, actions: [{ ...body.actions[0], state: wasSent ? "Waiting" : "Failed", canConsult: false, canRetry: !wasSent, recipients: [{ ...body.actions[0].recipients[0], state: wasSent ? "Accepted" : "Failed", canReview: false, review }] }] };
  let posted: unknown;
  server.use(http.post("/api/forms/records/:id/actions/:runId/review", async ({ request, params }) => {
    expect(params).toMatchObject({ id: recordId, runId }); posted = await request.json(); return HttpResponse.json(response, { status: 202 });
  }));
  expect(await reviewResponseAction(recordId, runId, { recipientUserId, expectedRevision: 0, wasSent })).toEqual(response);
  expect(posted).toEqual({ recipientUserId, expectedRevision: 0, wasSent });
});
it("requires a nonnegative attempt revision for human review", () => {
  const body = actionResponse();
  expect(readResponseWorkflow(body, recordId).actions[0]).toMatchObject({ revision: 0 });
  expect(() => readResponseWorkflow({ ...body, actions: [{ ...body.actions[0], revision: -1 }] }, recordId)).toThrow("Invalid response workflow contract.");
});
