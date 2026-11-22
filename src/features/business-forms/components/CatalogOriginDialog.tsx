import { catalogValueTypes, isCatalogValueType, type CatalogValueType } from "../catalogValues";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Picker } from "@/shared/ui/Picker";

export type EditableCatalogOrigin = "Manual" | "Filters";

// Without legends (2026-10-31): each choice has its visible label, and what cannot change later goes in its (i). Both are the
// shared piece to choose (DS1-A, 2026-11-22), and how «Tomarlas de la base» works is the grey line under that option.
export function CatalogOriginDialog({ onOpenChange, onSelect }: {
  onOpenChange: (open: boolean) => void;
  onSelect: (origin: EditableCatalogOrigin, valueType: CatalogValueType) => void;
}) {
  const { t } = useTranslation("forms");
  const restoreFocus = useRestoreFocusOnClose();
  const [origin, setOrigin] = useState<EditableCatalogOrigin>("Manual");
  const [valueType, setValueType] = useState<CatalogValueType>("Text");
  return <Dialog open onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md" aria-describedby={undefined} onCloseAutoFocus={restoreFocus}>
      <DialogHeader>
        <DialogTitle>{t("catalogs.new")}</DialogTitle>
      </DialogHeader>
      <FormField label={t("catalogs.origin.label")} help={t("catalogs.origin.fixedHint")}>
        <Picker label={t("catalogs.origin.label")} value={origin} onChange={value => { if (value === "Manual" || value === "Filters") setOrigin(value); }}
          options={[
            { id: "Manual", label: t("catalogs.origin.manual") },
            { id: "Filters", label: t("catalogs.origin.filters"), description: t("catalogs.origin.filtersHint") },
          ]} />
      </FormField>
      {origin === "Manual" ? <FormField label={t("catalogs.valueType.label")} help={t("catalogs.valueType.fixedHint")}>
        <Picker label={t("catalogs.valueType.label")} value={valueType} onChange={value => { if (isCatalogValueType(value)) setValueType(value); }}
          options={catalogValueTypes.map(type => ({ id: type, label: t("catalogs.valueTypes." + type) }))} />
      </FormField> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
        <Button type="button" onClick={() => { onSelect(origin, origin === "Filters" ? "Text" : valueType); onOpenChange(false); }}>{t("catalogs.origin.continue")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
