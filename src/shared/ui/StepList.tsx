import type { ReactNode } from "react";

export interface Step {
  key: string;
  /** An icon of `icons` that tells what the step is; it is not read. */
  icon: ReactNode;
  content: ReactNode;
}

/**
 * A reading of something that happens in order, such as a rule or a suggestion (board LR1-A, 2026-11-03): one step per
 * part, from top to bottom, with its icon in a fixed column and a line that joins it to the next. What matters goes in the
 * content color and what joins it, in grey: the steps never put a short label next to loose text.
 */
export function StepList({ steps }: { steps: readonly Step[] }) {
  return <ol className="flex min-w-0 flex-1 flex-col">{steps.map((step, index) => {
    const last = index === steps.length - 1;
    return <li key={step.key} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2.5">
      <span aria-hidden="true" className="flex flex-col items-center">
        <span data-step-icon className="inline-flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-[var(--color-border)]/50 bg-[var(--color-surface-muted)] text-[var(--color-content-muted)] [&>svg]:size-3.5">{step.icon}</span>
        {last ? null : <span data-step-line className="min-h-2 w-px flex-1 bg-[var(--color-border)]/50" />}
      </span>
      <div className={"flex min-w-0 flex-col gap-1.5 pt-0.5 text-sm " + (last ? "" : "pb-3")}>{step.content}</div>
    </li>;
  })}</ol>;
}
