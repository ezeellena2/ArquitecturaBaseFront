// DOC7-A: the periods of a dashboard, one for the whole of it, apart from its contract and its model: the bar that the page
// draws while the dashboard's chunk arrives reads the period of the address without loading them.
export const dashboardPeriods = ["day", "week", "month"] as const;
export type DashboardPeriod = (typeof dashboardPeriods)[number];

/** The period of the address: by day unless it says week or month. */
export function dashboardPeriod(value: string | null): DashboardPeriod {
  return dashboardPeriods.find(period => period === value) ?? "day";
}
