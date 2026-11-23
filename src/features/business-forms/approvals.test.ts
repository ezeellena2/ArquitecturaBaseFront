import { expect, it } from "vitest";
import { approvalStateVariant, prepareApprovalDecision } from "./approvals";
it("requires a nonblank rejection reason of at most 500 characters", () => {
  expect(prepareApprovalDecision(3, "Rejected", "  ")).toBeNull();
  expect(prepareApprovalDecision(3, "Rejected", "a".repeat(501))).toBeNull();
  expect(prepareApprovalDecision(3, "Rejected", "  Falta la firma. ")).toEqual({ expectedRevision: 3, decision: "Rejected", reason: "Falta la firma." });
  expect(prepareApprovalDecision(3, "Rejected", "a".repeat(500))?.reason).toHaveLength(500);
});
// RC4-A: without «Exigir motivo al rechazar» a rejection goes without a reason, and the one given is still trimmed and kept.
it("rejects without a reason when the approval does not ask for one", () => {
  expect(prepareApprovalDecision(4, "Rejected", "  ", true)).toEqual({ expectedRevision: 4, decision: "Rejected" });
  expect(prepareApprovalDecision(4, "Rejected", " Falta la firma. ", true)).toEqual({ expectedRevision: 4, decision: "Rejected", reason: "Falta la firma." });
  expect(prepareApprovalDecision(4, "Rejected", "a".repeat(501), true)).toBeNull();
});
it("approves without sending a rejection reason from a previous draft", () => {
  expect(prepareApprovalDecision(2, "Approved", "Old reason")).toEqual({ expectedRevision: 2, decision: "Approved" });
});

it.each([ ["Received", "outline"], ["Open", "warning"], ["PendingApproval", "warning"], ["Approved", "success"], ["Rejected", "danger"] ] as const)("uses the semantic badge for approval state %s", (state, variant) => {
  expect(approvalStateVariant(state)).toBe(variant);
});
