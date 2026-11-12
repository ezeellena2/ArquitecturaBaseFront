import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { dashboardPeriods, type DashboardPeriod } from "../dashboardPeriod";
import type { ResponseQuery } from "../responses";

// DOC7-A: the dashboard of a form, calculated by the server with the sheet's filter, its grammar and its restriction to one's own
// responses. One period for the whole dashboard; the buckets of the received dates are local days of `timeZoneId`, the zone of the
// profile of whoever reads, the same the sheet's filter is built in.

const guid = z.string().uuid();
const count = z.number().int().nonnegative();
// Amounts are JSON numbers, as the backend's contract: a value beyond ~15 significant digits loses its trailing digits in the
// browser (a double), and the dashboard shows what arrived. A total that does not fit at all comes as null with `overflow`.
const amount = z.number().finite();
// The total of a number of the dashboard by its question and its currency; null only when it does not fit, and then marked.
const total = z.strictObject({ fieldId: guid, currencyId: guid.nullable(), total: amount.nullable(), overflow: z.boolean() })
  .refine(item => (item.total === null) === item.overflow);
const bucket = z.strictObject({ start: z.iso.date(), count, totals: z.array(total) });
const buckets = z.array(bucket).refine(items => items.every((item, index) => index === 0 || items[index - 1]!.start < item.start));
// A number question outside a block, or one currency of it: without answers the total is zero and the rest null; what does not
// fit is null with its mark.
const number = z.strictObject({
  fieldId: guid, label: z.string(), currencyId: guid.nullable(), currencyLabel: z.string().nullable(), count,
  total: amount.nullable(), average: amount.nullable(), minimum: amount.nullable(), maximum: amount.nullable(),
  previousTotal: amount.nullable(), previousAverage: amount.nullable(), overflow: z.boolean(),
}).refine(item => item.total !== null || item.overflow);
const option = z.strictObject({ id: z.string().min(1), label: z.string(), count, totals: z.array(total) });
const distribution = z.strictObject({
  fieldId: guid, label: z.string(), type: z.enum(["choice", "multiChoice", "boolean"]),
  catalog: z.strictObject({ id: guid, name: z.string() }).nullable(),
  options: z.array(option),
  others: z.strictObject({ count, optionCount: count, totals: z.array(total) }).nullable(),
}).refine(item => new Set(item.options.map(choice => choice.id)).size === item.options.length
  && (item.type !== "boolean" || item.options.every(choice => choice.id === "true" || choice.id === "false")));
const schema = z.strictObject({
  definitionId: guid,
  period: z.enum(dashboardPeriods),
  timeZoneId: z.string().min(1),
  count,
  previous: z.strictObject({ fromUtc: z.iso.datetime(), toUtc: z.iso.datetime(), count }).nullable(),
  numbers: z.array(number),
  series: z.strictObject({ buckets, truncated: z.boolean() }),
  dateSeries: z.array(z.strictObject({ fieldId: guid, label: z.string(), buckets, truncated: z.boolean() })),
  distributions: z.array(distribution),
  actors: z.strictObject({
    options: z.array(z.strictObject({ id: z.string().min(1), label: z.string(), count })),
    others: z.strictObject({ count, peopleCount: count }).nullable(),
  }),
  states: z.array(z.strictObject({ state: z.enum(["Received", "PendingApproval", "Approved", "Rejected", "Voided"]), count })),
}).superRefine((dashboard, context) => {
  // Every total belongs to a number of the dashboard, and each number (with its currency) is there once.
  const numberKey = (item: { fieldId: string; currencyId: string | null }) => item.fieldId + ":" + (item.currencyId ?? "");
  const numbers = new Set(dashboard.numbers.map(numberKey));
  const totals = [...dashboard.series.buckets, ...dashboard.dateSeries.flatMap(series => series.buckets),
    ...dashboard.distributions.flatMap(item => [...item.options, ...item.others ? [item.others] : []])].flatMap(item => item.totals);
  const unique = (values: readonly string[]) => new Set(values).size === values.length;
  if (numbers.size !== dashboard.numbers.length || !totals.every(item => numbers.has(numberKey(item)))
    || !unique(dashboard.distributions.map(item => item.fieldId)) || !unique(dashboard.dateSeries.map(item => item.fieldId))
    || !unique(dashboard.actors.options.map(item => item.id)) || !unique(dashboard.states.map(item => item.state)))
    context.addIssue({ code: "custom", message: "The dashboard does not hold together." });
});

export type FormDashboard = z.infer<typeof schema>;
export type FormDashboardNumber = FormDashboard["numbers"][number];
export type FormDashboardBucket = FormDashboard["series"]["buckets"][number];
export type FormDashboardTotal = FormDashboardBucket["totals"][number];
export type FormDashboardDistribution = FormDashboard["distributions"][number];
export type FormDashboardState = FormDashboard["states"][number]["state"];

/** Reads a dashboard of this form and this period; what does not hold, it rejects without keeping what came. */
export function readFormDashboard(body: unknown, formId: string, period: DashboardPeriod): FormDashboard {
  const parsed = schema.safeParse(body);
  if (!parsed.success || parsed.data.definitionId.toLowerCase() !== formId.toLowerCase() || parsed.data.period !== period)
    throw new Error("Invalid form dashboard contract.");
  return parsed.data;
}

/** The dashboard of a form with the sheet's search body as its filter and one period; a private read, never cached. */
export async function fetchFormDashboard(formId: string, filter: ResponseQuery, period: DashboardPeriod, signal: AbortSignal): Promise<FormDashboard> {
  if (!guid.safeParse(formId).success) throw new Error("Invalid form dashboard identity.");
  return readFormDashboard(await api.post<unknown>(`/api/forms/definitions/${formId}/dashboard/search`, { filter, period }, { signal, cache: "no-store" }), formId, period);
}
