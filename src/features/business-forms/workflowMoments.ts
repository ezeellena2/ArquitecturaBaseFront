import type { ResponseDetail } from "./api/responses";
import type { ResponseAction, ResponseWorkflow } from "./api/workflow";
import type { RuleEvent } from "./rules";
import { composeWorkflowHistory } from "./workflowHistory";

type ApprovalTask = NonNullable<ResponseWorkflow["task"]>;
type Correction = NonNullable<ResponseDetail["correction"]>;
type Author = Correction["by"];
export type WorkflowMoment =
  | { kind: "received"; key: string; atUtc: string; origin: ResponseDetail["origin"]; history: ResponseDetail["history"] }
  | { kind: "effects"; key: string; event: RuleEvent; actions: ResponseAction[]; completedCount: number; totalCount: number }
  | { kind: "approval"; key: string; task: ApprovalTask; again: boolean }
  // How the version a correction replaced had been decided, with its PDF (CW10-A).
  | { kind: "previousDecision"; key: string; state: "Approved" | "Rejected"; atUtc: string; by: Author | null; pdfAtUtc: string | null }
  | { kind: "corrected"; key: string; correction: Correction }
  | { kind: "voided"; key: string; atUtc: string; by: Author; reason: string };

export type WorkflowMomentState = "completed" | "pending" | "failed" | "uncertain" | "rejected";
export function workflowMomentState(moment: WorkflowMoment): WorkflowMomentState {
  if (moment.kind === "received" || moment.kind === "corrected") return "completed";
  if (moment.kind === "previousDecision") return moment.state === "Rejected" ? "rejected" : "completed";
  if (moment.kind === "voided") return "rejected";
  if (moment.kind === "approval") return moment.task.state === "Open" ? "pending" : moment.task.state === "Rejected" ? "rejected" : "completed";
  const states = moment.actions.flatMap(action => [action.state, ...action.recipients.map(recipient => recipient.state)]);
  if (states.includes("Failed")) return "failed";
  if (states.includes("Uncertain")) return "uncertain";
  return states.some(state => state === "Waiting" || state === "Running" || state === "Pending" || state === "Sending") ? "pending" : "completed";
}

export function composeWorkflowMoments(record: ResponseDetail, workflow?: ResponseWorkflow): WorkflowMoment[] {
  const observed = workflow?.recordId === record.id ? workflow : undefined;
  const history = composeWorkflowHistory(record, observed);
  const moments: WorkflowMoment[] = [{
    kind: "received", key: "received:" + record.id, atUtc: record.submittedAtUtc, origin: record.origin,
    history: history.flatMap(entry => entry.type === "record" ? [entry.event] : []),
  }];
  // A correction tells how the version it replaced ended and who corrected it, why (CW10-A).
  const correction = record.correction;
  if (correction?.previousDecidedAtUtc && (correction.previousState === "Approved" || correction.previousState === "Rejected"))
    moments.push({ kind: "previousDecision", key: "previous:" + correction.previousRecordId, state: correction.previousState,
      atUtc: correction.previousDecidedAtUtc, by: correction.previousDecidedBy, pdfAtUtc: correction.previousPdfAtUtc });
  if (correction) moments.push({ kind: "corrected", key: "corrected:" + record.id, correction });
  const voided = record.void ? { kind: "voided" as const, key: "voided:" + record.id, ...record.void } : null;
  if (!observed) return voided ? [...moments, voided] : moments;
  // A task closed by a correction or a void decided nothing: the moment of the correction or the void tells it.
  const task = observed.task?.state === "Closed" ? null : observed.task;
  const addEffects = (event: RuleEvent) => {
    const actions = history.flatMap(entry => entry.type === "action" && entry.action.event === event &&
      entry.action.state !== "NotApplicable" && !(entry.action.kind === "RequestApproval" && entry.action.state === "Completed" && task) ? [entry.action] : []);
    if (actions.length > 0) moments.push({ kind: "effects", key: "effects:" + event, event, actions,
      completedCount: actions.filter(action => action.state === "Completed").length, totalCount: actions.length });
  };
  addEffects("Received");
  if (task) moments.push({ kind: "approval", key: "approval:" + task.id, task, again: task.state === "Open" && correction?.previousState === "Approved" });
  if (observed.recordState === "Approved" || observed.recordState === "Rejected") addEffects(observed.recordState);
  if (voided) moments.push(voided);
  return moments;
}
