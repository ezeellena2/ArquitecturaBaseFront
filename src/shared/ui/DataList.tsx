import type { ReactNode } from "react";

export interface DataListItem {
  key?: string;
  label: ReactNode;
  value: ReactNode;
}

/**
 * The data of a record, in its box like a table of two columns (TC5-A, 2026-11-25, the rule of the whole app since LR1): the
 * datum in grey, as large as its value, in a tinted column of its own, the value in the text color beside it, a line between
 * rows and another between the two columns. Inside a card, a zone with its band or a table cell it runs from edge to edge,
 * like a table. `index.css` draws it. A short label never goes loose next to its value, as in «Cliente: Pérez Hnos.».
 */
export function DataList({ items }: { items: readonly DataListItem[] }) {
  return <dl data-slot="data-list" className="text-sm">{items.map((item, index) => <div key={item.key ?? index} data-slot="data-list-row">
    <dt className="min-w-0 break-words">{item.label}</dt>
    <dd className="min-w-0 break-words">{item.value}</dd>
  </div>)}</dl>;
}
