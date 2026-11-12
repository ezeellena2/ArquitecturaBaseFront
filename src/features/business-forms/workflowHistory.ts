import type { ResponseDetail } from "./api/responses";
import type { ResponseAction, ResponseWorkflow } from "./api/workflow";

type RecordHistoryEvent = ResponseDetail["history"][number];
type ApprovalTask = NonNullable<ResponseWorkflow["task"]>;
export type WorkflowHistoryEntry =
  | { type: "record"; key: string; atUtc: string; event: RecordHistoryEvent }
  | { type: "decision"; key: string; atUtc: string; task: ApprovalTask }
  | { type: "action"; key: string; atUtc: string; action: ResponseAction };

const typeOrder = { record: 0, decision: 1, action: 2 } as const;
// W1-A: by WhatsApp the location is asked and answered before the form goes out. W3: what the person shares while the form is
// open comes after it and before the form that comes back with it (a shared location arrives after its send, never with it).
const recordOrder: Record<RecordHistoryEvent["kind"], number> = { LocationRequested: 0, LocationReceived: 1, LocationSkipped: 1, Sent: 2, ContactReceived: 3, SentAgain: 4, Submitted: 5, Saved: 6 };
const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;

// The key of an event of the response, also for its row in the activity. Two of a kind at the same instant (W3: the location and
// the contact can each bring the form back) keep apart: the second takes its occurrence, so a lone one keeps its key. The event is
// found by reference in the response's history, the same objects the moments pass along.
export function recordEventKey(history: readonly RecordHistoryEvent[], event: RecordHistoryEvent): string {
  const key = "record:" + event.kind + ":" + event.atUtc;
  const occurrence = history.filter(item => item.kind === event.kind && item.atUtc === event.atUtc).indexOf(event);
  return occurrence > 0 ? key + ":" + occurrence : key;
}

export function composeWorkflowHistory(record: ResponseDetail, workflow?: ResponseWorkflow): WorkflowHistoryEntry[] {
  const entries: WorkflowHistoryEntry[] = record.history.map(event => ({
    type: "record", key: recordEventKey(record.history, event), atUtc: event.atUtc, event,
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
