export const actionStates = ["Waiting", "Running", "Completed", "Failed", "Uncertain", "NotApplicable"] as const;
export type ActionState = typeof actionStates[number];
export function workflowNextAction(action: { state: ActionState; canConsult: boolean; canRetry: boolean }): "consult" | "retry" | null {
  if (action.state === "Uncertain") return action.canConsult ? "consult" : null;
  return action.state === "Failed" && action.canRetry ? "retry" : null;
}

export const recipientStates = ["NotFound", "Pending", "Sending", "Accepted", "Failed", "Uncertain"] as const;
export type RecipientState = typeof recipientStates[number];
export interface WorkflowReviewTarget { readonly runId: string; readonly recipientUserId: string; readonly expectedRevision: number }
export function workflowCanReview(recipient: { state: RecipientState; canReview: boolean }): boolean {
  return recipient.state === "Uncertain" && recipient.canReview;
}
export function sameWorkflowReviewTarget(left: WorkflowReviewTarget | null, right: WorkflowReviewTarget): boolean {
  return left?.runId === right.runId && left.recipientUserId === right.recipientUserId && left.expectedRevision === right.expectedRevision;
}
