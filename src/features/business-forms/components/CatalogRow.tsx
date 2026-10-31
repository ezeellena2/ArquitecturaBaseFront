import type { ReactNode } from "react";
import { ActionTooltip } from "@/shared/ui/ActionTooltip";
import { Button } from "@/shared/ui/button";
import { InfoIcon } from "@/shared/ui/icons";

// A row of the catalog modals («Campos de…» and the options): the label on the left from 640 px, on top below.
export function CatalogRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="grid gap-1.5 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-4">
    <div className="flex items-center gap-1 sm:min-h-[var(--height-control)] sm:self-start">{label}</div>
    <div className="flex min-w-0 flex-col gap-1.5">{children}</div>
  </div>;
}

// The message under a control. An error that quotes the value changes with each keystroke: `polite` announces it as a
// status instead of an alert that interrupts the typing.
export function CatalogRowMessage({ id, error, polite, children }: { id?: string; error?: boolean; polite?: boolean; children: ReactNode }) {
  return <p id={id} role={error ? polite ? "status" : "alert" : undefined} className={error ? "text-sm text-[var(--color-danger)]" : "text-sm text-[var(--color-content-muted)]"}>{children}</p>;
}

// The (i) next to a label: the explanation goes in its tooltip, not as a text under the control.
export function CatalogRowHelp({ label, text }: { label: string; text: string }) {
  return <ActionTooltip label={text}><Button type="button" variant="ghost" size="icon-xs" aria-label={label}><InfoIcon className="size-3.5" /></Button></ActionTooltip>;
}
