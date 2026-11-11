import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { isMenuIconName, menuIconNames, menuIcons, type MenuIconName } from "@/shared/ui/menuIcons";
import { notify } from "@/shared/ui/notifications";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { menuPlacements, type FormFolder, type MenuPlacement } from "../api/folders";
import { useFolderWrites, type FolderScope } from "../hooks/useFormFolders";
import { folderWriteFailure } from "./folderFeedback";

const isPlacement = (value: string): value is MenuPlacement => (menuPlacements as readonly string[]).includes(value);

/// «En el menú…» (CP5-A, 2026-11-04): out of the menu, a menu of its own, or a group inside «Gestión de formularios» or
/// «Administración». A menu of its own also takes one of the twelve icons, the folder by default; its (i) says it is what shows
/// with the menu collapsed. It saves with «Guardar».
export function FolderMenuDialog({ scope, folder, onClose }: { scope: FolderScope; folder: FormFolder; onClose: () => void }) {
  const { t } = useTranslation("formFolders");
  const restoreFocus = useRestoreFocusOnClose();
  const writes = useFolderWrites(scope);
  const [placement, setPlacement] = useState<MenuPlacement>(folder.menuPlacement);
  const [icon, setIcon] = useState<MenuIconName>(folder.menuIcon ?? "folder");
  const [error, setError] = useState<string>();
  const changed = placement !== folder.menuPlacement || placement === "Own" && icon !== folder.menuIcon;
  const pending = writes.menu.pending;
  const save = async () => {
    try {
      await writes.menu.run(folder.id, folder.revision, placement, placement === "Own" ? icon : null);
      notify({ id: "form-folders:write", kind: "success", message: t("menuDialog.done", { name: folder.name }) });
      onClose();
    } catch (failure) {
      const fields = folderWriteFailure(failure, { t, id: "form-folders:write", fields: ["icon"], reread: () => { void writes.reread(); } });
      if (fields) setError(fields.icon);
    }
  };
  return (
    <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={restoreFocus} closeDisabledReason={pending ? t("menuDialog.saving") : undefined}>
        <DialogHeader><DialogTitle>{t("menuDialog.title", { name: folder.name })}</DialogTitle></DialogHeader>
        <RadioGroupField label={t("menuDialog.placement")} options={menuPlacements.map(value => ({ value, label: t("menuDialog.placements." + value) }))}
          value={placement} onValueChange={value => { if (isPlacement(value)) setPlacement(value); }} />
        {placement === "Own" ? (
          <Select value={icon} onValueChange={value => { if (isMenuIconName(value)) { setIcon(value); setError(undefined); } }}>
            <FormField label={t("menuDialog.icon")} help={t("menuDialog.iconHelp")} error={error}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            </FormField>
            <SelectContent>
              {menuIconNames.map(name => {
                const Icon = menuIcons[name];
                return <SelectItem key={name} value={name}><Icon className="size-4" />{t("icons." + name)}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" disabled={!changed} pending={pending} onClick={() => { void save(); }}>
            {pending ? t("menuDialog.saving") : t("menuDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
