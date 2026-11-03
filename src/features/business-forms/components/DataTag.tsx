import type { ReactNode } from "react";

/**
 * A datum of a response shown as a tag (board MD1-A): in a message, the number, the reason or a question; in a suggestion, the
 * data that pass (board LR1-A). One whose question is no longer there is told in red.
 */
export function DataTag({ children, missing = false }: { children: ReactNode; missing?: boolean }) {
  return <span className={"rounded-[var(--radius-control)] px-1 text-xs font-medium " + (missing ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)]" : "bg-[var(--color-brand-100)] text-[var(--color-brand-700)]")}>{children}</span>;
}
