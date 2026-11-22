import { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { PlusIcon } from "@/shared/ui/icons";
import { notify } from "@/shared/ui/notifications";
import { Picker } from "@/shared/ui/Picker";
import { Skeleton } from "@/shared/ui/skeleton";
import type { FolderItemKind } from "../api/folders";
import { folderPath, treeOrder } from "../folderTree";
import { useFolderScope, useFolderTree, useItemFolders } from "../hooks/useFormFolders";
import { FolderEditDialog } from "./FolderEditDialog";
import { folderWriteFailure } from "./folderFeedback";

/// «Carpetas…» of a form or a catalog (CP2-A, CM3, DS1-A): the folders are chosen with the shared piece, several at a time, the
/// two levels with each subfolder under its folder and saying where it lives; «Nueva carpeta» for whoever administers forms opens
/// «Nueva carpeta» and leaves the new folder chosen, and «Guardar». Choosing none leaves it without a folder. It saves the whole set with the one it read; if someone changed it in between, what is ticked stays and the notice
/// offers to read again. Opened from an item of a ⋮, `focusFallback` is where the focus goes back, because the item is gone when
/// the dialog closes.
export function ItemFoldersDialog({ kind, id, name, onClose, focusFallback }: { kind: FolderItemKind; id: string; name: string; onClose: () => void; focusFallback?: RefObject<HTMLElement | null> }) {
  const { t } = useTranslation("formFolders");
  const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
  const scope = useFolderScope();
  const tree = useFolderTree(scope, kind === "definitions" ? "designs" : "catalogs");
  const { query, save } = useItemFolders(scope, kind, id);
  const [draft, setDraft] = useState<ReadonlySet<string> | null>(null);
  const [creating, setCreating] = useState(false);
  if (draft === null && query.data) setDraft(new Set(query.data.folderIds));
  const folders = tree.data?.folders ?? [];
  const known = new Set(folders.map(folder => folder.id));
  const expected = query.data?.folderIds ?? [];
  const chosen = draft ? [...draft].filter(folderId => known.has(folderId)) : [];
  const changed = draft !== null && (chosen.length !== expected.length || chosen.some(folderId => !expected.includes(folderId)));
  const loading = (tree.isPending || query.isPending) && !(tree.isError || query.isError);
  const failed = !tree.data && tree.isError || !query.data && query.isError;
  const feedbackId = `form-folders:item:${kind}:${id}`;
  const toggle = (folderId: string, checked: boolean) => setDraft(previous => {
    const next = new Set(previous);
    if (checked) next.add(folderId); else next.delete(folderId);
    return next;
  });
  const submit = async () => {
    try {
      await save.run(expected, chosen);
      notify({ id: feedbackId, kind: "success", message: t("item.done", { name }) });
      onClose();
    } catch (error) {
      folderWriteFailure(error, { t, id: feedbackId, fields: [], reread: () => { void query.refetch(); void tree.refetch(); } });
    }
  };
  const pending = save.pending;
  return (
    <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={restoreFocus} closeDisabledReason={pending ? t("item.saving") : undefined}>
        <DialogHeader><DialogTitle>{t("item.title", { name })}</DialogTitle></DialogHeader>
        <div className="flex flex-col items-start gap-3">
          {loading ? (
            <div role="status" aria-label={t("item.loading")} className="flex w-full flex-col gap-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-[var(--height-control)] w-full" /></div>
          ) : failed ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-[var(--color-content-muted)]">{t("item.loadFailed")}</p>
              <Button type="button" variant="outline" size="sm" pending={tree.isFetching || query.isFetching} onClick={() => { void tree.refetch(); void query.refetch(); }}>
                {tree.isFetching || query.isFetching ? t("retrying") : t("common:actions.retry")}
              </Button>
            </div>
          ) : (
            <>
              {folders.length === 0 ? <p className="text-sm text-[var(--color-content-muted)]">{t("item.empty")}</p> : (
                <div className="w-full"><FormField label={t("item.folders")}>
                  {/* A subfolder goes under its folder and says where it lives, so two with the same name read differently (premise 5.3). */}
                  <Picker multiple label={t("item.folders")} placeholder={t("item.none")} disabled={pending} value={chosen} onChange={next => setDraft(new Set(next))}
                    options={treeOrder(folders).map(({ folder, depth }) => ({ id: folder.id, label: folder.name, depth: depth - 1,
                      description: depth > 1 && folder.parentId ? t("moveDialog.inside", { path: folderPath(folders, folder.parentId).join(" / ") }) : null }))} />
                </FormField></div>
              )}
              {tree.data?.canManage ? (
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setCreating(true)}><PlusIcon className="size-3.5" aria-hidden="true" />{t("newFolder")}</Button>
              ) : null}
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" disabled={!changed} pending={pending} onClick={() => { void submit(); }}>
            {pending ? t("item.saving") : t("item.save")}
          </Button>
        </DialogFooter>
        {creating ? <FolderEditDialog scope={scope} folders={folders} target={{ kind: "create", parent: null }} onSaved={folder => toggle(folder.id, true)} onClose={() => setCreating(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
