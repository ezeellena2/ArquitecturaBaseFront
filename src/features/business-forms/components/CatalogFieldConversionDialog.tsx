import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { formatNumber } from "@/shared/lib/numberFormat";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { CatalogInvalidFieldRow } from "../api/catalogFieldFeedback";
import { catalogFieldProblemText, catalogStoredValueText, type CatalogFieldDraft, type CatalogFieldType } from "../catalogFields";
import type { FormCulture } from "../model";

const shownRows = 5;

/**
 * CE1 «Cambiar el tipo»: the server's rows that do not convert, with the way to show them in the table (`onShowRows`, not for a
 * removed field, which has no column there). The saved type and the new one (when the type changed, not only the source) and
 * the counts read as the data of a record (lista de chequeo, 2026-11-11), never as a title or a sentence.
 */
export function CatalogFieldConversionDialog({ name, from, field, culture, convertedCount, invalidCount, rows, onClose, onShowRows }: {
  name: string; from: CatalogFieldType; field: Pick<CatalogFieldDraft, "type" | "min" | "max" | "maxLength">;
  /** The draft's culture, in which its bounds are written. */
  culture: FormCulture;
  convertedCount: number; invalidCount: number; rows: readonly CatalogInvalidFieldRow[];
  onClose: () => void; onShowRows?: () => void;
}) {
  const { t, i18n } = useTranslation("forms");
  const restoreFocus = useRestoreFocusOnClose();
  const count = (value: number) => formatNumber(value, i18n.language);
  const shown = rows.slice(0, shownRows);
  const more = invalidCount - shown.length;
  // A row quotes the value saved in the previous type as its cell showed it; a saved option comes as its text.
  const yesNo = { yes: t("catalogs.presentation.yes"), no: t("catalogs.presentation.no") };
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent aria-describedby={undefined} onCloseAutoFocus={restoreFocus} className="sm:max-w-xl">
    <DialogHeader><DialogTitle>{t("catalogs.fields.conversion.title", { name })}</DialogTitle></DialogHeader>
    <DataList items={[
      ...(from !== field.type ? [
        { key: "from", label: t("catalogs.fields.conversion.savedType"), value: t("catalogs.fields.types." + from) },
        { key: "to", label: t("catalogs.fields.conversion.newType"), value: t("catalogs.fields.types." + field.type) },
      ] : []),
      { key: "loaded", label: t("catalogs.fields.conversion.loaded"), value: count(convertedCount + invalidCount) },
      { key: "converted", label: t("catalogs.fields.conversion.converted"), value: count(convertedCount) },
      { key: "invalid", label: t("catalogs.fields.conversion.invalid"), value: count(invalidCount) },
    ]} />
    <Table><TableHeader><TableRow><TableHead numeric scope="col">{t("catalogs.fields.conversion.row")}</TableHead><TableHead scope="col">{t("catalogs.fields.conversion.what")}</TableHead></TableRow></TableHeader>
      <TableBody>{shown.map(row => <TableRow key={row.itemId}><TableCell numeric>{row.row}</TableCell><TableCell className="whitespace-normal">{catalogFieldProblemText(t, field, catalogStoredValueText(from, row.value, culture, yesNo), row.reason, culture)}</TableCell></TableRow>)}</TableBody></Table>
    {more > 0 ? <p className="text-sm text-[var(--color-content-muted)]">{t("catalogs.fields.conversion.more", { count: more })}</p> : null}
    {/* «Ver los N en la tabla» is the way to fix them: no banner explains it (2026-10-31). */}
    <DialogFooter><Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button>{onShowRows ? <Button type="button" onClick={onShowRows}>{t("catalogs.fields.conversion.show", { count: rows.length })}</Button> : null}</DialogFooter>
  </DialogContent></Dialog>;
}
