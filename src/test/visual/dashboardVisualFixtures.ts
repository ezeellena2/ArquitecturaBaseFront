import type { FormDashboard, FormDashboardTotal } from "@/features/business-forms/api/dashboard";
import type { ResponseSheet } from "@/features/business-forms/api/responses";
import { responseFormId, responseSheetFixture } from "../responseFixtures";

// DOC7-A: «Pagos de clientes» in October, as the board draws it: 123 transfers from six banks and wallets, two in dollars, with
// approval. Synthetic double for the scenes («responses-dashboard»): it does not accredit what the server adds up. As the server, it
// compares with the previous range only when the filter has both received dates, and answers the period it is asked.
const id = (n: number) => `0199a0c0-0000-7000-8000-${String(n).padStart(12, "0")}`;
const field = { amount: id(301), currency: id(302), bank: id(303), client: id(304), paidOn: id(305) };
const pesos = id(311), dollars = id(312);
// October by day: the Sundays quiet and a short Saturday; the 31 add up to 123.
const october = [7, 8, 2, 0, 6, 7, 6, 8, 9, 1, 0, 9, 7, 8, 10, 2, 0, 0, 8, 9, 8, 8, 2, 0, 1, 0, 0, 0, 0, 0, 0];
const dollarDays: Record<number, number> = { 8: 400, 19: 800 };

const day = (index: number) => `2026-10-${String(index + 1).padStart(2, "0")}`;
const weekStart = (index: number) => { const date = new Date(Date.UTC(2026, 9, index + 1)); date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); return date.toISOString().slice(0, 10); };
const totals = (peso: number, dollar: number): FormDashboardTotal[] => [
  { fieldId: field.amount, currencyId: pesos, total: peso, overflow: false },
  { fieldId: field.amount, currencyId: dollars, total: dollar, overflow: false },
];

function buckets(period: FormDashboard["period"], shift = 0) {
  const grouped = new Map<string, { count: number; peso: number; dollar: number }>();
  october.forEach((count, index) => {
    const at = Math.max(0, index - shift);
    const start = period === "day" ? day(at) : period === "week" ? weekStart(at) : "2026-10-01";
    const entry = grouped.get(start) ?? { count: 0, peso: 0, dollar: 0 };
    const dollar = dollarDays[index] ?? 0;
    grouped.set(start, { count: entry.count + count, peso: entry.peso + (count - (dollar ? 1 : 0)) * 116900, dollar: entry.dollar + dollar });
  });
  return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([start, entry]) => ({ start, count: entry.count, totals: totals(entry.peso, entry.dollar) }));
}

export function createDashboardVisualFixtures(language: "es" | "en") {
  const en = language === "en";
  const sheet: ResponseSheet = responseSheetFixture();
  sheet.name = en ? "Customer payments" : "Pagos de clientes";
  sheet.hasApproval = true;
  sheet.records.totalCount = 123;
  const question = (fieldId: string, type: ResponseSheet["columns"][number]["type"], label: string) => ({ fieldId, type, label, introducedInVersion: 1, options: [] });
  sheet.columns = [question(field.amount, "decimal", en ? "Amount" : "Monto"), question(field.currency, "choice", en ? "Currency" : "Moneda"),
    question(field.bank, "choice", en ? "Bank or wallet of origin" : "Banco o billetera de origen"), question(field.client, "choice", en ? "Customer" : "Cliente"),
    question(field.paidOn, "date", en ? "Transfer date" : "Fecha de la transferencia")];
  sheet.records.items = [];
  const option = (n: number, label: string, count: number, peso: number, dollar = 0) => ({ id: id(n), label, count, totals: totals(peso, dollar) });
  const dashboard = (period: FormDashboard["period"], compared: boolean): FormDashboard => ({
    definitionId: responseFormId, period, timeZoneId: "America/Argentina/Buenos_Aires", count: 123,
    previous: compared ? { fromUtc: "2026-09-01T03:00:00Z", toUtc: "2026-10-01T03:00:00Z", count: 104 } : null,
    numbers: [
      { fieldId: field.amount, label: en ? "Amount" : "Monto", currencyId: pesos, currencyLabel: en ? "pesos" : "pesos", count: 121, total: 14381300, average: 118853.72,
        minimum: 8500, maximum: 620000, previousTotal: compared ? 11885000 : null, previousAverage: compared ? 115388.35 : null, overflow: false },
      { fieldId: field.amount, label: en ? "Amount" : "Monto", currencyId: dollars, currencyLabel: en ? "dollars" : "dólares", count: 2, total: 1200, average: 600,
        minimum: 400, maximum: 800, previousTotal: compared ? 0 : null, previousAverage: null, overflow: false },
    ],
    series: { buckets: buckets(period), truncated: false },
    dateSeries: [{ fieldId: field.paidOn, label: en ? "Transfer date" : "Fecha de la transferencia", buckets: buckets(period, 1), truncated: false }],
    distributions: [
      { fieldId: field.currency, label: en ? "Currency" : "Moneda", type: "choice", catalog: null,
        options: [option(321, "Pesos", 121, 14381300), option(322, en ? "Dollars" : "Dólares", 2, 0, 1200)], others: null },
      { fieldId: field.bank, label: en ? "Bank or wallet of origin" : "Banco o billetera de origen", type: "choice", catalog: { id: id(330), name: en ? "Banks and wallets" : "Bancos y billeteras" },
        options: [option(331, "Banco Galicia", 38, 4400000, 1200), option(332, "Banco Santander", 27, 3150000), option(333, "Banco Nación", 21, 2480000),
          option(334, "Mercado Pago", 17, 1990000), option(335, "Brubank", 11, 1290000), option(336, "Banco Macro", 9, 1071300)], others: null },
      { fieldId: field.client, label: en ? "Customer" : "Cliente", type: "choice", catalog: { id: id(340), name: en ? "Customers" : "Clientes" },
        options: [option(341, en ? "La Esquina supermarket" : "Supermercado La Esquina", 22, 2570000), option(342, "Hotel Plaza", 18, 2104000),
          option(343, en ? "Polo Sur ice-cream shop" : "Heladería Polo Sur", 15, 1753000), option(344, en ? "Central pharmacy" : "Farmacia Central", 14, 1636000),
          option(345, en ? "La Posta restaurant" : "Restaurante La Posta", 12, 1402000)],
        others: { count: 42, optionCount: 7, totals: totals(4916300, 1200) } },
    ],
    actors: { options: [{ id: id(351), label: "Juan Gómez", count: 64 }, { id: id(352), label: "Marta Ruiz", count: 35 }, { id: id(353), label: "Pablo Sosa", count: 24 }], others: null },
    states: [{ state: "Approved", count: 101 }, { state: "PendingApproval", count: 14 }, { state: "Rejected", count: 8 }],
  });
  return async (request: Request): Promise<Response | undefined> => {
    const path = new URL(request.url).pathname;
    if (!path.startsWith(`/api/forms/definitions/${responseFormId}/`) || request.method !== "POST") return undefined;
    if (path.endsWith("/records/search")) return Response.json(sheet);
    if (!path.endsWith("/dashboard/search")) return undefined;
    const body = await request.json() as { filter: { receivedFromUtc?: string; receivedToUtc?: string }; period: FormDashboard["period"] };
    return Response.json(dashboard(body.period, !!body.filter.receivedFromUtc && !!body.filter.receivedToUtc));
  };
}
