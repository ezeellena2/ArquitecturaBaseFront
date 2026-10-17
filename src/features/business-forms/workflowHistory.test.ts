import { expect, it } from "vitest";
import type { ResponseDetail } from "./api/responses";
import type { ResponseAction, ResponseWorkflow } from "./api/workflow";
import { responseDetailFixture, responseWorkflowFixture } from "@/test/responseFixtures";
import { composeWorkflowHistory } from "./workflowHistory";

const time = (seconds: string) => "2026-10-17T12:00:" + seconds + "Z";
function action(id: string, overrides: Partial<ResponseAction> = {}): ResponseAction {
  return { id, ruleId: "rule-a", kind: "NotifyAuthor", event: "Received", order: 0, revision: 1, state: "Completed", reasonCode: null, reason: null, canConsult: false, canRetry: false, recipients: [], createdAtUtc: time("00"), updatedAtUtc: time("08"), completedAtUtc: time("03"), ...overrides };
}
function decision(overrides: Partial<NonNullable<ResponseWorkflow["task"]>> = {}): NonNullable<ResponseWorkflow["task"]> {
  return { id: "task", roleId: "supervision", roleName: "Supervision", requestedAtUtc: time("00"), revision: 2, state: "Approved", decidedAtUtc: time("02.500"), decidedBy: { userId: "approver", displayName: "Luz" }, reason: null, ...overrides };
}
function record(history: ResponseDetail["history"]): ResponseDetail {
  return { ...responseDetailFixture(), history };
}

it("composes record events, a decision and action results once in UTC order", () => {
  const response = record([
    { kind: "Saved", atUtc: time("04"), actor: null },
    { kind: "Sent", atUtc: time("00"), actor: null },
    { kind: "Submitted", atUtc: time("02"), actor: null },
  ]);
  const completed = action("completed");
  const uncertain = action("uncertain", { state: "Uncertain", updatedAtUtc: time("01"), completedAtUtc: null });
  const task = decision();
  const workflow = { ...responseWorkflowFixture(response.id), task, actions: [completed, uncertain] };
  const entries = composeWorkflowHistory(response, workflow);
  expect(entries.map(entry => entry.key)).toEqual([
    "record:Sent:" + time("00"), "action:uncertain", "record:Submitted:" + time("02"), "decision:task", "action:completed", "record:Saved:" + time("04"),
  ]);
  expect(entries.map(entry => entry.atUtc)).toEqual([time("00"), time("01"), time("02"), time("02.500"), time("03"), time("04")]);
  expect(new Set(entries.map(entry => entry.key)).size).toBe(entries.length);
  expect(entries[1]).toEqual({ type: "action", key: "action:uncertain", atUtc: time("01"), action: uncertain });
  expect(entries[3]).toEqual({ type: "decision", key: "decision:task", atUtc: time("02.500"), task });
  expect(entries[4]).toEqual({ type: "action", key: "action:completed", atUtc: time("03"), action: completed });
});

it("breaks equal instants by record kind, decision and deterministic rule order and action id", () => {
  const atUtc = time("00");
  const response = record([
    { kind: "Saved", atUtc, actor: null },
    { kind: "Submitted", atUtc, actor: null },
    { kind: "Sent", atUtc, actor: null },
  ]);
  const actions = [
    action("z", { ruleId: "rule-b", completedAtUtc: atUtc }),
    action("c", { order: 1, completedAtUtc: atUtc }),
    action("b", { completedAtUtc: atUtc }),
    action("a", { completedAtUtc: atUtc }),
  ];
  const workflow = { ...responseWorkflowFixture(response.id), task: decision({ decidedAtUtc: atUtc }), actions };
  const expected = ["record:Sent:" + atUtc, "record:Submitted:" + atUtc, "record:Saved:" + atUtc, "decision:task", "action:a", "action:b", "action:c", "action:z"];
  expect(composeWorkflowHistory(response, workflow).map(entry => entry.key)).toEqual(expected);
  expect(composeWorkflowHistory({ ...response, history: [...response.history].reverse() }, { ...workflow, actions: [...actions].reverse() }).map(entry => entry.key)).toEqual(expected);
});

it("compares UTC instants numerically when fractional precision differs", () => {
  const response = record([{ kind: "Saved", atUtc: time("00"), actor: null }]);
  const workflow = { ...responseWorkflowFixture(response.id), actions: [action("later", { completedAtUtc: time("00.500") })] };
  expect(composeWorkflowHistory(response, workflow).map(entry => entry.type)).toEqual(["record", "action"]);
});

it("does not mutate the source history, decision or actions", () => {
  const response = responseDetailFixture();
  const workflow = { ...responseWorkflowFixture(response.id), task: decision(), actions: [action("later"), action("earlier", { completedAtUtc: time("01") })] };
  const snapshot = structuredClone({ response, workflow });
  Object.freeze(response.history);
  Object.freeze(workflow.actions);
  Object.freeze(workflow.task);
  expect(() => composeWorkflowHistory(response, workflow)).not.toThrow();
  expect({ response, workflow }).toEqual(snapshot);
});

it("keeps only record history when the workflow is absent or belongs to another record", () => {
  const response = responseDetailFixture();
  const workflow = { ...responseWorkflowFixture("another-record"), task: decision(), actions: [action("private-action")] };
  const expected = composeWorkflowHistory(response);
  expect(expected).toHaveLength(response.history.length);
  expect(expected.every(entry => entry.type === "record")).toBe(true);
  expect(composeWorkflowHistory(response, workflow)).toEqual(expected);
});

it("does not invent a decision for an open task or a task without a decision instant", () => {
  const response = record([]);
  const workflow = responseWorkflowFixture(response.id);
  expect(composeWorkflowHistory(response, workflow)).toEqual([]);
  expect(composeWorkflowHistory(response, { ...workflow, task: decision({ state: "Open", decidedAtUtc: null, decidedBy: null }) })).toEqual([]);
  expect(composeWorkflowHistory(response, { ...workflow, task: decision({ decidedAtUtc: null }) })).toEqual([]);
});
