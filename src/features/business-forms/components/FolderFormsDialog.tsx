import { useEffect, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { notify } from "@/shared/ui/notifications";
import { Picker } from "@/shared/ui/Picker";
import { Skeleton } from "@/shared/ui/skeleton";
import { administrativeName } from "../editorModel";
import { useFolderFormChoices, useFolderForms, type FolderScope } from "../hooks/useFormFolders";
import { folderWriteFailure } from "./folderFeedback";

type Marks = { readonly added: ReadonlySet<string>; readonly removed: ReadonlySet<string> };
const noMarks: Marks = { added: new Set(), removed: new Set() };

/// «Formularios de «Compras»» (CM2, DS1-A): the forms are chosen with the shared piece, several at a time, among those that are
/// not deactivated; those already in the folder go first and a draft says «Borrador» in grey. It reads every page of them when it
/// opens, so the piece searches among all and its button names the chosen ones. What is marked and unmarked is kept apart from
/// the set that was read, and it saves that set plus the marked minus the unmarked: the deactivated forms, which it does not list,
/// stay where they were. If someone changed the set in between, what was marked stays and the notice offers to read again. It
/// saves the forms right in the folder, not those of its subfolders.
export function FolderFormsDialog({ scope, folder, onClose, focusFallback }: {
  scope: FolderScope;
  folder: { readonly id: string; readonly name: string };
  onClose: () => void;
  focusFallback?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation("formFolders");
  const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
  const { query, save } = useFolderForms(scope, folder.id);
  const choices = useFolderFormChoices(scope, "");
  const { hasNextPage, isFetchingNextPage, isError: choicesFailed, fetchNextPage } = choices;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !choicesFailed) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, choicesFailed, fetchNextPage]);
  const [marks, setMarks] = useState<Marks>(noMarks);
  // The order is the one of the opening: marking does not move a form while the dialog is open.
  const [first, setFirst] = useState<ReadonlySet<string> | null>(null);
  if (first === null && query.data) setFirst(new Set(query.data.formIds));
  const read = new Set(query.data?.formIds ?? []);
  const formIds = [...new Set([...[...read].filter(id => !marks.removed.has(id)), ...marks.added])];
  const changed = formIds.length !== read.size || formIds.some(id => !read.has(id));
  const items = choices.data?.pages.flatMap(page => page.items) ?? [];
  const listed = new Set(items.map(item => item.id));
  const ordered = first ? [...items.filter(item => first.has(item.id)), ...items.filter(item => !first.has(item.id))] : items;
  const choose = (next: readonly string[]) => {
    const chosen = new Set(next);
    setMarks({ added: new Set(next.filter(id => !read.has(id))), removed: new Set([...read].filter(id => listed.has(id) && !chosen.has(id))) });
  };
  const failed = !query.data && query.isError || !choices.data && choices.isError || choices.isFetchNextPageError;
  const loading = !failed && (query.isPending || choices.isPending || hasNextPage === true);
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
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={restoreFocus} closeDisabledReason={pending ? t("formsDialog.saving") : undefined}>
        <DialogHeader><DialogTitle>{t("formsDialog.title", { name: folder.name })}</DialogTitle></DialogHeader>
        {loading ? (
          <div role="status" aria-label={t("formsDialog.loading")} className="flex flex-col gap-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-[var(--height-control)] w-full" /></div>
        ) : failed ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-[var(--color-content-muted)]">{t("formsDialog.loadFailed")}</p>
            <Button type="button" variant="outline" size="sm" pending={query.isFetching || choices.isFetching} onClick={retry}>
              {query.isFetching || choices.isFetching ? t("retrying") : t("common:actions.retry")}
            </Button>
          </div>
        ) : (
          <FormField label={t("formsDialog.forms")}>
            <Picker multiple label={t("formsDialog.forms")} placeholder={t("formsDialog.none")} disabled={pending} value={formIds.filter(id => listed.has(id))} onChange={choose}
              options={ordered.map(item => ({ id: item.id, label: administrativeName(item.name, scope.culture), description: item.activeVersionNumber === null ? t("formsDialog.draft") : null }))} />
          </FormField>
        )}
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
