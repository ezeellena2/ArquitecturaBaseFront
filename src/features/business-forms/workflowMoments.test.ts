import { expect, it } from "vitest";
import type { ResponseAction, ResponseWorkflow } from "./api/workflow";
import { responseDetailFixture, responseWorkflowFixture } from "@/test/responseFixtures";
import { composeWorkflowMoments } from "./workflowMoments";

const time = (seconds: string) => "2026-10-17T12:00:" + seconds + "Z";
const record = () => responseDetailFixture();
function action(id: string, overrides: Partial<ResponseAction> = {}): ResponseAction {
  return { id, ruleId: "rule", kind: "NotifyAuthor", event: "Received", order: 0, revision: 1, state: "Completed", reasonCode: null, reason: null, canConsult: false, canRetry: false, recipients: [], createdAtUtc: time("00"), updatedAtUtc: time("02"), completedAtUtc: time("02"), ...overrides };
}
function task(overrides: Partial<NonNullable<ResponseWorkflow["task"]>> = {}): NonNullable<ResponseWorkflow["task"]> {
  return { id: "approval", roleId: "role", roleName: "Supervisor", requestedAtUtc: time("03"), revision: 1, state: "Open", decidedAtUtc: null, decidedBy: null, reason: null, ...overrides };
}

it("shows the observed receipt and origin without inventing effects or approval", () => {
  const response = record();
  const moments = composeWorkflowMoments(response);
  expect(moments).toHaveLength(1);
  expect(moments[0]).toMatchObject({ kind: "received", atUtc: response.submittedAtUtc, origin: response.origin });
  expect(composeWorkflowMoments({ ...response, origin: null }, responseWorkflowFixture(response.id))[0]).toMatchObject({ origin: null });
});

it("groups observed receiving effects and represents a real approval task only once", () => {
  const response = record(), approval = task();
  const notice = action("notice"), request = action("request", { kind: "RequestApproval", order: 1 });
  const workflow: ResponseWorkflow = { ...responseWorkflowFixture(response.id), recordState: "PendingApproval", task: approval, actions: [request, notice] };
  expect(composeWorkflowMoments(response, workflow)).toEqual([
    expect.objectContaining({ kind: "received" }),
    { kind: "effects", key: "effects:Received", event: "Received", actions: [notice], completedCount: 1, totalCount: 1 },
    { kind: "approval", key: "approval:" + approval.id, task: approval },
  ]);
});

it("keeps an unsuccessful approval request observable without inventing a pending task", () => {
  const response = record();
  const failed = action("no-role", { kind: "RequestApproval", state: "Failed", reasonCode: "Forms.Rule.RoleUnavailable", reason: "Role unavailable", canConsult: false, canRetry: false });
  const workflow = { ...responseWorkflowFixture(response.id), actions: [failed] };
  const moments = composeWorkflowMoments(response, workflow);
  expect(moments.map(moment => moment.kind)).toEqual(["received", "effects"]);
  expect(moments[1]).toMatchObject({ actions: [failed], completedCount: 0, totalCount: 1 });
});

it.each(["Approved", "Rejected"] as const)("places %s effects after the actual decision, without a future or opposite branch", state => {
  const response = record();
  const decision = task({ state, decidedAtUtc: time("09"), decidedBy: { userId: "decider", displayName: "Luz" }, revision: 2, reason: state === "Rejected" ? "Incomplete" : null });
  const receiving = action("receiving"), effect = action("decision-effect", { event: state });
  const workflow: ResponseWorkflow = { ...responseWorkflowFixture(response.id), recordState: state, task: decision, actions: [effect, receiving] };
  const moments = composeWorkflowMoments(response, workflow);
  expect(moments.map(moment => moment.key)).toEqual(["received:" + response.id, "effects:Received", "approval:" + decision.id, "effects:" + state]);
  expect(moments[2]).toMatchObject({ task: { requestedAtUtc: time("03"), decidedAtUtc: time("09"), decidedBy: decision.decidedBy } });
  expect(moments[3]).toMatchObject({ actions: [effect] });
});

it("omits non applicable effects and empty groups while keeping active and failed actions", () => {
  const response = record();
  const omitted = action("not-applicable", { state: "NotApplicable" });
  const waiting = action("waiting", { state: "Waiting", completedAtUtc: null });
  const failed = action("failed", { state: "Failed" });
  const workflow = { ...responseWorkflowFixture(response.id), actions: [omitted, waiting, failed] };
  expect(composeWorkflowMoments(response, workflow)[1]).toMatchObject({ actions: [failed, waiting], completedCount: 0, totalCount: 2 });
  expect(composeWorkflowMoments(response, { ...workflow, actions: [omitted] }).map(moment => moment.kind)).toEqual(["received"]);
});

it("preserves chronological action evidence and distinct delivery and human review without rewriting a late acceptance", () => {
  const response = record();
  const recipient: ResponseAction["recipients"][number] = { user: { userId: "recipient", displayName: "Ana" }, channelId: "whatsapp", state: "Accepted", reasonCode: null, reason: null, canReview: false, deliveredAtUtc: time("07"), readAtUtc: time("08"), review: { wasSent: false, reviewedAtUtc: time("04"), reviewedBy: { userId: "reviewer", displayName: "Luz" } } };
  const late = action("late", { state: "Failed", updatedAtUtc: time("06"), completedAtUtc: time("06"), recipients: [recipient] });
  const early = action("early", { completedAtUtc: time("02.500") });
  const workflow = { ...responseWorkflowFixture(response.id), actions: [late, early] };
  const snapshot = structuredClone({ response, workflow });
  Object.freeze(workflow.actions); Object.freeze(response.history); Object.freeze(recipient);
  const moments = composeWorkflowMoments(response, workflow);
  expect(moments[1]).toMatchObject({ actions: [early, late], completedCount: 1, totalCount: 2 });
  expect({ response, workflow }).toEqual(snapshot);
});

it("orders receipt history by UTC while ignoring a workflow for another response", () => {
  const response = { ...record(), history: [
    { kind: "Saved" as const, atUtc: time("04"), actor: null },
    { kind: "Sent" as const, atUtc: time("00"), actor: null },
    { kind: "Submitted" as const, atUtc: time("02.500"), actor: null },
  ] };
  const foreign = { ...responseWorkflowFixture("foreign"), task: task(), actions: [action("private")] };
  const moments = composeWorkflowMoments(response, foreign);
  expect(moments).toHaveLength(1);
  expect(moments[0]).toMatchObject({ history: [response.history[1], response.history[2], response.history[0]] });
});

it("keeps a second matching approval rule failure even when the first request opened a task", () => {
  const response = record(), approval = task();
  const opened = action("opened", { kind: "RequestApproval", state: "Completed" });
  const failed = action("already-pending", { kind: "RequestApproval", state: "Failed", ruleId: "another-rule", reasonCode: "Forms.Action.ApprovalAlreadyPending", completedAtUtc: time("04") });
  const workflow: ResponseWorkflow = { ...responseWorkflowFixture(response.id), recordState: "PendingApproval", task: approval, actions: [opened, failed] };
  const moments = composeWorkflowMoments(response, workflow);
  expect(moments[1]).toMatchObject({ kind: "effects", actions: [failed], completedCount: 0, totalCount: 1 });
  expect(moments[2]).toMatchObject({ kind: "approval", task: approval });
});
