import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

export function CatalogStateAction({ isActive, disabled, onChange }: {
  isActive: boolean; disabled: boolean; onChange: (isActive: boolean) => void;
}) {
  const { t } = useTranslation("forms");
  const [open, setOpen] = useState(false);
  const action = t(isActive ? "catalogs.lifecycle.deactivate" : "catalogs.lifecycle.reactivate");
  return <>
    <Button variant="outline" disabled={disabled} onClick={() => setOpen(true)}>{action}</Button>
    <ConfirmDialog open={open} onOpenChange={setOpen} title={action}
      description={t(isActive ? "catalogs.lifecycle.deactivateHint" : "catalogs.lifecycle.reactivateHint")}
      confirmLabel={action} destructive={isActive} onConfirm={() => { if (!disabled) onChange(!isActive); }} />
  </>;
}
