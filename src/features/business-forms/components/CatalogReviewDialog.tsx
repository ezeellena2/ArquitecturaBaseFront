import type { ReactNode, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { ComparisonTable } from "@/shared/ui/ComparisonTable";
import { DataList } from "@/shared/ui/DataList";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { administrativeName } from "../editorModel";
import type { FormCulture } from "../model";
import type { CatalogFilterColumn, CatalogFiltersEditorValue } from "./CatalogFiltersEditor";

type Texts = Readonly<Record<string, string | null | undefined>>;
type Condition = CatalogFiltersEditorValue["conditions"][number];

/** The texts of a version of the catalog, read in the menu language and, without a translation, in their original. */
export interface CatalogReviewTexts {
  readonly name: Texts;
  readonly description: Texts;
}

const muted = (text: string) => <span className="text-[var(--color-content-muted)]">{text}</span>;
// Two versions of the filters read the same: the same columns, conditions (in their order), recipient and order.
const sameFilters = (mine: CatalogFiltersEditorValue, current: CatalogFiltersEditorValue | null) => !!current
  && mine.textColumn === current.textColumn && mine.detailColumn === current.detailColumn && mine.excludeRecipient === current.excludeRecipient
  && mine.sortColumn === current.sortColumn && mine.sortDescending === current.sortDescending && mine.conditions.length === current.conditions.length
  && mine.conditions.every((item, index) => {
    const other = current.conditions[index];
    return !!other && item.column === other.column && item.operator === other.operator && item.value === other.value;
  });

/**
 * «Revisión del catálogo» after a revision conflict, the same for the Manual editor and the one with filters (lista de
 * chequeo, 2026-11-11): the comparison side by side of LR2-A, as «Revisión del borrador», with each datum once (Nombre,
 * Descripción and, with filters, Filtros) and the current revision and the draft in their own columns, the saved one first,
 * without a legend. Once the current revision is read, only what differs enters; before, and when none of these data changed
 * (the options did), every datum, so the table is never empty. The current revision is «—» until «Releer» reads it, and
 * waits in its place while it is read again. Both are read in the menu language and, without a translation, in their original.
 */
export function CatalogReviewDialog({ open, onOpenChange, culture, mine, current, filters, rereading, busy, canReread = true, focusFallback, onReread, onAdopt }: {
  open: boolean; onOpenChange: (open: boolean) => void;
  culture: FormCulture;
  mine: CatalogReviewTexts; current: CatalogReviewTexts | null;
  /** Only in a catalog with filters: the filters of both versions, read with the columns of the view and their labels. */
  filters?: { mine: CatalogFiltersEditorValue; current: CatalogFiltersEditorValue | null; columns: readonly CatalogFilterColumn[] };
  rereading: boolean; busy: boolean; canReread?: boolean;
  focusFallback?: RefObject<HTMLElement | null>;
  onReread: () => void;
  /** Uses the current revision; the dialog closes itself. */
  onAdopt: () => void;
}) {
  const { t } = useTranslation("forms");
  const restoreFocus = useRestoreFocusOnClose(open, focusFallback);
  const text = (value: Texts) => administrativeName(value, culture) || muted("—");
  const reading = (value: CatalogFiltersEditorValue | null) => value && filters ? <CatalogFiltersReading value={value} columns={filters.columns} culture={culture} /> : muted("—");
  const sameText = (key: "name" | "description") => !!current && administrativeName(mine[key], culture) === administrativeName(current[key], culture);
  const rows: { key: string; datum: string; mine: ReactNode; current: () => ReactNode; same: () => boolean }[] = [
    { key: "name", datum: t("name"), mine: text(mine.name), current: () => text(current!.name), same: () => sameText("name") },
    { key: "description", datum: t("catalogs.metadata.description"), mine: text(mine.description), current: () => text(current!.description), same: () => sameText("description") },
  ];
  if (filters) rows.push({ key: "filters", datum: t("catalogs.review.filters"), mine: reading(filters.mine), current: () => reading(filters.current), same: () => sameFilters(filters.mine, filters.current) });
  const distinct = current && !rereading ? rows.filter(row => !row.same()) : rows;
  const shown = distinct.length ? distinct : rows;
  const currentValue = (row: (typeof rows)[number]) => rereading ? <Skeleton aria-hidden="true" className="my-1 h-3 w-24" /> : current ? row.current() : muted("—");
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-3xl" aria-describedby={undefined} onCloseAutoFocus={restoreFocus}>
    <DialogHeader><DialogTitle>{t("catalogs.review.title")}</DialogTitle></DialogHeader>
    {rereading ? <span role="status" className="sr-only">{t("common:states.loading")}</span> : null}
    <Surface><ComparisonTable columns={{ identity: [{ key: "datum", header: t("reviewData") }], before: t("catalogs.review.current"), after: t("catalogs.review.mine") }}
      groups={shown.map(row => ({ key: row.key, identity: [row.datum], lines: [{ key: "value", before: currentValue(row), after: row.mine }] }))} /></Surface>
    {/* Cancel next to the main action, which goes last. */}
    <DialogFooter>
      <Button type="button" variant="outline" pending={rereading} disabled={busy || !canReread} onClick={onReread}>{t(rereading ? "rereading" : "catalogs.review.reread")}</Button>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.close")}</Button>
      <Button type="button" disabled={busy || !current} onClick={() => { onAdopt(); onOpenChange(false); }}>{t("catalogs.review.adopt")}</Button>
    </DialogFooter>
  </DialogContent></Dialog>;
}

// The filters of a version, read as the data of a record (LR1-A) with the labels of the editor: which column is the text and
// which the detail, the rows that enter (a condition per line), whether the recipient is left out and the order.
function CatalogFiltersReading({ value, columns, culture }: { value: CatalogFiltersEditorValue; columns: readonly CatalogFilterColumn[]; culture: FormCulture }) {
  const { t } = useTranslation("forms");
  const column = (key: string) => columns.find(candidate => candidate.key === key);
  const columnLabel = (key: string) => column(key)?.label ?? t("catalogs.filters.unavailableColumn");
  const condition = (item: Condition) => {
    const source = column(item.column);
    const operator = source?.operators.find(candidate => candidate.key === item.operator)?.label ?? t("catalogs.filters.unavailableOperator");
    const shown = source?.choices ? source.choices.find(choice => choice.key === item.value)?.label ?? t("catalogs.filters.unavailableValue") : item.value;
    return [columnLabel(item.column), operator.toLocaleLowerCase(culture), shown].join(" ");
  };
  return <DataList items={[
    { key: "text", label: t("catalogs.filters.textColumn"), value: columnLabel(value.textColumn) },
    { key: "detail", label: t("catalogs.items.detail"), value: value.detailColumn === null ? t("catalogs.filters.noDetail") : columnLabel(value.detailColumn) },
    { key: "conditions", label: t("catalogs.filters.conditions"), value: value.conditions.length ? <ul>{value.conditions.map(item => <li key={item.localId}>{condition(item)}</li>)}</ul> : muted("—") },
    { key: "recipient", label: t("catalogs.filters.excludeRecipient"), value: t(value.excludeRecipient ? "catalogs.presentation.yes" : "catalogs.presentation.no") },
    { key: "order", label: t("catalogs.filters.order"), value: columnLabel(value.sortColumn) + ", " + t(value.sortDescending ? "catalogs.filters.descending" : "catalogs.filters.ascending") },
  ]} />;
}
