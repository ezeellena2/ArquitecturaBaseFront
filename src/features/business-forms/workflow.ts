export const actionStates = ["Waiting", "Running", "Completed", "Failed", "Uncertain", "NotApplicable"] as const;
export type ActionState = typeof actionStates[number];
export function workflowNextAction(action: { state: ActionState; canConsult: boolean; canRetry: boolean }): "consult" | "retry" | null {
  if (action.state === "Uncertain") return action.canConsult ? "consult" : null;
  return action.state === "Failed" && action.canRetry ? "retry" : null;
}
