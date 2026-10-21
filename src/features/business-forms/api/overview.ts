import { z } from "zod";
import { api } from "@/shared/api/httpClient";

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const row = z.strictObject({
  id: z.string().uuid(),
  name: z.string().min(1),
  prefix: z.string().min(1),
  deactivatedAtUtc: z.iso.datetime().nullable(),
  pendingApprovalCount: count.nullable(),
  responseCount: count.nullable(),
  lastResponse: z.strictObject({
    id: z.string().uuid(), number: z.string().min(1), submittedAtUtc: z.iso.datetime(),
    state: z.enum(["Received", "PendingApproval", "Approved", "Rejected"]),
  }).nullable(),
});
export const formOverviewSchema = z.strictObject({
  forms: z.strictObject({
    items: z.array(row), page: z.number().int().positive(), pageSize: z.number().int().positive(),
    totalCount: count, totalPages: count, hasPrevious: z.boolean(), hasNext: z.boolean(),
  }),
  filterCounts: z.strictObject({ active: count, deactivated: count, deactivatedPending: count.nullable() }),
});
export type FormOverview = z.infer<typeof formOverviewSchema>;
export type FormOverviewRow = FormOverview["forms"]["items"][number];
export interface FormOverviewQuery {
  page: number;
  pageSize: number;
  search?: string;
  state: "Active" | "Deactivated";
  pendingOnly?: boolean;
}
export function readFormOverview(body: unknown): FormOverview {
  const result = formOverviewSchema.safeParse(body);
  if (!result.success) throw new Error("Invalid form overview contract.");
  return result.data;
}
export async function fetchFormOverview(query: FormOverviewQuery, signal: AbortSignal): Promise<FormOverview> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize), state: query.state });
  if (query.search) params.set("search", query.search);
  if (query.pendingOnly) params.set("pendingOnly", "true");
  return readFormOverview(await api.get<unknown>("/api/forms/overview?" + params, { signal, cache: "no-store" }));
}
