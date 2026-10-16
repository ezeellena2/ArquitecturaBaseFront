export type ApprovalDecision = "Approved" | "Rejected";
export interface ApprovalDecisionBody {
    expectedRevision: number;
    decision: ApprovalDecision;
    reason?: string;
}
export function prepareApprovalDecision(expectedRevision: number, decision: ApprovalDecision, reason: string): ApprovalDecisionBody | null {
    if (decision === "Approved")
        return { expectedRevision, decision };
    const trimmed = reason.trim();
    return trimmed && trimmed.length <= 500 ? { expectedRevision, decision, reason: trimmed } : null;
}
