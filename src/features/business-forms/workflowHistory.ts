import type { ResponseDetail } from "./api/responses";
import type { ResponseAction, ResponseWorkflow } from "./api/workflow";

type RecordHistoryEvent = ResponseDetail["history"][number];
type ApprovalTask = NonNullable<ResponseWorkflow["task"]>;
export type WorkflowHistoryEntry =
  | { type: "record"; key: string; atUtc: string; event: RecordHistoryEvent }
  | { type: "decision"; key: string; atUtc: string; task: ApprovalTask }
  | { type: "action"; key: string; atUtc: string; action: ResponseAction };

const typeOrder = { record: 0, decision: 1, action: 2 } as const;
const recordOrder: Record<RecordHistoryEvent["kind"], number> = { Sent: 0, Submitted: 1, Saved: 2 };
const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

export function composeWorkflowHistory(record: ResponseDetail, workflow?: ResponseWorkflow): WorkflowHistoryEntry[] {
  const entries: WorkflowHistoryEntry[] = record.history.map(event => ({
    type: "record", key: "record:" + event.kind + ":" + event.atUtc, atUtc: event.atUtc, event,
  }));
  if (workflow?.recordId === record.id) {
    const task = workflow.task;
    if (task && task.state !== "Open" && task.decidedAtUtc)
      entries.push({ type: "decision", key: "decision:" + task.id, atUtc: task.decidedAtUtc, task });
    for (const action of workflow.actions)
      entries.push({ type: "action", key: "action:" + action.id, atUtc: action.completedAtUtc ?? action.updatedAtUtc, action });
  }
  return entries.sort((left, right) => {
    const byInstant = Date.parse(left.atUtc) - Date.parse(right.atUtc);
    if (byInstant !== 0) return byInstant;
    const byType = typeOrder[left.type] - typeOrder[right.type];
    if (byType !== 0) return byType;
    if (left.type === "record" && right.type === "record")
      return recordOrder[left.event.kind] - recordOrder[right.event.kind];
    if (left.type === "action" && right.type === "action")
      return compareText(left.action.ruleId, right.action.ruleId) || left.action.order - right.action.order || compareText(left.action.id, right.action.id);
    return compareText(left.key, right.key);
  });
}
