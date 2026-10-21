import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { formId } from "./response";
import type { ApprovalDecisionBody } from "../approvals";
const guid = z.string().uuid();
const author = z.strictObject({ userId: guid, displayName: z.string().nullable() });
const utc = z.iso.datetime();
const state = z.enum(["Open", "Approved", "Rejected"]);
const task = z.strictObject({ id: guid, definitionId: guid, recordId: guid, number: z.string(), formName: z.string(), author, role: z.strictObject({ id: guid, name: z.string() }), requestedAtUtc: utc, revision: z.number().int().positive(), state, canDecide: z.boolean(), cannotDecideReason: z.enum(["OwnResponse", "AlreadyDecided"]).nullable(), decidedAtUtc: utc.nullable(), decidedBy: author.nullable(), reason: z.string().nullable() });
const page = z.strictObject({ items: z.array(task), page: z.number().int().positive(), pageSize: z.number().int().positive(), totalCount: z.number().int().nonnegative(), totalPages: z.number().int().nonnegative(), hasPrevious: z.boolean(), hasNext: z.boolean() });
const count = z.strictObject({ count: z.number().int().nonnegative() });
const decision = z.strictObject({ taskId: guid, recordId: guid, revision: z.number().int().positive(), state: z.enum(["Approved", "Rejected"]), decidedAtUtc: utc, decidedBy: author, reason: z.string().nullable() });
export type ApprovalTask = z.infer<typeof task>;
export type ApprovalPage = z.infer<typeof page>;
export function readApprovalTask(body: unknown) { return read(task, body); }
function read<T>(schema: z.ZodType<T>, body: unknown): T { const parsed = schema.safeParse(body); if (!parsed.success)
    throw new Error("Invalid form approval contract."); return parsed.data; }
export interface ApprovalQuery {
    page: number;
    pageSize: number;
    definitionId?: string;
    onlyMine: boolean;
}
const queryString = (query: object) => new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])).toString();
export const fetchApprovalTasks = async (query: ApprovalQuery, signal?: AbortSignal) => read(page, await api.get<unknown>("/api/forms/approvals?" + queryString(query), { signal, cache: "no-store" }));
export const fetchApprovalCount = async (query: Pick<ApprovalQuery, "definitionId" | "onlyMine"> = { onlyMine: true }, signal?: AbortSignal) => read(count, await api.get<unknown>("/api/forms/approvals/count?" + queryString(query), { signal, cache: "no-store" }));
export const fetchApprovalTask = async (id: string, signal?: AbortSignal) => readApprovalTask(await api.get<unknown>("/api/forms/approvals/" + formId(id), { signal, cache: "no-store" }));
export const decideApprovalTask = async (id: string, body: ApprovalDecisionBody, signal?: AbortSignal) => read(decision, await api.post<unknown>("/api/forms/approvals/" + formId(id) + "/decisions", body, { signal }));
