import { useId } from "react";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui/dropdown-menu";
import { FilterChip } from "@/shared/ui/FilterChip";
import { Label } from "@/shared/ui/label";

export interface QuestionChip { readonly id: string; readonly label: string }

/**
 * What a sum adds (CA1-A) or the answers that show a question (CO1-A): a labelled group of chips, each with its ×, and «+ Agregar»,
 * a menu of what is left. Off, «+ Agregar» says why on itself (MA1-A). Locked by the library standard (BI1-A) the chips lose their
 * × and «+ Agregar» gives the reason; read only, there is neither.
 */
export function QuestionChips({ label, chips, options, addLabel, removeLabel, onAdd, onRemove, readOnly, lockedReason, addReason }: {
  label: string; chips: readonly QuestionChip[]; options: readonly QuestionChip[]; addLabel: string; removeLabel: (label: string) => string;
  onAdd: (id: string) => void; onRemove: (id: string) => void; readOnly: boolean; lockedReason?: string | null;
  /** Why nothing more can be added: the limit, or nothing left to choose. */
  addReason?: string | null;
}) {
  const id = useId();
  const reason = lockedReason ?? addReason ?? null;
  return <div className="flex min-w-0 flex-col gap-1.5">
    <Label asChild><span id={id}>{label}</span></Label>
    <div role="group" aria-labelledby={id} className="flex min-h-[var(--height-control)] flex-wrap items-center gap-1.5">
      {chips.map(chip => readOnly || lockedReason ? <FilterChip key={chip.id}>{chip.label}</FilterChip>
        : <FilterChip key={chip.id} removeLabel={removeLabel(chip.label)} onRemove={() => onRemove(chip.id)}>{chip.label}</FilterChip>)}
      {readOnly ? null : reason || options.length === 0
        ? <DisabledReason reason={reason}><Button type="button" variant="outline" size="sm" disabled>{addLabel}</Button></DisabledReason>
        : <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm">{addLabel}</Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start">{options.map(option => <DropdownMenuItem key={option.id} onSelect={() => onAdd(option.id)}>{option.label}</DropdownMenuItem>)}</DropdownMenuContent>
        </DropdownMenu>}
    </div>
  </div>;
}
