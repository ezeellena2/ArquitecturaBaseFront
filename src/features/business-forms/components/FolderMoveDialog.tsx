import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { notify } from "@/shared/ui/notifications";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import type { FormFolder } from "../api/folders";
import { ancestorIds, folderPath, moveTargets, treeOrder } from "../folderTree";
import { useFolderWrites, type FolderScope } from "../hooks/useFormFolders";
import { folderWriteFailure } from "./folderFeedback";

const top = "top";

/// «Mover a…» (CP3-A): the tree with a radio per folder and «Arriba de todo». The folder itself, its subfolders and the folders
/// where it would go past five levels cannot be chosen, and each says why (MA1-A). Under each name, where that folder lives.
export function FolderMoveDialog({ scope, folders, folder, onClose }: { scope: FolderScope; folders: readonly FormFolder[]; folder: FormFolder; onClose: () => void }) {
  const { t } = useTranslation("formFolders");
  const restoreFocus = useRestoreFocusOnClose();
  const writes = useFolderWrites(scope);
  const initial = folder.parentId ?? top;
  const [target, setTarget] = useState(initial);
  const [error, setError] = useState<string>();
  const allowed = new Set(moveTargets(folders, folder.id).map(entry => entry.id ?? top));
  const inside = (id: string) => id === folder.id || ancestorIds(folders, id).includes(folder.id);
  const options = [{ value: top, label: t("moveDialog.top") }, ...treeOrder(folders).map(({ folder: option, depth }) => ({
    value: option.id, label: option.name,
    description: depth > 1 && option.parentId ? t("moveDialog.inside", { path: folderPath(folders, option.parentId).join(" / ") }) : undefined,
    disabled: !allowed.has(option.id),
    disabledReason: allowed.has(option.id) ? null : inside(option.id) ? t("moveDialog.self") : t("tooDeep"),
  }))];
  const save = async () => {
    try {
      await writes.update.run(folder.id, folder.revision, folder.name, target === top ? null : target);
      notify({ id: "form-folders:write", kind: "success", message: t("moveDialog.done", { name: folder.name }) });
      onClose();
    } catch (failure) {
      const fields = folderWriteFailure(failure, { t, id: "form-folders:write", fields: ["parentId"], reread: () => { void writes.reread(); } });
      if (fields) setError(fields.parentId);
    }
  };
  return (
    <Dialog open onOpenChange={open => { if (!open && !writes.update.pending) onClose(); }}>
      <DialogContent mobileFullscreen aria-describedby={undefined} onCloseAutoFocus={restoreFocus} closeDisabledReason={writes.update.pending ? t("moveDialog.saving") : undefined}>
        <DialogHeader><DialogTitle>{t("moveDialog.title", { name: folder.name })}</DialogTitle></DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RadioGroupField label={t("moveDialog.label")} options={options} value={target} error={error} onValueChange={value => { setTarget(value); setError(undefined); }} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={writes.update.pending} onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" disabled={target === initial} pending={writes.update.pending} onClick={() => { void save(); }}>
            {writes.update.pending ? t("moveDialog.saving") : t("moveDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

