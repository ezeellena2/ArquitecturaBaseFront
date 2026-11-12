import type { FormDashboard, FormDashboardTotal } from "@/features/business-forms/api/dashboard";

// DOC7-A: a synthetic dashboard with the shape of the backend's DTO (FormDashboardResponse), for behavior tests and the visual
// scenes. The HTTP captures of the forms-dashboard-http cohort are not exported yet: when they are, the contract is qualified with
// them in a *HttpContract test, never with this one.
export const dashboardFormId = "0199a0c0-0000-7000-8000-000000000010";
export const dashboardIds = {
  amount: "0199a0c0-0000-7000-8000-000000000030",
  currency: "0199a0c0-0000-7000-8000-000000000031",
  pesos: "0199a0c0-0000-7000-8000-000000000040",
  dollars: "0199a0c0-0000-7000-8000-000000000041",
  bank: "0199a0c0-0000-7000-8000-000000000050",
  paid: "0199a0c0-0000-7000-8000-000000000051",
  paidOn: "0199a0c0-0000-7000-8000-000000000060",
  catalog: "0199a0c0-0000-7000-8000-000000000070",
  galicia: "0199a0c0-0000-7000-8000-000000000080",
  nacion: "0199a0c0-0000-7000-8000-000000000081",
  ana: "0199a0c0-0000-7000-8000-000000000090",
  bruno: "0199a0c0-0000-7000-8000-000000000091",
} as const;

const totals = (pesos: number | null, dollars: number, overflow = false): FormDashboardTotal[] => [
  { fieldId: dashboardIds.amount, currencyId: dashboardIds.pesos, total: pesos, overflow },
  { fieldId: dashboardIds.amount, currencyId: dashboardIds.dollars, total: dollars, overflow: false },
];

/** October by day: six responses, two in September; «Monto» by currency, a catalog «Banco», a yes or no «Pagado» and a date. */
export function dashboardFixture(): FormDashboard {
  return {
    definitionId: dashboardFormId, period: "day", timeZoneId: "America/Argentina/Buenos_Aires", count: 6,
    previous: { fromUtc: "2026-09-01T03:00:00Z", toUtc: "2026-10-01T03:00:00Z", count: 2 },
    numbers: [
      { fieldId: dashboardIds.amount, label: "Monto", currencyId: dashboardIds.pesos, currencyLabel: "Pesos", count: 4, total: 2050, average: 512.5,
        minimum: 50, maximum: 1000, previousTotal: 400, previousAverage: 200, overflow: false },
      { fieldId: dashboardIds.amount, label: "Monto", currencyId: dashboardIds.dollars, currencyLabel: "Dólares", count: 1, total: 500, average: 500,
        minimum: 500, maximum: 500, previousTotal: 0, previousAverage: null, overflow: false },
    ],
    series: { truncated: false, buckets: [
      { start: "2026-10-01", count: 2, totals: totals(1500, 0) },
      { start: "2026-10-02", count: 0, totals: totals(0, 0) },
      { start: "2026-10-03", count: 3, totals: totals(500, 500) },
      { start: "2026-10-04", count: 1, totals: totals(50, 0) },
    ] },
    dateSeries: [{ fieldId: dashboardIds.paidOn, label: "Fecha de pago", truncated: false, buckets: [
      { start: "2026-09-28", count: 1, totals: totals(1000, 0) },
      { start: "2026-09-29", count: 0, totals: totals(0, 0) },
      { start: "2026-09-30", count: 2, totals: totals(1050, 500) },
    ] }],
    distributions: [
      { fieldId: dashboardIds.bank, label: "Banco", type: "choice", catalog: { id: dashboardIds.catalog, name: "Bancos y billeteras" },
        options: [
          { id: dashboardIds.galicia, label: "Banco Galicia", count: 3, totals: totals(1500, 500) },
          { id: dashboardIds.nacion, label: "Banco Nación", count: 2, totals: totals(300, 0) },
        ],
        others: { count: 1, optionCount: 3, totals: totals(250, 0) } },
      { fieldId: dashboardIds.paid, label: "Pagado", type: "boolean", catalog: null,
        options: [{ id: "true", label: "true", count: 4, totals: totals(1750, 500) }, { id: "false", label: "false", count: 2, totals: totals(300, 0) }],
        others: null },
    ],
    actors: { options: [{ id: dashboardIds.ana, label: "Ana Tablero", count: 4 }, { id: dashboardIds.bruno, label: "", count: 1 }], others: { count: 1, peopleCount: 1 } },
    states: [{ state: "Received", count: 3 }, { state: "PendingApproval", count: 2 }, { state: "Approved", count: 1 }],
  };
}
