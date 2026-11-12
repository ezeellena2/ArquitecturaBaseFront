import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { dashboardFixture as dashboard, dashboardFormId as formId, dashboardIds as ids } from "@/test/dashboardFixtures";
import { fetchFormDashboard, readFormDashboard, type FormDashboard } from "./dashboard";

// DOC7-A: the dashboard of a form, as `POST api/forms/definitions/{id}/dashboard/search` answers it. Synthetic bodies with the
// shape of the backend's DTO (FormDashboardResponse): the captures of the forms-dashboard-http cohort are not exported yet.
const total = (currencyId: string | null, value: number | null, overflow = false) => ({ fieldId: ids.amount, currencyId, total: value, overflow });
const zero = [total(ids.pesos, 0), total(ids.dollars, 0)];

it("reads the dashboard with its numbers by currency, its series, its distributions, who loaded and the states", () => {
  expect(readFormDashboard(dashboard(), formId, "day")).toEqual(dashboard());
});

it("reads a dashboard without a range to compare, without numbers and in zero", () => {
  const empty = { ...dashboard(), count: 0, previous: null, numbers: [], series: { buckets: [], truncated: false },
    dateSeries: [{ fieldId: ids.paidOn, label: "Fecha de pago", buckets: [], truncated: false }],
    distributions: [{ fieldId: ids.bank, label: "Banco", type: "multiChoice", catalog: null, options: [], others: null }],
    actors: { options: [], others: null }, states: [] };
  expect(readFormDashboard(empty, formId, "day")).toEqual(empty);
});

it("keeps what does not fit as null with its mark, never as a number", () => {
  const body = dashboard();
  body.numbers[0] = { ...body.numbers[0]!, total: null, average: null, overflow: true };
  body.series.buckets[0] = { ...body.series.buckets[0]!, totals: [total(ids.pesos, null, true), total(ids.dollars, 0)] };
  const read = readFormDashboard(body, formId, "day");
  expect(read.numbers[0]).toMatchObject({ total: null, overflow: true });
  expect(read.series.buckets[0]?.totals[0]).toEqual({ fieldId: ids.amount, currencyId: ids.pesos, total: null, overflow: true });
});

it.each([
  ["an unknown member", (body: FormDashboard) => ({ ...body, currency: "ARS" })],
  ["another form", (body: FormDashboard) => ({ ...body, definitionId: "0199a0c0-0000-7000-8000-000000000011" })],
  ["another period", (body: FormDashboard) => ({ ...body, period: "week" })],
  ["a period that is not a day, a week or a month", (body: FormDashboard) => ({ ...body, period: "year" })],
  ["a negative count", (body: FormDashboard) => ({ ...body, count: -1 })],
  ["a bucket that is not a date", (body: FormDashboard) => ({ ...body, series: { truncated: false, buckets: [{ start: "01/10/2026", count: 1, totals: zero }] } })],
  ["buckets out of order", (body: FormDashboard) => ({ ...body, series: { truncated: false,
    buckets: [{ start: "2026-10-02", count: 0, totals: zero }, { start: "2026-10-01", count: 2, totals: zero }] } })],
  ["a total of a number the dashboard does not have", (body: FormDashboard) => ({ ...body, series: { truncated: false,
    buckets: [{ start: "2026-10-01", count: 2, totals: [total(null, 1500), total(ids.dollars, 0)] }] } })],
  ["a total marked as too big that came", (body: FormDashboard) => ({ ...body, series: { truncated: false,
    buckets: [{ start: "2026-10-01", count: 2, totals: [total(ids.pesos, 1500, true), total(ids.dollars, 0)] }] } })],
  ["a total missing without its mark", (body: FormDashboard) => ({ ...body, series: { truncated: false,
    buckets: [{ start: "2026-10-01", count: 2, totals: [total(ids.pesos, null), total(ids.dollars, 0)] }] } })],
  ["a number repeated with the same currency", (body: FormDashboard) => ({ ...body, numbers: [body.numbers[0], body.numbers[0]] })],
  ["the total of a number missing without its mark", (body: FormDashboard) => ({ ...body, numbers: [{ ...body.numbers[0]!, total: null }, body.numbers[1]] })],
  ["a question distributed twice", (body: FormDashboard) => ({ ...body, distributions: [body.distributions[0], body.distributions[0]] })],
  ["a yes or no with another option", (body: FormDashboard) => ({ ...body, distributions: [body.distributions[0],
    { ...body.distributions[1]!, options: [{ id: "maybe", label: "maybe", count: 1, totals: zero }] }] })],
  ["an option repeated in a distribution", (body: FormDashboard) => ({ ...body, distributions: [{ ...body.distributions[0]!,
    options: [body.distributions[0]!.options[0], body.distributions[0]!.options[0]] }, body.distributions[1]] })],
  ["an unknown state", (body: FormDashboard) => ({ ...body, states: [{ state: "Archived", count: 1 }] })],
  ["a previous range without its count", (body: FormDashboard) => ({ ...body, previous: { fromUtc: "2026-09-01T03:00:00Z", toUtc: "2026-10-01T03:00:00Z" } })],
])("rejects a dashboard with %s rather than showing it", (_case, change) => {
  expect(() => readFormDashboard(change(dashboard()), formId, "day")).toThrow("Invalid form dashboard contract.");
});

it("asks with the sheet's search body as the filter and the period, without caching", async () => {
  let sent: unknown; let cache: RequestCache | undefined; let path = "";
  server.use(http.post("/api/forms/definitions/:id/dashboard/search", async ({ request, params }) => {
    sent = await request.json(); cache = request.cache; path = String(params.id);
    return HttpResponse.json({ ...dashboard(), period: "week" });
  }));
  const filter = { page: 1, pageSize: 20, sort: "-number", versionIds: [], state: "Approved" as const, receivedFromUtc: "2026-10-01T03:00:00.000Z" };

  const read = await fetchFormDashboard(formId, filter, "week", new AbortController().signal);

  expect(read.period).toBe("week");
  expect(path).toBe(formId);
  expect(sent).toEqual({ filter, period: "week" });
  expect(cache).toBe("no-store");
});

it("does not compose the route of a form id that is not one", async () => {
  await expect(fetchFormDashboard("../records", { page: 1, pageSize: 20 }, "day", new AbortController().signal)).rejects.toThrow("Invalid form dashboard identity.");
});
