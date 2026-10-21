import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { formId } from "./response";
import { actionStates, recipientStates } from "../workflow";
import { ruleActionKinds, ruleEvents } from "../rules";
const guid = z.string().uuid();
const utc = z.iso.datetime();
const author = z.strictObject({ userId: guid, displayName: z.string().nullable() });
const recipient = z.strictObject({ user: author, channelId: z.string().min(1).nullable(), state: z.enum(recipientStates), reasonCode: z.string().nullable(), reason: z.string().nullable(), canReview: z.boolean(), deliveredAtUtc: utc.nullable(), readAtUtc: utc.nullable(), review: z.strictObject({ wasSent: z.boolean(), reviewedAtUtc: utc, reviewedBy: author }).nullable() });
const workflow = z.strictObject({
  recordId: guid, recordState: z.enum(["Received", "PendingApproval", "Approved", "Rejected"]), ruleRevision: z.number().int().positive().nullable(),
  task: z.strictObject({ id: guid, roleId: guid, roleName: z.string().nullable(), requestedAtUtc: utc, decidedAtUtc: utc.nullable(), decidedBy: author.nullable(), reason: z.string().nullable(), revision: z.number().int().positive(), state: z.enum(["Open", "Approved", "Rejected"]) }).nullable(),
  actions: z.array(z.strictObject({ id: guid, ruleId: guid, kind: z.enum(ruleActionKinds), event: z.enum(ruleEvents), order: z.number().int().nonnegative(), revision: z.number().int().nonnegative(), state: z.enum(actionStates), reasonCode: z.string().nullable(), reason: z.string().nullable(), canConsult: z.boolean(), canRetry: z.boolean(), recipients: z.array(recipient), createdAtUtc: utc, updatedAtUtc: utc, completedAtUtc: utc.nullable() })),
  documents: z.array(z.strictObject({ id: guid, runId: guid, culture: z.enum(["es", "en"]), name: z.string(), size: z.number().int().positive(), createdAtUtc: utc })),
});
export type ResponseWorkflow = z.infer<typeof workflow>;
export type ResponseRecipient = z.infer<typeof recipient>;
export type ResponseAction = ResponseWorkflow["actions"][number];
export function readResponseWorkflow(body: unknown, recordId: string): ResponseWorkflow {
  const result = workflow.safeParse(body);
  if (!result.success || result.data.recordId !== recordId) throw new Error("Invalid response workflow contract.");
  return result.data;
}
const path = (id: string) => "/api/forms/records/" + formId(id);
export const fetchResponseWorkflow = async (recordId: string, signal?: AbortSignal) => readResponseWorkflow(await api.get<unknown>(path(recordId) + "/workflow", { signal, cache: "no-store" }), recordId);
export const continueResponseAction = async (recordId: string, runId: string, action: "consult" | "retry", signal?: AbortSignal) => readResponseWorkflow(await api.post<unknown>(path(recordId) + "/actions/" + formId(runId) + "/" + action, undefined, { signal }), recordId);

export const reviewResponseAction = async (recordId: string, runId: string, body: { recipientUserId: string; expectedRevision: number; wasSent: boolean }, signal?: AbortSignal) => readResponseWorkflow(await api.post<unknown>(path(recordId) + "/actions/" + formId(runId) + "/review", body, { signal }), recordId);
