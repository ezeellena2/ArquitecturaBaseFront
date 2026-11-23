import * as React from "react"
import { cn } from "cn"

// `answered`: a read-only text that someone answered, like the reading of a response with the shape of its form (VF1-A), as in
// `Input`. It keeps the box of the control and the text colour; any other read-only text is grey.
function Textarea({ className, answered = false, ...props }: React.ComponentProps<"textarea"> & { answered?: boolean }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-input bg-[var(--color-control-surface)] px-3 py-2 text-sm transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-[var(--color-surface-muted)] disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
        answered ? "read-only:shadow-none" : "read-only:bg-[var(--color-surface-muted)] read-only:text-[var(--color-content-muted)] read-only:shadow-none",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
