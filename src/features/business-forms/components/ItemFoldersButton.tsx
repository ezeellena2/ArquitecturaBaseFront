import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import type { FolderItemKind } from "../api/folders";
import { ItemFoldersDialog } from "./ItemFoldersDialog";

/// «Carpetas…» in the header of a saved form or catalog (CP2-A): opens the same dialog as the row menu of its listing.
export function ItemFoldersButton({ kind, id, name, disabled = false }: { kind: FolderItemKind; id: string; name: string; disabled?: boolean }) {
  const { t } = useTranslation("formFolders");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(true)}>{t("item.action")}</Button>
      {open ? <ItemFoldersDialog kind={kind} id={id} name={name} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
