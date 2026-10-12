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
  onSelect: (origin: EditableCatalogOrigin) => void;
}) {
  const { t } = useTranslation("forms");
  const restoreFocus = useRestoreFocusOnClose();
  const [origin, setOrigin] = useState<EditableCatalogOrigin>("Manual");
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
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
        <Button type="button" onClick={() => { onSelect(origin); onOpenChange(false); }}>{t("catalogs.origin.continue")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
