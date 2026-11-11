import type { ReactNode } from "react";

export interface ResultDatum { readonly key: string; readonly label: string; readonly value: ReactNode; readonly strong?: boolean; readonly numeric?: boolean }

const layouts = {
  four: "grid-cols-2 sm:grid-cols-4",
  two: "grid-cols-2",
  fit: "grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))]",
} as const;

/**
 * Each datum in its place, as the zone «Comprobante» draws them (EM1-A): the label in grey above and the value below, amounts
 * with tabular figures. Four per row (two on a phone) in the detail, two in a dialog, or as many as fit. A label names the group.
 */
export function ResultData({ label, items, layout = "four" }: { label?: string; items: readonly ResultDatum[]; layout?: keyof typeof layouts }) {
  const list = <dl className={"grid gap-x-4 gap-y-3 " + layouts[layout]}>
    {items.map(item => <div key={item.key} className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-[var(--color-content-muted)]">{item.label}</dt>
      <dd className={"min-w-0 break-words text-sm" + (item.numeric ? " tabular-nums" : "") + (item.strong ? " font-semibold" : "")}>{item.value}</dd>
    </div>)}
  </dl>;
  return label ? <div role="group" aria-label={label}>{list}</div> : list;
}
