import type { ResponseDetail } from "./api/responses";
import type { ResponseAction, ResponseWorkflow } from "./api/workflow";
import type { RuleEvent } from "./rules";
import { composeWorkflowHistory } from "./workflowHistory";

type ApprovalTask = NonNullable<ResponseWorkflow["task"]>;
export type WorkflowMoment =
  | { kind: "received"; key: string; atUtc: string; origin: ResponseDetail["origin"]; history: ResponseDetail["history"] }
  | { kind: "effects"; key: string; event: RuleEvent; actions: ResponseAction[]; completedCount: number; totalCount: number }
  | { kind: "approval"; key: string; task: ApprovalTask };

export function composeWorkflowMoments(record: ResponseDetail, workflow?: ResponseWorkflow): WorkflowMoment[] {
  const observed = workflow?.recordId === record.id ? workflow : undefined;
  const history = composeWorkflowHistory(record, observed);
  const moments: WorkflowMoment[] = [{
    kind: "received", key: "received:" + record.id, atUtc: record.submittedAtUtc, origin: record.origin,
    history: history.flatMap(entry => entry.type === "record" ? [entry.event] : []),
  }];
  if (!observed) return moments;
  const task = observed.task;
  const addEffects = (event: RuleEvent) => {
    const actions = history.flatMap(entry => entry.type === "action" && entry.action.event === event &&
      entry.action.state !== "NotApplicable" && !(entry.action.kind === "RequestApproval" && entry.action.state === "Completed" && task) ? [entry.action] : []);
    if (actions.length > 0) moments.push({ kind: "effects", key: "effects:" + event, event, actions,
      completedCount: actions.filter(action => action.state === "Completed").length, totalCount: actions.length });
  };
  addEffects("Received");
  if (task) moments.push({ kind: "approval", key: "approval:" + task.id, task });
  if (observed.recordState === "Approved" || observed.recordState === "Rejected") addEffects(observed.recordState);
  return moments;
}
