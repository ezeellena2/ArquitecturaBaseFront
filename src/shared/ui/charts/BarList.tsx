import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { DataTable } from "../DataTable";

/** A bar's color: the one of the charts, grey for what is left («Otras 3 opciones») and the roles of a state. */
export type ChartTone = "default" | "muted" | "success" | "warning" | "danger";

export interface BarListItem {
  key: string;
  label: string;
  /** How long its bar is, against the longest of the list; null when it could not be calculated. */
  value: number | null;
  /** The value, already formatted («38», «4.400.000», «—»). */
  valueLabel: string;
  /** Its share of the whole, already formatted («31%»), when there is one. */
  share?: string;
  tone?: ChartTone;
}

export interface BarListProps {
  /** The name of the list: the title of its card. */
  label: string;
  items: readonly BarListItem[];
  /** Its twin for a screen reader, the keyboard and the eye that prefers numbers (DOC7-A, «Ver como tabla»). */
  asTable?: boolean;
  labelHeader: string;
  valueHeader: string;
  shareHeader: string;
  /** What it says without items. */
  empty: string;
  /** A fact about what it shows, in grey under it. */
  note?: string;
}

const tones: Record<ChartTone, string> = {
  default: "bg-chart-1", muted: "bg-chart-5", success: "bg-chart-2", warning: "bg-chart-3", danger: "bg-chart-4",
};

/**
 * A distribution in bars (DOC7-A): one row per option, with its name, its bar against the longest and «38 · 31%», a line
 * between rows; where the list is narrow, the bar goes under the name. The bars are ranked by their owner, who formats every
 * value; the color of a bar never says something alone: each row says its name and its numbers. `asTable` shows the same
 * numbers as a table, one datum per column.
 */
export function BarList({ label, items, asTable = false, labelHeader, valueHeader, shareHeader, empty, note }: BarListProps): ReactNode {
  const noteLine = note ? <p className="px-4 pb-3 text-xs text-[var(--color-content-muted)]">{note}</p> : null;
  if (asTable) return <>
    <DataTable rows={items} rowKey={item => item.key} emptyTitle={empty} columns={[
      { sortable: false, id: "label", header: labelHeader, cell: item => item.label },
      { sortable: false, id: "value", header: valueHeader, numeric: true, cell: item => item.valueLabel },
      ...items.some(item => item.share) ? [{ sortable: false as const, id: "share", header: shareHeader, numeric: true, cell: (item: BarListItem) => item.share ?? "—" }] : [],
    ]} />
    {noteLine}
  </>;
  if (items.length === 0) return <p className="px-4 py-3 text-sm text-[var(--color-content-muted)]">{empty}</p>;
  const max = Math.max(0, ...items.map(item => item.value ?? 0));
  return (
    <div className="flex flex-col gap-1 px-4 py-1">
      <ul aria-label={label} className="@container divide-y divide-[var(--color-border)]/50">
        {items.map(item => {
          const width = item.value !== null && item.value > 0 && max > 0 ? item.value / max * 100 : 0;
          return (
            <li key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2 text-sm @min-[24rem]:grid-cols-[minmax(0,1fr)_minmax(4rem,10rem)_auto]">
              <span className="min-w-0 break-words">{item.label}</span>
              <span aria-hidden="true" className="col-span-2 row-start-2 block h-2 overflow-hidden rounded-sm bg-chart-track @min-[24rem]:col-span-1 @min-[24rem]:row-start-auto">
                <span className={cn("block h-full rounded-sm", tones[item.tone ?? "default"])} style={{ width: `${width}%` }} />
              </span>
              <span className="text-right whitespace-nowrap tabular-nums">
                {item.valueLabel}
                {item.share ? <span className="text-[var(--color-content-muted)]"> · {item.share}</span> : null}
              </span>
            </li>
          );
        })}
      </ul>
      {note ? <p className="pb-2 text-xs text-[var(--color-content-muted)]">{note}</p> : null}
    </div>
  );
}
