import { expect, it } from "vitest";
import { sameWorkflowReviewTarget, workflowCanReview, workflowNextAction } from "./workflow";
it("consults an uncertain action before allowing any retry and never repeats a confirmed action", () => {
  expect(workflowNextAction({ state: "Uncertain", canConsult: true, canRetry: true })).toBe("consult");
  expect(workflowNextAction({ state: "Uncertain", canConsult: false, canRetry: true })).toBeNull();
  expect(workflowNextAction({ state: "Failed", canConsult: false, canRetry: true })).toBe("retry");
  for (const state of ["Completed", "Waiting", "Running", "NotApplicable"] as const)
    expect(workflowNextAction({ state, canConsult: true, canRetry: true })).toBeNull();
});

it("offers human review only for an uncertain recipient with its server capability", () => {
  expect(workflowCanReview({ state: "Uncertain", canReview: true })).toBe(true);
  expect(workflowCanReview({ state: "Uncertain", canReview: false })).toBe(false);
  for (const state of ["NotFound", "Pending", "Sending", "Accepted", "Failed"] as const)
    expect(workflowCanReview({ state, canReview: true })).toBe(false);
});

it("matches a frozen review to the exact recipient and shared run revision", () => {
  const target = { runId: "run", recipientUserId: "member-one", expectedRevision: 3 };
  expect(sameWorkflowReviewTarget({ ...target }, target)).toBe(true);
  expect(sameWorkflowReviewTarget({ ...target, recipientUserId: "member-two" }, target)).toBe(false);
  expect(sameWorkflowReviewTarget({ ...target, expectedRevision: 4 }, target)).toBe(false);
  expect(sameWorkflowReviewTarget(null, target)).toBe(false);
});
