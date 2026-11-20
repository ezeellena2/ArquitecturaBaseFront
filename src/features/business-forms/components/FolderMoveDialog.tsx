import { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { notify } from "@/shared/ui/notifications";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import type { FormFolder } from "../api/folders";
import { hasSubfolders } from "../folderTree";
import { useFolderWrites, type FolderScope } from "../hooks/useFormFolders";
import { folderWriteFailure } from "./folderFeedback";

const toMenu = "menu";

/// «Mover a…» (CM4): «Al menú, como carpeta propia» or «Adentro de «Compras»» for each other folder of the first level, starting
/// where the folder is. A folder with subfolders cannot go into another, so those options stay off with the reason (MA1-A). The
/// folder that goes into another loses its icon and the one that comes up to the menu takes the first free one: it goes without
/// an icon and the server decides.
export function FolderMoveDialog({ scope, folders, folder, onClose, focusFallback }: {
  scope: FolderScope;
  folders: readonly FormFolder[];
  folder: FormFolder;
  onClose: () => void;
  focusFallback?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation("formFolders");
  const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
  const writes = useFolderWrites(scope);
  const initial = folder.parentId ?? toMenu;
  const [target, setTarget] = useState(initial);
  const [error, setError] = useState<string>();
  const nested = hasSubfolders(folders, folder.id);
  const options = [{ value: toMenu, label: t("moveDialog.toMenu") }, ...folders.filter(option => option.parentId === null && option.id !== folder.id).map(option => ({
    value: option.id, label: t("moveDialog.into", { name: option.name }), disabled: nested, disabledReason: nested ? t("hasSubfolders") : null,
  }))];
  const pending = writes.update.pending;
  const save = async () => {
    try {
      await writes.update.run(folder.id, folder.revision, folder.name, target === toMenu ? null : target, null);
      notify({ id: "form-folders:write", kind: "success", message: t("moveDialog.done", { name: folder.name }) });
      onClose();
    } catch (failure) {
      const fields = folderWriteFailure(failure, { t, id: "form-folders:write", fields: ["parentId"], reread: () => { void writes.reread(); } });
      if (fields) setError(fields.parentId);
    }
  };
  return (
    <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
      <DialogContent mobileFullscreen aria-describedby={undefined} onCloseAutoFocus={restoreFocus} closeDisabledReason={pending ? t("moveDialog.saving") : undefined}>
        <DialogHeader><DialogTitle>{t("moveDialog.title", { name: folder.name })}</DialogTitle></DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RadioGroupField label={t("moveDialog.label")} options={options} value={target} error={error} onValueChange={value => { setTarget(value); setError(undefined); }} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" disabled={target === initial} pending={pending} onClick={() => { void save(); }}>
            {pending ? t("moveDialog.saving") : t("moveDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
