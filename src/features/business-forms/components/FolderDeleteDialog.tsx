import { useId, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { notify } from "@/shared/ui/notifications";
import { Skeleton } from "@/shared/ui/skeleton";
import type { FormFolder } from "../api/folders";
import { useFolderDeletion, useFolderWrites, type FolderScope } from "../hooks/useFormFolders";
import { deletionSentences, folderWriteFailure } from "./folderFeedback";

/// «Borrar» (CM4): reads what the folder has before asking, says where it leaves (the menu, or its folder) and what is lost, and
/// deletes with the revision it read. A folder that changed in between asks to read again, without deleting.
export function FolderDeleteDialog({ scope, folders, folder, onClose, focusFallback }: {
  scope: FolderScope;
  folders: readonly FormFolder[];
  folder: FormFolder;
  onClose: () => void;
  focusFallback?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation("formFolders");
  const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
  const descriptionId = useId();
  const counts = useFolderDeletion(scope, folder.id);
  const writes = useFolderWrites(scope);
  const pending = writes.remove.pending;
  const parentName = folder.parentId === null ? null : folders.find(parent => parent.id === folder.parentId)?.name ?? "";
  const confirm = async () => {
    if (!counts.data) return;
    try {
      await writes.remove.run(folder.id, counts.data.revision);
      notify({ id: "form-folders:write", kind: "success", message: t("deleteDialog.done", { name: folder.name }) });
      onClose();
    } catch (error) {
      folderWriteFailure(error, { t, id: "form-folders:write", fields: [], reread: () => { void counts.refetch(); void writes.reread(); } });
    }
  };
  return (
    <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
      <DialogContent aria-describedby={descriptionId} onCloseAutoFocus={restoreFocus} closeDisabledReason={pending ? t("deleteDialog.pending") : undefined}>
        <DialogHeader><DialogTitle>{t("deleteDialog.title", { name: folder.name })}</DialogTitle></DialogHeader>
        <div id={descriptionId} className="flex flex-col gap-1 text-sm">
          {counts.data ? <p>{deletionSentences(counts.data, parentName, t).join(" ")}</p>
            : counts.isError ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-[var(--color-content-muted)]">{t("deleteDialog.loadFailed")}</p>
                <Button type="button" variant="outline" size="sm" pending={counts.isFetching} onClick={() => { void counts.refetch(); }}>
                  {counts.isFetching ? t("retrying") : t("common:actions.retry")}
                </Button>
              </div>
            ) : <div aria-hidden="true" className="flex flex-col gap-1.5"><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-3/5" /></div>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" variant="destructive" disabled={!counts.data} pending={pending} onClick={() => { void confirm(); }}>
            {pending ? t("deleteDialog.pending") : t("deleteDialog.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
