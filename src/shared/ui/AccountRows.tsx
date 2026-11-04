import type { ComponentType, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

type IconComponent = ComponentType<{ className?: string }>;

/**
 * The rows that read an account: its sign-in methods, the chat of its number, its last sign-in (Mi perfil and «Editar
 * usuario», board PF1-A, 2026-11-03). One piece wherever they are read: the icon, the datum in grey, the value, its state
 * and its action, in fixed columns, with a line between rows. The list is the container the rows measure, so the same row
 * fits a whole zone, a dialog and a phone:
 *
 * - wide (from 42rem): one line, the datum and the value in their own columns, the state in its column and the action at
 *   the right edge; every row as tall as one with a button;
 * - medium (from 28rem, a dialog): the datum above the value, the state in its column and the action at the right;
 * - narrow (a phone): the action next to the datum, and the value and the state below them with the whole width, so a
 *   phone number is never covered by a button nor cut in two.
 */
export function AccountRows({ children }: { children: ReactNode }) {
  return <ul className="@container flex flex-col divide-y divide-[var(--color-border)]/60">{children}</ul>;
}

/// Every grid placement of the narrow layout is undone from the medium width on, where the cells flow in order.
const flowing = "@md:col-span-1 @md:col-start-auto @md:row-start-auto";

export function AccountRow({
  icon: Icon,
  label,
  value,
  muted = false,
  badge,
  action,
}: {
  icon: IconComponent;
  /// What the row is («Correo electrónico»): grey, as large as the value. It may carry its (i).
  label: ReactNode;
  /// The value already formatted, or what is missing («Sin correo») with `muted`. A state may be the value itself.
  value?: ReactNode;
  muted?: boolean;
  /// The state of the value («Verificado»), in its own column from a medium width.
  badge?: ReactNode;
  /// What can be done with the row, at its right edge.
  action?: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2.5 @md:grid-cols-[1rem_minmax(0,1fr)_auto_auto] @2xl:min-h-12.5 @2xl:grid-cols-[1rem_10rem_minmax(0,22rem)_7.5rem_minmax(0,1fr)]">
      <Icon className={cn("col-start-1 row-start-1 size-4 text-[var(--color-content-muted)]", flowing)} />
      <div className="contents @md:flex @md:min-w-0 @md:flex-col @md:gap-px @2xl:contents">
        <span className={cn("col-start-2 row-start-1 flex min-w-0 items-center gap-1 text-sm text-[var(--color-content-muted)]", flowing)}>
          {label}
        </span>
        {value === undefined ? null : (
          <span
            className={cn(
              "col-span-2 col-start-2 row-start-2 mt-0.5 flex min-w-0 text-sm break-words @md:mt-0",
              flowing,
              muted ? "text-[var(--color-content-muted)]" : "text-[var(--color-content)]",
            )}
          >
            {value}
          </span>
        )}
      </div>
      <span className={cn("col-span-2 col-start-2 row-start-3 mt-1 flex justify-self-start empty:hidden @md:mt-0 @md:empty:flex", flowing)}>
        {badge}
      </span>
      <div className={cn("col-start-3 row-start-1 flex flex-wrap items-center justify-end gap-2 justify-self-end", flowing)}>
        {action}
      </div>
    </li>
  );
}
