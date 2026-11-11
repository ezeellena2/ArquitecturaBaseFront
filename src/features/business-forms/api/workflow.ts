import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { formId } from "./response";
import { actionStates, recipientStates } from "../workflow";
import { ruleActionKinds, ruleEvents } from "../rules";
const guid = z.string().uuid();
const utc = z.iso.datetime();
const author = z.strictObject({ userId: guid, displayName: z.string().nullable() });
// A text of an issuer by language («Factura C», the (i) of «¿La emito?», an amount's label).
const localized = z.record(z.string().refine(key => key === "es" || key === "en"), z.string());
// Voiding a response with an issuance runs its reversal as one more action, with the event «Voided» (NC1-A).
const actionEvents = [...ruleEvents, "Voided"] as const;
const recipient = z.strictObject({ user: author, channelId: z.string().min(1).nullable(), state: z.enum(recipientStates), reasonCode: z.string().nullable(), reason: z.string().nullable(), canReview: z.boolean(), canRetry: z.boolean(), deliveredAtUtc: utc.nullable(), readAtUtc: utc.nullable(), review: z.strictObject({ wasSent: z.boolean(), reviewedAtUtc: utc, reviewedBy: author }).nullable() });
const workflow = z.strictObject({
  recordId: guid, recordState: z.enum(["Received", "PendingApproval", "Approved", "Rejected", "Voided"]), ruleRevision: z.number().int().positive().nullable(),
  task: z.strictObject({ id: guid, roleId: guid, roleName: z.string().nullable(), requestedAtUtc: utc, decidedAtUtc: utc.nullable(), decidedBy: author.nullable(), reason: z.string().nullable(), revision: z.number().int().positive(), state: z.enum(["Open", "Approved", "Rejected", "Closed"]) }).nullable(),
  actions: z.array(z.strictObject({ id: guid, ruleId: guid, kind: z.enum(ruleActionKinds), event: z.enum(actionEvents), order: z.number().int().nonnegative(), revision: z.number().int().nonnegative(), state: z.enum(actionStates), reasonCode: z.string().nullable(), reason: z.string().nullable(), canConsult: z.boolean(), canRetry: z.boolean(), canReview: z.boolean().optional(), recipients: z.array(recipient), createdAtUtc: utc, updatedAtUtc: utc, completedAtUtc: utc.nullable(),
    // «En cola»: an issuance waiting for its issuer, which did not answer, says when it tries again and how many times it tried.
    nextAttemptAtUtc: utc.optional(), attempts: z.number().int().positive().optional() })),
  documents: z.array(z.strictObject({ id: guid, runId: guid, culture: z.enum(["es", "en"]), name: z.string(), size: z.number().int().positive(), createdAtUtc: utc })),
  // EM2-A: an issuance from a channel waiting for whoever loaded it to confirm, with its summary; only for that person.
  confirmation: z.strictObject({
    runId: guid, document: localized.nullable(), receiver: z.string().nullable(), total: z.string().nullable(),
    info: localized.optional(), date: z.string().optional(), amounts: z.array(z.strictObject({ label: localized, value: z.string() })).optional(),
  }).optional(),
});
export type ResponseWorkflow = z.infer<typeof workflow>;
export type ResponseRecipient = z.infer<typeof recipient>;
export type ResponseAction = ResponseWorkflow["actions"][number];
export type ResponseIssueConfirmation = NonNullable<ResponseWorkflow["confirmation"]>;
export function readResponseWorkflow(body: unknown, recordId: string): ResponseWorkflow {
  const result = workflow.safeParse(body);
  if (!result.success || result.data.recordId !== recordId) throw new Error("Invalid response workflow contract.");
  return result.data;
}
const path = (id: string) => "/api/forms/records/" + formId(id);
export const fetchResponseWorkflow = async (recordId: string, signal?: AbortSignal) => readResponseWorkflow(await api.get<unknown>(path(recordId) + "/workflow", { signal, cache: "no-store" }), recordId);
export const continueResponseAction = async (recordId: string, runId: string, action: "consult" | "retry", signal?: AbortSignal) => readResponseWorkflow(await api.post<unknown>(path(recordId) + "/actions/" + formId(runId) + "/" + action, undefined, { signal }), recordId);

// An issuance in review is decided without a person (NC1-A): `wasSent` says whether it goes on.
export const reviewResponseAction = async (recordId: string, runId: string, body: { recipientUserId?: string; expectedRevision: number; wasSent: boolean }, signal?: AbortSignal) => readResponseWorkflow(await api.post<unknown>(path(recordId) + "/actions/" + formId(runId) + "/review", body, { signal }), recordId);
export const retryResponseRecipient = async (recordId: string, runId: string, recipientUserId: string, body: { expectedRevision: number }, signal?: AbortSignal) => readResponseWorkflow(await api.post<unknown>(path(recordId) + "/actions/" + formId(runId) + "/recipients/" + formId(recipientUserId) + "/retry", body, { signal }), recordId);
// «¿La emito?» from the detail (EM2-A): whoever loaded it issues, or voids it without issuing; 202 with the flow.
export const confirmResponseIssue = async (recordId: string, runId: string, issue: boolean, signal?: AbortSignal) => readResponseWorkflow(await api.post<unknown>(path(recordId) + "/actions/" + formId(runId) + "/confirmation", { issue }, { signal }), recordId);
