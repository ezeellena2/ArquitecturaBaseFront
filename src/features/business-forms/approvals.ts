export type ApprovalDecision = "Approved" | "Rejected";
export interface ApprovalDecisionBody {
    expectedRevision: number;
    decision: ApprovalDecision;
    reason?: string;
}
// RC4-A: an approval without «Exigir motivo al rechazar» (`reasonOptional`) rejects without a reason; the one given is still kept.
export function prepareApprovalDecision(expectedRevision: number, decision: ApprovalDecision, reason: string, reasonOptional = false): ApprovalDecisionBody | null {
    if (decision === "Approved")
        return { expectedRevision, decision };
    const trimmed = reason.trim();
    if (!trimmed) return reasonOptional ? { expectedRevision, decision } : null;
    return trimmed.length <= 500 ? { expectedRevision, decision, reason: trimmed } : null;
}

export function approvalStateVariant(state: "Received" | "PendingApproval" | "Open" | "Voided" | "Closed" | ApprovalDecision): "outline" | "warning" | "success" | "danger" {
    return state === "Approved" ? "success" : state === "Rejected" ? "danger" : state === "Open" || state === "PendingApproval" ? "warning" : "outline";
}
