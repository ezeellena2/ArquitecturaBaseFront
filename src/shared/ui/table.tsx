import * as React from "react"
import { cn } from "cn"

const TableRefreshing = React.createContext(false)

// `refreshing` (board LC2-A, 2026-11-01): while the list reads again with its previous rows in sight, a line runs under
// the header and the body dims, out of reach, so nobody opens a row that no longer matches. The first load keeps its
// spinner in the owner's place.
// Every table draws a thin line between its columns, in the header and the body (A, 2026-11-02): `index.css` does it.
function Table({ className, scrollLabel, refreshing = false, ...props }: React.ComponentProps<"table"> & { scrollLabel?: string; refreshing?: boolean }) {
  return (
    <div
      data-slot="table-container"
      aria-busy={refreshing || undefined}
      className={cn("relative w-full overflow-x-auto", scrollLabel && "min-w-0 max-w-full")}
      role={scrollLabel ? "region" : undefined}
      aria-label={scrollLabel}
      tabIndex={scrollLabel ? 0 : undefined}
    >
      {refreshing ? (
        <div data-slot="table-refreshing" aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[var(--height-table-header)] z-10 h-0.5 overflow-hidden bg-[var(--color-brand-100)]">
          <div className="h-full w-1/3 animate-[table-refresh_1.2s_ease-in-out_infinite] bg-[var(--color-brand-500)] motion-reduce:animate-none" />
        </div>
      ) : null}
      <TableRefreshing.Provider value={refreshing}>
        <table
          data-slot="table"
          className={cn("w-full caption-bottom text-sm", className)}
          {...props}
        />
      </TableRefreshing.Provider>
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

// The last row closes the table with its line, over the scroll bar or the pagination (2026-11-02), unless the table is the
// last thing in its surface: then the surface's border closes it and a second line would double it.
function TableBody({ className, striped = true, ...props }: React.ComponentProps<"tbody"> & { striped?: boolean }) {
  const refreshing = React.useContext(TableRefreshing)
  return (
    <tbody
      data-slot="table-body"
      data-striped={striped}
      inert={refreshing || undefined}
      className={cn("[[data-slot=surface]>[data-slot=table-container]:last-child_&:last-child>tr:last-child]:border-b-0", refreshing && "opacity-45", className)}
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

// `numeric` (A, 2026-11-02): a column of numbers (quantities, measures, amounts, a row number) goes to the right, header
// included. Its owner marks the header and the cells of the same column together.
function TableHead({ className, numeric = false, ...props }: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-[var(--height-table-header)] px-4 text-left align-middle text-[length:var(--text-caption)] font-semibold tracking-[0.06em] uppercase whitespace-nowrap text-[var(--color-surface-header-foreground)] [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        numeric && "text-right",
        className
      )}
      {...props}
    />
  )
}

// A numeric cell also takes a narrower block to the right, such as a sheet value with its maximum width, which would
// otherwise stay at the left of a wider column.
function TableCell({ className, numeric = false, ...props }: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-4 py-0.5 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        numeric && "text-right *:ml-auto",
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
