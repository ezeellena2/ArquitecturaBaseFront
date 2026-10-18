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

export function approvalStateVariant(state: "Received" | "PendingApproval" | "Open" | ApprovalDecision): "outline" | "warning" | "success" | "danger" {
    return state === "Approved" ? "success" : state === "Rejected" ? "danger" : state === "Open" || state === "PendingApproval" ? "warning" : "outline";
}
