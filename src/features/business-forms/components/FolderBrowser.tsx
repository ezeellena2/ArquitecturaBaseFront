import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActionsMenu } from "@/shared/ui/ActionsMenu";
import { Button } from "@/shared/ui/button";
import { IconButton } from "@/shared/ui/IconButton";
import { PlusIcon } from "@/shared/ui/icons";
import { notify } from "@/shared/ui/notifications";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { TreeList, type TreeListItem } from "@/shared/ui/TreeList";
import type { FormFolder } from "../api/folders";
import { ancestorIds, canAddSubfolder, treeOrder } from "../folderTree";
import { useFolderWrites, type ListingFolders } from "../hooks/useFormFolders";
import { folderWriteFailure } from "./folderFeedback";
import { FolderDeleteDialog } from "./FolderDeleteDialog";
import { FolderMenuDialog } from "./FolderMenuDialog";
import { FolderMoveDialog } from "./FolderMoveDialog";
import { FolderNameEditor } from "./FolderNameEditor";

type Editing = { readonly mode: "add"; readonly parentId: string | null; readonly error?: string } | { readonly mode: "rename"; readonly folder: FormFolder; readonly error?: string };
type FolderDialog = { readonly kind: "move" | "menu" | "delete"; readonly folderId: string };

/// The folders of a listing (CP1-A) with their administration in the same place (CP3-A): «Todos», «Sin carpeta» and the tree,
/// with the + and the «…» of each folder for whoever administers them. As the panel it is a `Surface` with the + in its band;
/// in the phone's sheet the same list goes alone and choosing closes it.
export function FolderBrowser({ folders, variant, onChosen }: { folders: ListingFolders; variant: "panel" | "sheet"; onChosen?: () => void }) {
  const { t } = useTranslation("formFolders");
  const { scope, tree, selection, select } = folders;
  const writes = useFolderWrites(scope);
  const all = tree.data?.folders ?? [];
  const canManage = tree.data?.canManage === true;
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dialog, setDialog] = useState<FolderDialog | null>(null);
  // An action that leaves the focus in a field (adding, renaming) keeps the «…» menu from taking it back on closing.
  const keepFocus = useRef(false);
  const firstEntry = useRef<HTMLDivElement>(null);
  // When a name stops being edited, the focus goes to that folder's row, or to the + after cancelling a folder at the top
  // (premise 5.8): never to the page.
  const host = useRef<HTMLDivElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef<string | null>(null);
  useEffect(() => {
    if (editing || focusAfter.current === null) return;
    const row = host.current?.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(focusAfter.current)}"]`);
    (row ?? addButton.current ?? firstEntry.current)?.focus();
    focusAfter.current = null;
  }, [editing, tree.data]);
  const stopEditing = (focus: string | null) => { focusAfter.current = focus ?? "add"; setEditing(null); };
  const opened = new Set(selection.kind === "folder" ? ancestorIds(all, selection.id) : []);
  const isExpanded = (id: string) => overrides.get(id) ?? opened.has(id);
  const expand = (id: string) => setOverrides(previous => new Map(previous).set(id, true));
  const feedbackId = "form-folders:write";

  const submitName = async (name: string) => {
    if (!editing) return;
    const clean = name.trim();
    if (clean === "") { setEditing({ ...editing, error: t("name.required") }); return; }
    if (editing.mode === "rename" && clean === editing.folder.name) { stopEditing(editing.folder.id); return; }
    try {
      if (editing.mode === "add") {
        const created = await writes.create.run(editing.parentId, clean);
        notify({ id: feedbackId, kind: "success", message: t("created", { name: clean }) });
        stopEditing(created.id);
      } else {
        // The tree read last has the revision: after «Volver a leer», saving again goes with it.
        const latest = all.find(folder => folder.id === editing.folder.id) ?? editing.folder;
        await writes.update.run(latest.id, latest.revision, clean, latest.parentId);
        notify({ id: feedbackId, kind: "success", message: t("renamed", { name: clean }) });
        stopEditing(latest.id);
      }
    } catch (error) {
      const fields = folderWriteFailure(error, { t, id: feedbackId, fields: ["name", "parentId"], reread: () => { void writes.reread(); } });
      if (fields) setEditing({ ...editing, error: fields.name ?? fields.parentId });
    }
  };
  const editor = (label: string, initial?: string) => editing
    ? <FolderNameEditor label={label} initial={initial} pending={writes.create.pending || writes.update.pending} error={editing.error}
      onSubmit={name => { void submitName(name); }} onCancel={() => stopEditing(editing.mode === "rename" ? editing.folder.id : editing.parentId)} />
    : null;
  const startAdd = (parentId: string | null) => {
    keepFocus.current = true;
    if (parentId) expand(parentId);
    setEditing({ mode: "add", parentId });
  };

  const actions = (folder: FormFolder): ReactNode => canManage ? (
    <ActionsMenu label={t("actions", { name: folder.name })} onCloseAutoFocus={event => { if (keepFocus.current) { event.preventDefault(); keepFocus.current = false; } }} items={[
      { label: t("addSubfolder"), reason: canAddSubfolder(all, folder.id) ? null : t("tooDeep"), onSelect: () => startAdd(folder.id) },
      { label: t("rename"), onSelect: () => { keepFocus.current = true; setEditing({ mode: "rename", folder }); } },
      { label: t("move"), onSelect: () => setDialog({ kind: "move", folderId: folder.id }) },
      { label: t("menu"), onSelect: () => setDialog({ kind: "menu", folderId: folder.id }) },
      { label: t("delete"), destructive: true, onSelect: () => setDialog({ kind: "delete", folderId: folder.id }) },
    ]} />
  ) : null;

  // The visible rows in the order of the tree: what is below a folded folder does not show.
  const rows: TreeListItem[] = [];
  const newRow = (level: number): TreeListItem => ({ id: "new-folder", label: t("name.new"), level, editor: editor(t("name.new")) });
  if (editing?.mode === "add" && editing.parentId === null) rows.push(newRow(1));
  let foldedAt: number | null = null;
  for (const entry of treeOrder(all)) {
    if (foldedAt !== null && entry.depth > foldedAt) continue;
    foldedAt = null;
    const { folder } = entry;
    const expanded = entry.hasChildren || (editing?.mode === "add" && editing.parentId === folder.id) ? isExpanded(folder.id) : undefined;
    rows.push({ id: folder.id, label: folder.name, level: entry.depth, expanded, selected: selection.kind === "folder" && selection.id === folder.id,
      actions: actions(folder), editor: editing?.mode === "rename" && editing.folder.id === folder.id ? editor(t("name.rename", { name: folder.name }), folder.name) : undefined });
    if (editing?.mode === "add" && editing.parentId === folder.id && expanded) rows.push(newRow(entry.depth + 1));
    if (expanded === false) foldedAt = entry.depth;
  }
  const items: TreeListItem[] = [
    { id: "all", label: t("all"), level: 0, selected: selection.kind === "all" },
    { id: "none", label: t("withoutFolder"), level: 0, selected: selection.kind === "none" },
    ...(tree.data ? rows : []),
  ];
  const choose = (id: string) => {
    select(id === "all" ? { kind: "all" } : id === "none" ? { kind: "none" } : { kind: "folder", id });
    onChosen?.();
  };
  const toggle = (id: string) => setOverrides(previous => new Map(previous).set(id, !isExpanded(id)));

  const body = (
    <div ref={firstEntry} tabIndex={-1} className={variant === "panel" ? "flex flex-col gap-2 p-2 outline-none" : "flex flex-col gap-2 outline-none"}>
      <TreeList label={t("title")} items={items} onSelect={choose} onToggle={toggle} />
      {tree.isPending && tree.fetchStatus !== "idle" ? (
        <div aria-hidden="true" className="flex flex-col gap-1 pl-6">
          <Skeleton className="h-6" /><Skeleton className="h-6" /><Skeleton className="h-6" />
        </div>
      ) : tree.isError && !tree.data ? (
        <div className="flex flex-col items-start gap-2 px-2 py-1">
          <p className="text-sm text-[var(--color-content-muted)]">{t("loadFailed")}</p>
          <Button type="button" variant="outline" size="sm" pending={tree.isFetching} onClick={() => { void tree.refetch(); }}>
            {tree.isFetching ? t("retrying") : t("common:actions.retry")}
          </Button>
        </div>
      ) : canManage && (all.length === 0 || variant === "sheet") && editing?.mode !== "add" ? (
        <div className="px-1">
          <Button ref={variant === "sheet" ? addButton : undefined} type="button" variant="outline" size="sm" onClick={() => startAdd(null)}><PlusIcon className="size-3.5" aria-hidden="true" />{t("add")}</Button>
        </div>
      ) : null}
    </div>
  );
  const current = dialog ? all.find(folder => folder.id === dialog.folderId) : undefined;
  const dialogs = current && dialog ? (
    dialog.kind === "move" ? <FolderMoveDialog key={current.id} scope={scope} folders={all} folder={current} onClose={() => setDialog(null)} />
      : dialog.kind === "menu" ? <FolderMenuDialog key={current.id} scope={scope} folder={current} onClose={() => setDialog(null)} />
      : <FolderDeleteDialog key={current.id} scope={scope} folders={all} folder={current} selection={selection} onDeleted={inside => { if (inside) select({ kind: "all" }); }} onClose={() => setDialog(null)} focusFallback={firstEntry} />
  ) : null;

  return (
    <>
      {variant === "panel" ? (
        <div ref={host}><Surface title={t("title")} actions={canManage ? <IconButton ref={addButton} size="icon-sm" label={t("add")} onClick={() => startAdd(null)}><PlusIcon className="size-4" /></IconButton> : undefined}>
          {body}
        </Surface></div>
      ) : <div ref={host}>{body}</div>}
      {dialogs}
    </>
  );
}
