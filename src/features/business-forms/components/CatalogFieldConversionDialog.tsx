import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import type { CatalogInvalidFieldRow } from "../api/catalogFieldFeedback";
import { catalogFieldProblemText, type CatalogFieldDraft, type CatalogFieldType } from "../catalogFields";
import type { FormCulture } from "../model";

const shownRows = 5;

/** CE1 «Cambiar el tipo»: the server's rows that do not convert, with the way to show them in the table. */
export function CatalogFieldConversionDialog({ name, from, field, culture, convertedCount, invalidCount, rows, onClose, onShowRows }: {
  name: string; from: CatalogFieldType; field: Pick<CatalogFieldDraft, "type" | "min" | "max" | "maxLength">;
  /** The draft's culture, in which its bounds are written. */
  culture: FormCulture;
  convertedCount: number; invalidCount: number; rows: readonly CatalogInvalidFieldRow[];
  onClose: () => void; onShowRows: () => void;
}) {
  const { t, i18n } = useTranslation("forms");
  const restoreFocus = useRestoreFocusOnClose();
  const typeName = (type: CatalogFieldType) => t("catalogs.fields.types." + type).toLocaleLowerCase(i18n.language);
  const shown = rows.slice(0, shownRows);
  const more = invalidCount - shown.length;
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent onCloseAutoFocus={restoreFocus} className="sm:max-w-xl">
    <DialogHeader><DialogTitle>{t("catalogs.fields.conversion.title", { name })}</DialogTitle>
      {from !== field.type ? <p className="text-sm font-medium">{t("catalogs.fields.conversion.types", { from: typeName(from), to: typeName(field.type) })}</p> : null}
      <DialogDescription>{t("catalogs.fields.conversion.reviewed", { count: convertedCount + invalidCount, converted: t("catalogs.fields.conversion.converted", { count: convertedCount }), invalid: t("catalogs.fields.conversion.invalid", { count: invalidCount }) })}</DialogDescription>
    </DialogHeader>
    <Table><TableHeader><TableRow><TableHead scope="col">{t("catalogs.fields.conversion.row")}</TableHead><TableHead scope="col">{t("catalogs.fields.conversion.what")}</TableHead></TableRow></TableHeader>
      <TableBody>{shown.map(row => <TableRow key={row.itemId}><TableCell>{row.row}</TableCell><TableCell className="whitespace-normal">{catalogFieldProblemText(t, field, row.value, row.reason, culture)}</TableCell></TableRow>)}</TableBody></Table>
    {more > 0 ? <p className="text-sm text-[var(--color-content-muted)]">{t("catalogs.fields.conversion.more", { count: more })}</p> : null}
    <Banner>{t("catalogs.fields.conversion.hint")}</Banner>
    <DialogFooter><Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button><Button type="button" onClick={onShowRows}>{t("catalogs.fields.conversion.show", { count: rows.length })}</Button></DialogFooter>
  </DialogContent></Dialog>;
}
