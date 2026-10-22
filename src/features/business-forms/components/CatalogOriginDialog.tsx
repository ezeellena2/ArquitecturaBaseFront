import { catalogValueTypes, isCatalogValueType, type CatalogValueType } from "../catalogValues";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";

export type EditableCatalogOrigin = "Manual" | "Filters";

export function CatalogOriginDialog({ onOpenChange, onSelect, filtersAvailable = true }: {
  filtersAvailable?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (origin: EditableCatalogOrigin, valueType: CatalogValueType) => void;
}) {
  const { t } = useTranslation("forms");
  const restoreFocus = useRestoreFocusOnClose();
  const [origin, setOrigin] = useState<EditableCatalogOrigin>("Manual");
  const [valueType, setValueType] = useState<CatalogValueType>("Text");
  return <Dialog open onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-2xl" onCloseAutoFocus={restoreFocus}>
      <DialogHeader>
        <DialogTitle>{t("catalogs.new")}</DialogTitle>
        <DialogDescription>{t("catalogs.origin.fixedHint")}</DialogDescription>
      </DialogHeader>
      <RadioGroupField label={t("catalogs.origin.label")} variant="cards" value={origin} onValueChange={value => { if (value === "Manual" || (value === "Filters" && filtersAvailable)) setOrigin(value); }}
        options={[
          { value: "Manual", label: t("catalogs.origin.manual"), description: t("catalogs.origin.manualHint") },
          { value: "Filters", label: t("catalogs.origin.filters"), description: t(filtersAvailable ? "catalogs.origin.filtersHint" : "catalogs.origin.comingSoon"), disabled: !filtersAvailable },
        ]} />
      {origin === "Manual" ? <div className="flex flex-col gap-2"><p className="text-sm font-medium">{t("catalogs.valueType.label")}</p><RadioGroupField label={t("catalogs.valueType.label")} value={valueType} onValueChange={value => { if (isCatalogValueType(value)) setValueType(value); }} options={catalogValueTypes.map(type => ({ value: type, label: t("catalogs.valueTypes." + type) }))} /><p className="text-xs text-[var(--color-content-muted)]">{t("catalogs.valueType.fixedHint")}</p></div> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
        <Button type="button" onClick={() => { onSelect(origin, origin === "Filters" ? "Text" : valueType); onOpenChange(false); }}>{t("catalogs.origin.continue")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
