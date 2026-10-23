import type { ComponentProps } from "react";
import { cn } from "cn";
import { Table, TableCell, TableHead } from "./table";

type Pinned = "start" | "end";
function pinnedClasses(pinned: Pinned | undefined) {
  return pinned && cn("sticky z-10 bg-[inherit]", pinned === "start" ? "left-0" : "right-0");
}

/** A contained, keyboard accessible table; pin only the outermost cell on each side. */
export function WideTable({ label, ...props }: ComponentProps<typeof Table> & { label: string }) {
  return <Table {...props} scrollLabel={label} />;
}

export function WideTableHead({ pinned, className, ...props }: ComponentProps<typeof TableHead> & { pinned?: Pinned }) {
  return <TableHead {...props} className={cn(pinnedClasses(pinned), className)} />;
}

export function WideTableCell({ pinned, className, ...props }: ComponentProps<typeof TableCell> & { pinned?: Pinned }) {
  return <TableCell {...props} className={cn(pinnedClasses(pinned), className)} />;
}
