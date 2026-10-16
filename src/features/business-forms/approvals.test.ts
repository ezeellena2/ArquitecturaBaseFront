import { expect, it } from "vitest";
import { prepareApprovalDecision } from "./approvals";
it("requires a nonblank rejection reason of at most 500 characters", () => {
  expect(prepareApprovalDecision(3, "Rejected", "  ")).toBeNull();
  expect(prepareApprovalDecision(3, "Rejected", "a".repeat(501))).toBeNull();
  expect(prepareApprovalDecision(3, "Rejected", "  Falta la firma. ")).toEqual({ expectedRevision: 3, decision: "Rejected", reason: "Falta la firma." });
  expect(prepareApprovalDecision(3, "Rejected", "a".repeat(500))?.reason).toHaveLength(500);
});
it("approves without sending a rejection reason from a previous draft", () => {
  expect(prepareApprovalDecision(2, "Approved", "Old reason")).toEqual({ expectedRevision: 2, decision: "Approved" });
});
