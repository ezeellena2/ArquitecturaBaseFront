import { useId } from "react";
import { DataTable } from "./DataTable";
import { ChevronDownIcon, UndoIcon } from "./icons";
import { Input } from "./input";
import { RowActions } from "./RowActions";

export interface PieceColorRow { key: string; label: string; color: string; own: boolean; error?: string }
export interface PieceColorGroup { id: string; title: string; summary: string; rows: readonly PieceColorRow[] }

export interface PieceColorsLabels {
  piece: string; color: string; origin: string; actions: string; automatic: string; own: string; reset: string;
  resetPiece: (piece: string) => string; colorOf: (piece: string) => string;
  expand: (group: string) => string; collapse: (group: string) => string;
}

/// ME10: the pieces of a palette in foldable groups. Each row shows its color and its code, says whether it is automatic or own
/// and, when own, offers to return it to automatic; the problem of a color goes under its field, like in any form.
export function PieceColors({ groups, open, onOpenChange, labels, disabled, onChange, onReset }: {
  groups: readonly PieceColorGroup[]; open: ReadonlySet<string>; onOpenChange: (group: string, open: boolean) => void;
  labels: PieceColorsLabels; disabled?: boolean; onChange: (piece: string, color: string) => void; onReset: (piece: string) => void;
}) {
  return <div className="flex flex-col">
    {groups.map(group => <PieceColorGroupRows key={group.id} group={group} open={open.has(group.id)} onOpenChange={next => onOpenChange(group.id, next)}
      labels={labels} disabled={disabled} onChange={onChange} onReset={onReset} />)}
  </div>;
}

function PieceColorGroupRows({ group, open, onOpenChange, labels, disabled, onChange, onReset }: {
  group: PieceColorGroup; open: boolean; onOpenChange: (open: boolean) => void; labels: PieceColorsLabels; disabled?: boolean;
  onChange: (piece: string, color: string) => void; onReset: (piece: string) => void;
}) {
  const contentId = useId();
  return <section className="border-t border-[var(--color-border)] first:border-t-0">
    <h3 className="m-0">
      <button type="button" aria-expanded={open} aria-controls={contentId} aria-label={open ? labels.collapse(group.title) : labels.expand(group.title)}
        className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-sm font-semibold outline-none hover:bg-[var(--color-surface-muted)] focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onClick={() => onOpenChange(!open)}>
        <ChevronDownIcon className={open ? "size-4 shrink-0" : "size-4 shrink-0 -rotate-90"} />
        <span>{group.title}</span>
        <span className="font-normal text-[var(--color-content-muted)]">· {group.summary}</span>
      </button>
    </h3>
    <div id={contentId} hidden={!open}>
      <DataTable rows={group.rows} rowKey={row => row.key} columns={[
        { sortable: false, id: "piece", header: labels.piece, cell: row => row.label },
        { sortable: false, id: "color", header: labels.color, cell: row => <PieceColorField row={row} labels={labels} disabled={disabled} onChange={onChange} /> },
        { sortable: false, id: "origin", header: labels.origin, cell: row => row.own
          ? <span className="font-semibold">{labels.own}</span> : <span className="text-[var(--color-content-muted)]">{labels.automatic}</span> },
        { sortable: false, id: "actions", header: labels.actions, align: "right", cell: row => <RowActions actions={[{ label: labels.reset,
          accessibleName: labels.resetPiece(row.label), icon: UndoIcon, hidden: !row.own, disabled, onSelect: () => onReset(row.key) }]} /> },
      ]} />
    </div>
  </section>;
}

function PieceColorField({ row, labels, disabled, onChange }: {
  row: PieceColorRow; labels: PieceColorsLabels; disabled?: boolean; onChange: (piece: string, color: string) => void;
}) {
  const errorId = useId();
  return <div className="flex flex-col gap-1 py-1">
    <div className="flex items-center gap-2">
      <Input type="color" value={row.color.toLowerCase()} disabled={disabled} aria-label={labels.colorOf(row.label)}
        aria-invalid={row.error ? true : undefined} aria-describedby={row.error ? errorId : undefined}
        className="h-7 w-12 shrink-0 cursor-pointer p-0.5" onChange={event => onChange(row.key, event.target.value)} />
      <span className="tabular-nums">{row.color.toUpperCase()}</span>
    </div>
    {row.error ? <p id={errorId} className="text-xs text-destructive">{row.error}</p> : null}
  </div>;
}
