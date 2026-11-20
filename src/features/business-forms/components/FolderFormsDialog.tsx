import { useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { notify } from "@/shared/ui/notifications";
import { SearchInput } from "@/shared/ui/SearchInput";
import { Skeleton } from "@/shared/ui/skeleton";
import { administrativeName } from "../editorModel";
import { useFolderFormChoices, useFolderForms, type FolderScope } from "../hooks/useFormFolders";
import { folderWriteFailure } from "./folderFeedback";

type Marks = { readonly added: ReadonlySet<string>; readonly removed: ReadonlySet<string> };
const noMarks: Marks = { added: new Set(), removed: new Set() };

/// «Formularios de «Compras»» (CM2): a search and a box per form that is not deactivated, those already in the folder first and
/// a draft with its «Borrador» tag. What is ticked and unticked is kept apart from the set that was read, and it saves that set
/// plus the ticked minus the unticked: the deactivated forms, which it does not list, stay where they were. If someone changed
/// the set in between, what was marked stays and the notice offers to read again. It saves the forms right in the folder, not
/// those of its subfolders.
export function FolderFormsDialog({ scope, folder, onClose, focusFallback }: {
  scope: FolderScope;
  folder: { readonly id: string; readonly name: string };
  onClose: () => void;
  focusFallback?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation("formFolders");
  const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
  const { query, save } = useFolderForms(scope, folder.id);
  const [search, setSearch] = useState("");
  const choices = useFolderFormChoices(scope, search);
  const [marks, setMarks] = useState<Marks>(noMarks);
  // The order is the one of the opening: ticking does not move a form while the dialog is open.
  const [first, setFirst] = useState<ReadonlySet<string> | null>(null);
  if (first === null && query.data) setFirst(new Set(query.data.formIds));
  const read = new Set(query.data?.formIds ?? []);
  const isChecked = (id: string) => marks.added.has(id) || read.has(id) && !marks.removed.has(id);
  const formIds = [...new Set([...[...read].filter(id => !marks.removed.has(id)), ...marks.added])];
  const changed = formIds.length !== read.size || formIds.some(id => !read.has(id));
  const toggle = (id: string, checked: boolean) => setMarks(previous => {
    const added = new Set(previous.added);
    const removed = new Set(previous.removed);
    if (checked) { removed.delete(id); if (!read.has(id)) added.add(id); } else { added.delete(id); if (read.has(id)) removed.add(id); }
    return { added, removed };
  });
  const items = choices.data?.pages.flatMap(page => page.items) ?? [];
  const ordered = first ? [...items.filter(item => first.has(item.id)), ...items.filter(item => !first.has(item.id))] : items;
  const loading = (query.isPending || choices.isPending) && !(query.isError || choices.isError);
  const failed = !query.data && query.isError || !choices.data && choices.isError;
  const pending = save.pending;
  const feedbackId = `form-folders:forms:${folder.id}`;
  const submit = async () => {
    if (!query.data) return;
    try {
      await save.run(query.data.formIds, formIds);
      notify({ id: feedbackId, kind: "success", message: t("formsDialog.done", { name: folder.name }) });
      onClose();
    } catch (error) {
      folderWriteFailure(error, { t, id: feedbackId, fields: [], reread: () => { void query.refetch(); } });
    }
  };
  const retry = () => { void query.refetch(); void choices.refetch(); };
  return (
    <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
      <DialogContent mobileFullscreen aria-describedby={undefined} onCloseAutoFocus={restoreFocus} closeDisabledReason={pending ? t("formsDialog.saving") : undefined}>
        <DialogHeader><DialogTitle>{t("formsDialog.title", { name: folder.name })}</DialogTitle></DialogHeader>
        <SearchInput value={search} onChange={setSearch} label={t("formsDialog.search")} />
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {loading ? (
            <div aria-hidden="true" className="flex flex-col gap-2"><Skeleton className="h-5 w-3/5" /><Skeleton className="h-5 w-2/5" /><Skeleton className="h-5 w-1/2" /></div>
          ) : failed ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-[var(--color-content-muted)]">{t("formsDialog.loadFailed")}</p>
              <Button type="button" variant="outline" size="sm" pending={query.isFetching || choices.isFetching} onClick={retry}>
                {query.isFetching || choices.isFetching ? t("retrying") : t("common:actions.retry")}
              </Button>
            </div>
          ) : ordered.length === 0 ? (
            <p className="text-sm text-[var(--color-content-muted)]">{search ? t("formsDialog.noMatches") : t("formsDialog.empty")}</p>
          ) : (
            <>
              {ordered.map(item => (
                <CheckboxField key={item.id} label={administrativeName(item.name, scope.culture)} tag={item.activeVersionNumber === null ? t("formsDialog.draft") : undefined}
                  checked={isChecked(item.id)} disabled={pending} onCheckedChange={checked => toggle(item.id, checked)} />
              ))}
              {choices.hasNextPage ? (
                <div className="pt-1">
                  <Button type="button" variant="outline" size="sm" pending={choices.isFetchingNextPage} onClick={() => { void choices.fetchNextPage(); }}>
                    {choices.isFetchingNextPage ? t("formsDialog.loadingMore") : t("formsDialog.more")}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" disabled={!changed} pending={pending} onClick={() => { void submit(); }}>
            {pending ? t("formsDialog.saving") : t("formsDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
