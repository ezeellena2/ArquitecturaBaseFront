import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { formId } from "./response";
import { actionStates } from "../workflow";
import { ruleActionKinds, ruleEvents } from "../rules";
const guid = z.string().uuid();
const utc = z.iso.datetime();
const workflow = z.strictObject({
  recordId: guid, recordState: z.enum(["Received", "PendingApproval", "Approved", "Rejected"]), ruleRevision: z.number().int().positive().nullable(),
  task: z.strictObject({ id: guid, roleId: guid, roleName: z.string().nullable(), decidedAtUtc: utc.nullable(), decidedBy: z.strictObject({ userId: guid, displayName: z.string().nullable() }).nullable(), reason: z.string().nullable(), revision: z.number().int().positive(), state: z.enum(["Open", "Approved", "Rejected"]) }).nullable(),
  actions: z.array(z.strictObject({ id: guid, ruleId: guid, kind: z.enum(ruleActionKinds), event: z.enum(ruleEvents), order: z.number().int().nonnegative(), state: z.enum(actionStates), reasonCode: z.string().nullable(), reason: z.string().nullable(), canConsult: z.boolean(), canRetry: z.boolean(), createdAtUtc: utc, updatedAtUtc: utc, completedAtUtc: utc.nullable() })),
  documents: z.array(z.strictObject({ id: guid, culture: z.enum(["es", "en"]), name: z.string(), size: z.number().int().positive(), createdAtUtc: utc })),
});
export type ResponseWorkflow = z.infer<typeof workflow>;
export type ResponseAction = ResponseWorkflow["actions"][number];
export function readResponseWorkflow(body: unknown, recordId: string): ResponseWorkflow {
  const result = workflow.safeParse(body);
  if (!result.success || result.data.recordId !== recordId) throw new Error("Invalid response workflow contract.");
  return result.data;
}
const path = (id: string) => "/api/forms/records/" + formId(id);
export const fetchResponseWorkflow = async (recordId: string, signal?: AbortSignal) => readResponseWorkflow(await api.get<unknown>(path(recordId) + "/workflow", { signal, cache: "no-store" }), recordId);
export const continueResponseAction = async (recordId: string, runId: string, action: "consult" | "retry", signal?: AbortSignal) => readResponseWorkflow(await api.post<unknown>(path(recordId) + "/actions/" + formId(runId) + "/" + action, undefined, { signal }), recordId);
