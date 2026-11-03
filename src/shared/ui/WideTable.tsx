import type { ComponentProps } from "react";
import { cn } from "cn";
import { Table, TableCell, TableHead } from "./table";

type Pinned = "start" | "end";
function pinnedClasses(pinned: Pinned | undefined) {
  return pinned && cn("sticky z-10 bg-[inherit]", pinned === "start" ? "left-0" : "right-0");
}

/** A contained, keyboard accessible table; pin only the outermost cell on each side. Its scroll bar says there is more. */
export function WideTable({ label, ...props }: ComponentProps<typeof Table> & { label: string }) {
  return <Table {...props} scrollLabel={label} />;
}

// `data-pinned` lets the line between columns go with the pinned cell as the table scrolls (`index.css`).
export function WideTableHead({ pinned, className, ...props }: ComponentProps<typeof TableHead> & { pinned?: Pinned }) {
  return <TableHead {...props} data-pinned={pinned} className={cn(pinnedClasses(pinned), className)} />;
}

export function WideTableCell({ pinned, className, ...props }: ComponentProps<typeof TableCell> & { pinned?: Pinned }) {
  return <TableCell {...props} data-pinned={pinned} className={cn(pinnedClasses(pinned), className)} />;
}
