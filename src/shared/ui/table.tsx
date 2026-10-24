import * as React from "react"
import { cn } from "cn"

function Table({ className, scrollLabel, scrollRef, scrollDescribedBy, ...props }: React.ComponentProps<"table"> & { scrollLabel?: string; scrollRef?: React.Ref<HTMLDivElement>; scrollDescribedBy?: string }) {
  return (
    <div
      ref={scrollRef}
      data-slot="table-container"
      className={cn("relative w-full overflow-x-auto", scrollLabel && "min-w-0 max-w-full")}
      role={scrollLabel ? "region" : undefined}
      aria-label={scrollLabel}
      aria-describedby={scrollDescribedBy}
      tabIndex={scrollLabel ? 0 : undefined}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-[var(--color-surface-header)] [&_tr]:h-[var(--height-table-header)] [&_tr]:border-b [&_tr]:border-[var(--color-surface-header-border)] [&_tr]:bg-[var(--color-surface-header)] [&_tr:hover]:bg-[var(--color-surface-header)]", className)}
      {...props}
    />
  )
}

function TableBody({ className, striped = true, ...props }: React.ComponentProps<"tbody"> & { striped?: boolean }) {
  return (
    <tbody
      data-slot="table-body"
      data-striped={striped}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, highlightExpanded = true, tone = "default", ...props }: React.ComponentProps<"tr"> & { highlightExpanded?: boolean; tone?: "default" | "section" }) {
  return (
    <tr
      data-slot="table-row"
      data-tone={tone}
      className={cn(
        "h-[var(--height-table-row)] border-b border-[var(--color-border)]/50 transition-colors hover:bg-[var(--color-table-row-hover)] data-[state=selected]:bg-muted",
        highlightExpanded && "has-aria-expanded:bg-muted/50",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-[var(--height-table-header)] px-4 text-left align-middle text-[length:var(--text-caption)] font-semibold tracking-[0.06em] uppercase whitespace-nowrap text-[var(--color-surface-header-foreground)] [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-0.5 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function TableRowHeader({ className, ...props }: Omit<React.ComponentProps<"th">, "scope">) {
  return <th {...props} scope="row" data-slot="table-row-header" className={cn("px-4 py-1.5 text-left align-middle text-sm font-normal", className)} />
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  TableRowHeader,
}
