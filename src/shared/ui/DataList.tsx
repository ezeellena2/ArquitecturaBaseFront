import type { ReactNode } from "react";

export interface DataListItem {
  key?: string;
  label: ReactNode;
  value: ReactNode;
}

/**
 * The data of a record, read in two aligned columns like the detail of a response (board TL1-A, made the rule of the whole
 * app with LR1, 2026-11-03): the datum in grey, as large as its value, in a column of its own, the value in the text color,
 * and a line between rows. A short label never goes loose next to its value, as in «Cliente: Pérez Hnos.».
 */
export function DataList({ items }: { items: readonly DataListItem[] }) {
  return <dl className="divide-y divide-[var(--color-border)] text-sm">{items.map((item, index) => <div key={item.key ?? index} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2">
    <dt className="min-w-0 break-words text-[var(--color-content-muted)]">{item.label}</dt>
    <dd className="min-w-0 break-words">{item.value}</dd>
  </div>)}</dl>;
}
