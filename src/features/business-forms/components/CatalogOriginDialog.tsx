import { catalogValueTypes, isCatalogValueType, type CatalogValueType } from "../catalogValues";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { InfoTip } from "@/shared/ui/InfoTip";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";

export type EditableCatalogOrigin = "Manual" | "Filters";

// Without legends (2026-10-31): each choice has its visible label, and what cannot change later goes in its (i).
export function CatalogOriginDialog({ onOpenChange, onSelect }: {
  onOpenChange: (open: boolean) => void;
  onSelect: (origin: EditableCatalogOrigin, valueType: CatalogValueType) => void;
}) {
  const { t } = useTranslation("forms");
  const restoreFocus = useRestoreFocusOnClose();
  const [origin, setOrigin] = useState<EditableCatalogOrigin>("Manual");
  const [valueType, setValueType] = useState<CatalogValueType>("Text");
  const label = (text: string, help: string) => <div className="flex items-center gap-1">
    <p className="text-sm font-medium">{text}</p>
    <span className="-my-1 inline-flex"><InfoTip label={t("common:actions.moreInfo", { label: text })} text={help} /></span>
  </div>;
  return <Dialog open onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-2xl" aria-describedby={undefined} onCloseAutoFocus={restoreFocus}>
      <DialogHeader>
        <DialogTitle>{t("catalogs.new")}</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        {label(t("catalogs.origin.label"), t("catalogs.origin.fixedHint"))}
        <RadioGroupField label={t("catalogs.origin.label")} variant="cards" value={origin} onValueChange={value => { if (value === "Manual" || value === "Filters") setOrigin(value); }}
          options={[
            { value: "Manual", label: t("catalogs.origin.manual") },
            { value: "Filters", label: t("catalogs.origin.filters"), help: t("catalogs.origin.filtersHint") },
          ]} />
      </div>
      {origin === "Manual" ? <div className="flex flex-col gap-2">
        {label(t("catalogs.valueType.label"), t("catalogs.valueType.fixedHint"))}
        <RadioGroupField label={t("catalogs.valueType.label")} value={valueType} onValueChange={value => { if (isCatalogValueType(value)) setValueType(value); }} options={catalogValueTypes.map(type => ({ value: type, label: t("catalogs.valueTypes." + type) }))} />
      </div> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
        <Button type="button" onClick={() => { onSelect(origin, origin === "Filters" ? "Text" : valueType); onOpenChange(false); }}>{t("catalogs.origin.continue")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
