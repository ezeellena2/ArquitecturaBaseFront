import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";
import { Skeleton } from "../skeleton";

export interface StatCardProps {
  /** What the number is: «Respuestas», «Total de Monto (pesos)». */
  label: string;
  /** The number, already formatted by its owner; «—» when it could not be calculated. */
  value?: string;
  /** A line in grey under the number: its change against the previous period, or why it shows «—». */
  detail?: string;
  /** While it arrives, it keeps the place and the size of what comes. */
  loading?: boolean;
  /** One cell of a frame of its own that draws the border and the lines between its numbers, such as the summary of Consumo
   * (CO1-B): without its own border or corners. */
  flush?: boolean;
}

/**
 * A number with its variation (DOC7-A): the name in grey, the number at the level of a screen title, with the proportional
 * figures of the font, and its detail in grey. It does not format nor compare: its owner says the number, the sign and against
 * which period it compares («+18% que 01/09/2026 – 30/09/2026»).
 */
export function StatCard({ label, value, detail, loading = false, flush = false }: StatCardProps): ReactNode {
  return (
    <div data-slot="stat-card" data-flush={flush || undefined} className={cn("flex min-w-0 flex-col gap-1 bg-[var(--color-surface)] px-4 py-3",
      !flush && "rounded-[var(--radius-card)] border border-[var(--color-border)]")}>
      {loading ? (
        <>
          <Skeleton aria-hidden="true" className="h-4 w-2/3" />
          <Skeleton aria-hidden="true" className="h-7 w-1/2" />
          <Skeleton aria-hidden="true" className="h-4 w-3/4" />
        </>
      ) : (
        <>
          <p className="break-words text-xs text-[var(--color-content-muted)]">{label}</p>
          <p className="break-words text-2xl font-semibold text-[var(--color-content)]">{value}</p>
          {detail ? <p className="break-words text-xs text-[var(--color-content-muted)]">{detail}</p> : null}
        </>
      )}
    </div>
  );
}
