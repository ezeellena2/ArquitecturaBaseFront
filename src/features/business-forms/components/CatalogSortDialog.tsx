import { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Picker } from "@/shared/ui/Picker";
import type { CatalogItemSort } from "../api/catalogs";
import type { CatalogFieldDraft } from "../catalogFields";
import { catalogSortFields, catalogSortKind } from "../catalogSort";
import { administrativeName } from "../editorModel";
import type { FormCulture } from "../model";

// «Ordenar por…» (OR1-A): the column and the direction of the order that Save applies to every option. Nothing moves here:
// «Ordenar» leaves it pending in the draft, and opening it again shows that choice to change it.
export function CatalogSortDialog({ fields, culture, value, focusFallback, onApply, onClose }: {
  fields: readonly CatalogFieldDraft[];
  /** The menu language, in which the fields are named. */
  culture: FormCulture;
  /** The pending order, if any: the dialog opens with it. */
  value: CatalogItemSort | null;
  focusFallback?: RefObject<HTMLElement | null>;
  onApply: (sort: CatalogItemSort) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("forms");
  const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
  const [column, setColumn] = useState(value?.column ?? "text");
  const [descending, setDescending] = useState(value?.descending ?? false);
  const kind = catalogSortKind(column, fields);
  const columns = [{ value: "text", label: t("catalogs.items.text") }, { value: "code", label: t("catalogs.items.code") },
    ...catalogSortFields(fields).map(field => ({ value: field.id!, label: administrativeName(field.name, culture) || t("catalogs.fields.new") }))];
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="sm:max-w-md" aria-describedby={undefined} onCloseAutoFocus={restoreFocus}>
      <DialogHeader>
        <DialogTitle>{t("catalogs.sort.title")}</DialogTitle>
      </DialogHeader>
      <FormField label={t("catalogs.sort.column")}>
        <Picker label={t("catalogs.sort.column")} value={column} onChange={setColumn} options={columns.map(option => ({ id: option.value, label: option.label }))} />
      </FormField>
      <FormField label={t("catalogs.sort.order")} help={t("catalogs.sort.orderHelp")}>
        <Picker label={t("catalogs.sort.order")} value={descending ? "desc" : "asc"} onChange={next => setDescending(next === "desc")}
          options={[{ id: "asc", label: t("common:sort." + kind + ".asc") }, { id: "desc", label: t("common:sort." + kind + ".desc") }]} />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button>
        <Button type="button" onClick={() => { onApply({ column, descending }); onClose(); }}>{t("catalogs.sort.apply")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
