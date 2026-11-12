import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { DataTable } from "../DataTable";

export interface BarChartBucket {
  key: string;
  /**
   * How tall its bar is. Zero is a quiet bucket, a short bar in the soft tone; a negative value has no bar, only its cap at the
   * baseline; null is a value that could not be calculated, without a bar and with «—».
   */
  value: number | null;
  /** The value on the cap of its bar, short («7», «4,4 M»; «—» for null). A quiet bucket shows none. */
  cap: string;
  /** The exact value, for the table and what the bucket says on hover and to a screen reader («4.400.000»). */
  exact: string;
  /** The date the bucket starts, for the axis, with numbers only («01/10/2026»). */
  axis: string;
  /** The whole bucket, for the table and its description («05/10/2026 – 11/10/2026»). */
  period: string;
}

export interface BarChartProps {
  /** The name of the chart: the title of its card. */
  label: string;
  buckets: readonly BarChartBucket[];
  /** Its twin for a screen reader, the keyboard and the eye that prefers numbers (DOC7-A, «Ver como tabla»). */
  asTable?: boolean;
  periodHeader: string;
  valueHeader: string;
  /** What it says without buckets. */
  empty: string;
  /** A fact about what it shows, in grey under it: that it shows the latest buckets, that some value did not fit. */
  note?: string;
}

// A cap shows only while the bar's slot is wide enough for it; the longest cap decides how wide (each slot is a container).
const capFits = ["@min-[1rem]:block", "@min-[1.75rem]:block", "@min-[2.5rem]:block", "@min-[3.25rem]:block"] as const;
const capFit = (caps: readonly string[]) => capFits[Math.min(capFits.length - 1, Math.floor(Math.max(0, ...caps.map(cap => cap.length - 1)) / 2))]!;
// The axis names a few buckets, more as the chart widens (the plot is their container): the first and the last always, then the
// middle, the quarters and the eighths, each with its full date, so they never touch.
const tickTiers = ["block", "hidden @min-[12rem]:block", "hidden @min-[28rem]:block", "hidden @min-[52rem]:block"] as const;
function ticks(count: number): Map<number, number> {
  const tiers = new Map<number, number>();
  for (let eighth = 0; eighth <= 8; eighth++) {
    const index = Math.round(eighth * (count - 1) / 8);
    const tier = eighth % 8 === 0 ? 0 : eighth % 4 === 0 ? 1 : eighth % 2 === 0 ? 2 : 3;
    tiers.set(index, Math.min(tiers.get(index) ?? tier, tier));
  }
  return tiers;
}

/**
 * Bars by period (DOC7-A): one bar per day, week or month, from a single baseline, with its value on the cap when it fits; a
 * bucket without responses is a short bar in the soft tone. The axis names a few buckets with their dates in numbers. Each bucket
 * says its period and its value on hover and to a screen reader, and `asTable` shows the same numbers as a table. Its owner
 * formats every value and date; one series, so it has no legend: the card's title names it.
 */
export function BarChart({ label, buckets, asTable = false, periodHeader, valueHeader, empty, note }: BarChartProps): ReactNode {
  const noteLine = note ? <p className="px-4 pb-3 text-xs text-[var(--color-content-muted)]">{note}</p> : null;
  if (asTable) return <>
    <DataTable columns={[{ id: "period", header: periodHeader, cell: bucket => bucket.period }, { id: "value", header: valueHeader, numeric: true, cell: bucket => bucket.exact }]}
      rows={buckets} rowKey={bucket => bucket.key} emptyTitle={empty} />
    {noteLine}
  </>;
  if (buckets.length === 0) return <p className="px-4 py-3 text-sm text-[var(--color-content-muted)]">{empty}</p>;
  const max = Math.max(0, ...buckets.map(bucket => bucket.value ?? 0));
  const fit = capFit(buckets.filter(bucket => bucket.value !== 0).map(bucket => bucket.cap));
  const axis = ticks(buckets.length);
  return (
    <div className="flex flex-col gap-1 px-4 pt-3 pb-3">
      <div className="@container">
        {/* The space between bars narrows with the buckets (at most a quarter of the plot), so four hundred still fit. */}
        <ol aria-label={label} className="flex h-40 items-stretch border-b border-[var(--color-border)]/50 pt-4" style={{ columnGap: `min(0.125rem, ${25 / buckets.length}%)` }}>
          {buckets.map((bucket, index) => {
            const height = bucket.value !== null && bucket.value > 0 && max > 0 ? bucket.value / max * 100 : 0;
            const quiet = bucket.value === 0;
            // The readout of the first buckets opens to the right and the one of the last, to the left, so the card never cuts it.
            const side = index < buckets.length / 3 ? "left-0" : index >= buckets.length * 2 / 3 ? "right-0" : "left-1/2 -translate-x-1/2";
            return (
              <li key={bucket.key} className="group @container relative min-w-0 flex-1">
                <span className="sr-only">{bucket.period}: {bucket.exact}</span>
                {bucket.value === null ? null : (
                  <span aria-hidden="true" data-quiet={quiet || undefined}
                    className={cn("absolute inset-x-0 bottom-0 mx-auto block max-w-6 rounded-t-sm", quiet ? "h-1 bg-chart-quiet" : "bg-chart-1 group-hover:bg-[var(--color-primary-hover)]")}
                    style={quiet ? undefined : { height: `${height}%` }} />
                )}
                {quiet ? null : (
                  <span aria-hidden="true" className={cn("absolute inset-x-0 hidden text-center text-[length:var(--text-caption)] leading-4 whitespace-nowrap text-[var(--color-content-muted)] tabular-nums", fit)}
                    style={{ bottom: `calc(${height}% + 0.125rem)` }}>{bucket.cap}</span>
                )}
                <span aria-hidden="true" className={cn("pointer-events-none absolute -top-4 z-10 hidden w-max max-w-[min(18rem,80vw)] rounded-[var(--radius-control)] bg-[var(--color-content)] px-2 py-1.5 text-xs font-medium text-[var(--color-tooltip-foreground)] group-hover:block", side)}>
                  {bucket.period}: {bucket.exact}
                </span>
              </li>
            );
          })}
        </ol>
        <div aria-hidden="true" className="relative h-4 text-[length:var(--text-caption)] leading-4 whitespace-nowrap text-[var(--color-content-muted)] tabular-nums">
          {buckets.map((bucket, index) => {
            const tier = axis.get(index);
            if (tier === undefined) return null;
            const edge = index === 0 || index === buckets.length - 1;
            // The first and the last date go under their bar while its slot fits them, and against the plot's edge when it does
            // not, never past it: auto margins center a date that fits and, when it does not, the flex start keeps it flush with
            // the edge (the left for the first; for the last, reversed, the right).
            if (edge) return <span key={bucket.key} className={cn("absolute top-0 flex", index === 0 ? "left-0" : "right-0 flex-row-reverse")}
              style={{ width: `${100 / buckets.length}%` }}><span className="mx-auto shrink-0">{bucket.axis}</span></span>;
            return <span key={bucket.key} className={cn("absolute top-0 -translate-x-1/2", tickTiers[tier])} style={{ left: `${(index + 0.5) / buckets.length * 100}%` }}>{bucket.axis}</span>;
          })}
        </div>
      </div>
      {note ? <p className="text-xs text-[var(--color-content-muted)]">{note}</p> : null}
    </div>
  );
}
