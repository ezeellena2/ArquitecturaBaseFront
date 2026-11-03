import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

export interface ComparisonLine {
  key: string;
  /** The datum, once for both versions (`Rubro`, `Lunes`); left out when what changed is a single value. */
  label?: ReactNode;
  before: ReactNode;
  after: ReactNode;
}

export interface ComparisonGroup {
  key: string;
  /** What changed, one value per identity column: the question or the section; the row and the code of an option. */
  identity: readonly ReactNode[];
  lines: readonly ComparisonLine[];
  /** On the phone only the first identity column shows: this says it all in one line, such as «ART-0012 · fila 4». */
  mobileTitle?: ReactNode;
  /** Under the last value of the second version, such as why it cannot be kept. */
  note?: ReactNode;
}

export interface ComparisonColumns {
  identity: readonly { key: string; header: ReactNode; numeric?: boolean }[];
  /** The header of the data column; the column shows when some line has a label. */
  label?: ReactNode;
  before: ReactNode;
  after: ReactNode;
}

// The table draws the line at the left of every cell but the first one of its row. Under a cell that spans several rows,
// the first cell of the next ones is not in the first column and keeps its line. On the phone, the line only goes between
// the two versions.
const keepsLine = "[--table-line-start:1px] max-sm:[--table-line-start:0px]";
const firstLine = "max-sm:[--table-line-start:0px]";
// On the phone the cells keep a narrower padding, so a long word fits in half of the width.
const cell = "align-top whitespace-normal break-words py-1.5 max-sm:px-2.5";

/**
 * Two versions of something compared side by side (board LR2-A, 2026-11-03): what changed, each datum once in grey and, in
 * their own columns, both versions, so that one value is read in front of the other. Only what differs comes in. On the
 * phone the datum takes its own line and both versions go under it, in two columns, without scrolling sideways.
 */
export function ComparisonTable({ columns, groups }: { columns: ComparisonColumns; groups: readonly ComparisonGroup[] }) {
  const labelled = groups.some(group => group.lines.some(line => line.label !== undefined));
  return <Table className="max-sm:block">
    <TableHeader className="max-sm:block max-sm:[&_tr]:h-auto">
      <TableRow className="max-sm:grid max-sm:grid-cols-2">
        {columns.identity.map(column => <TableHead key={column.key} scope="col" numeric={column.numeric} className="whitespace-normal max-sm:hidden">{column.header}</TableHead>)}
        {labelled ? <TableHead scope="col" className="whitespace-normal max-sm:hidden">{columns.label}</TableHead> : null}
        <TableHead scope="col" className={cn("whitespace-normal max-sm:h-auto max-sm:px-2.5 max-sm:py-1.5", firstLine)}>{columns.before}</TableHead>
        <TableHead scope="col" className="whitespace-normal max-sm:h-auto max-sm:px-2.5 max-sm:py-1.5">{columns.after}</TableHead>
      </TableRow>
    </TableHeader>
    {groups.map(group => {
      // A single value without a datum spans the data column, so the change reads in one line.
      const single = labelled && group.lines.length === 1 && group.lines[0]!.label === undefined;
      return <TableBody key={group.key} striped={false} className="max-sm:block">{group.lines.map((line, index) => {
        const last = index === group.lines.length - 1;
        return <TableRow key={line.key} className="hover:bg-[var(--color-surface)] max-sm:grid max-sm:h-auto max-sm:grid-cols-2">
          {index === 0 ? group.identity.map((value, position) => {
            const numeric = columns.identity[position]?.numeric ?? false;
            const span = group.lines.length > 1 ? group.lines.length : undefined;
            const columnsSpanned = single && position === group.identity.length - 1 ? 2 : undefined;
            const content = position === 0 && group.mobileTitle !== undefined
              ? <><span className="max-sm:hidden">{value}</span><span className="sm:hidden">{group.mobileTitle}</span></> : value;
            return position === 0
              ? <th key={position} scope="rowgroup" rowSpan={span} colSpan={columnsSpanned} className={cn("px-4 text-left text-sm font-medium", cell, numeric && "text-right max-sm:text-left", "max-sm:col-span-2 max-sm:pt-2 max-sm:pb-0", firstLine)}>{content}</th>
              : <TableCell key={position} rowSpan={span} colSpan={columnsSpanned} numeric={numeric} className={cn(cell, "max-sm:hidden")}>{value}</TableCell>;
          }) : null}
          {labelled && !single ? <th scope="row" className={cn("px-4 text-left text-sm font-normal text-[var(--color-content-muted)]", cell, "max-sm:col-span-2 max-sm:pb-0", keepsLine)}>{line.label}</th> : null}
          <TableCell className={cn(cell, keepsLine)}>{line.before}</TableCell>
          <TableCell className={cell}>{line.after}{last && group.note ? <p className="mt-1 text-sm text-[var(--color-content-muted)]">{group.note}</p> : null}</TableCell>
        </TableRow>;
      })}</TableBody>;
    })}
  </Table>;
}
