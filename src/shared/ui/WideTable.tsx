import { useId, useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "cn";
import { Table, TableCell, TableHead } from "./table";

type Pinned = "start" | "end";
function pinnedClasses(pinned: Pinned | undefined) {
  return pinned && cn("sticky z-10 bg-[inherit]", pinned === "start" ? "left-0" : "right-0");
}

/**
 * A contained, keyboard accessible table; pin only the outermost cell on each side. With `overflowHint`, while columns are
 * left to see on the right, that text shows above the table on the right and describes the region; scrolled to the end it
 * keeps its place, invisible, so the table does not move. A table that fits has no hint.
 */
export function WideTable({ label, overflowHint, ...props }: ComponentProps<typeof Table> & { label: string; overflowHint?: string }) {
  const region = useRef<HTMLDivElement>(null), hintId = useId();
  const [overflow, setOverflow] = useState<"none" | "more" | "end">("none");
  useLayoutEffect(() => {
    const node = region.current;
    if (!overflowHint || !node) return;
    const measure = () => setOverflow(node.scrollWidth - node.clientWidth <= 1 ? "none" : node.scrollLeft + node.clientWidth < node.scrollWidth - 1 ? "more" : "end");
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    node.addEventListener("scroll", measure, { passive: true });
    return () => { observer.disconnect(); node.removeEventListener("scroll", measure); };
  }, [overflowHint]);
  const hint = overflowHint && overflow !== "none" ? overflowHint : null;
  return <>
    {hint ? <p id={hintId} className={cn("px-4 pb-2 text-right text-xs text-[var(--color-content-muted)]", overflow === "end" && "invisible")}>{hint}</p> : null}
    <Table {...props} scrollLabel={label} scrollRef={region} scrollDescribedBy={hint && overflow === "more" ? hintId : undefined} />
  </>;
}

export function WideTableHead({ pinned, className, ...props }: ComponentProps<typeof TableHead> & { pinned?: Pinned }) {
  return <TableHead {...props} className={cn(pinnedClasses(pinned), className)} />;
}

export function WideTableCell({ pinned, className, ...props }: ComponentProps<typeof TableCell> & { pinned?: Pinned }) {
  return <TableCell {...props} className={cn(pinnedClasses(pinned), className)} />;
}
