import { useMemo, useState, type RefObject } from "react";
import type { FolderMenuAction, FolderMenuContent } from "@/layouts/folderMenuNavigation";
import { FolderDeleteDialog } from "@/features/business-forms/components/FolderDeleteDialog";
import { FolderEditDialog } from "@/features/business-forms/components/FolderEditDialog";
import { FolderFormsDialog } from "@/features/business-forms/components/FolderFormsDialog";
import { FolderMoveDialog } from "@/features/business-forms/components/FolderMoveDialog";
import { menuFolders } from "@/features/business-forms/formMenu";
import { useFolderScope } from "@/features/business-forms/hooks/useFormFolders";

/// The dialog of what the side menu asked for a folder (CM2, CM4), with the folders of the menu: the shell does not know the
/// forms module. The folder is the one the menu has now, so after «Volver a leer» it saves with its new revision; if it leaves
/// the menu while the dialog is open (deleted, or moved into another one), the dialog keeps the last one until it closes. When it
/// closes, the focus goes where the menu says (`returnFocus`, read then): what asked for it or, if it is gone, «Nueva carpeta».
export function FormMenuDialogs({ action, content, returnFocus, onCreated, onClose }: {
  action: FolderMenuAction;
  content: FolderMenuContent;
  returnFocus: RefObject<HTMLElement | null>;
  onCreated: (folderId: string) => void;
  onClose: () => void;
}) {
  const scope = useFolderScope();
  const folders = useMemo(() => menuFolders(content), [content]);
  const id = action.kind === "create" ? null : action.kind === "createSubfolder" ? action.parentId : action.folderId;
  const current = id === null ? undefined : folders.find(folder => folder.id === id);
  const [kept, setKept] = useState(current);
  if (current !== undefined && current !== kept) setKept(current);
  const folder = current ?? kept;
  if (action.kind === "create") {
    return <FolderEditDialog scope={scope} folders={folders} target={{ kind: "create", parent: null }} onSaved={saved => onCreated(saved.id)} onClose={onClose} focusFallback={returnFocus} />;
  }
  if (folder === undefined) return null;
  switch (action.kind) {
    case "createSubfolder":
      return <FolderEditDialog scope={scope} folders={folders} target={{ kind: "create", parent: folder }} onClose={onClose} focusFallback={returnFocus} />;
    case "edit":
      return <FolderEditDialog scope={scope} folders={folders} target={{ kind: "edit", folder }} onClose={onClose} focusFallback={returnFocus} />;
    case "move":
      return <FolderMoveDialog scope={scope} folders={folders} folder={folder} onClose={onClose} focusFallback={returnFocus} />;
    case "delete":
      return <FolderDeleteDialog scope={scope} folders={folders} folder={folder} onClose={onClose} focusFallback={returnFocus} />;
    case "addForms":
      return <FolderFormsDialog scope={scope} folder={{ id: folder.id, name: folder.name }} onClose={onClose} focusFallback={returnFocus} />;
  }
}
