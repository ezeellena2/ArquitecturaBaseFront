import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { WideTable } from "@/shared/ui/WideTable";
import type { ResponseItemValues } from "../responses";

type ItemValue = ResponseItemValues["values"][number];

/**
 * The items of a block of rows in the quick view (D2, TL1-A): each item with its number and its first answer in black, and the
 * other answers aligned under it with their question in grey, like the fields of a catalog option.
 */
export function ResponseRowsList({ label, items, answer }: { label: string; items: readonly ResponseItemValues[]; answer: (value: ItemValue) => ReactNode }) {
  return <ol aria-label={label} className="space-y-3">{items.map((item, index) => {
    const [first, ...rest] = item.values;
    return <li key={index} className="space-y-1">
      <div className="flex items-baseline gap-2"><span className="w-5 shrink-0 text-right tabular-nums text-[var(--color-content-muted)]">{index + 1}</span><div className="min-w-0 flex-1 font-medium">{answer(first)}</div></div>
      {rest.length ? <dl className="ml-7 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-l-2 border-[var(--color-surface-header)] pl-2.5 text-xs">{rest.map(value =>
        <div key={value.fieldId} className="contents"><dt className="text-[var(--color-content-muted)]">{value.label}</dt><dd className="min-w-0">{answer(value)}</dd></div>)}</dl> : null}
    </li>;
  })}</ol>;
}

/**
 * The items of a block of rows on the full page (DC1): a table with the number of the item to the right, without a visible
 * header, and a column per question of the block, with the numbers to the right. On the phone it scrolls sideways in its box.
 * Since it scrolls, the fields an option captured keep their words whole: with `minmax(0,1fr)` their column measured nothing
 * inside the cell and a word went down letter by letter.
 */
export function ResponseRowsTable({ label, items, answer }: { label: string; items: readonly ResponseItemValues[]; answer: (value: ItemValue) => ReactNode }) {
  const { t } = useTranslation("forms");
  const questions = items[0]?.values ?? [];
  return <WideTable label={label}>
    <TableHeader><TableRow>
      <TableHead numeric scope="col"><span className="sr-only">{t("responses.item")}</span></TableHead>
      {questions.map(question => <TableHead key={question.fieldId} numeric={question.type === "decimal"} scope="col">{question.label}</TableHead>)}
    </TableRow></TableHeader>
    <TableBody>{items.map((item, index) => <TableRow key={index}>
      <TableCell numeric>{index + 1}</TableCell>
      {item.values.map(value => <TableCell key={value.fieldId} numeric={value.type === "decimal"} className="[&_dl]:grid-cols-[auto_minmax(min-content,1fr)]">{answer(value)}</TableCell>)}
    </TableRow>)}</TableBody>
  </WideTable>;
}
