import { useState, type FormEvent, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { isMenuIconName, menuIconNames, menuIcons, type MenuIconName } from "@/shared/ui/menuIcons";
import { notify } from "@/shared/ui/notifications";
import { Picker } from "@/shared/ui/Picker";
import { folderNameMaxLength, type FormFolder } from "../api/folders";
import { firstFreeIcon } from "../folderTree";
import { useFolderWrites, type FolderScope } from "../hooks/useFormFolders";
import { folderWriteFailure } from "./folderFeedback";

/// What the dialog does: create a folder of the first level (`parent` null) or a subfolder of one, or edit a folder.
export type FolderEditTarget = { readonly kind: "create"; readonly parent: FormFolder | null } | { readonly kind: "edit"; readonly folder: FormFolder };
type Errors = { readonly name?: string; readonly icon?: string };

/// «Nueva carpeta», «Nueva subcarpeta en «Repartos»» and «Editar «Repartos»» (CM2, CM4). A folder of the first level is a menu, so
/// it has a name and one of the twelve icons, which for a new one starts in the first free one; a subfolder has only the name.
/// Enter saves; a repeated name goes under the name, and a folder that someone changed in between keeps what was written and
/// offers to read again. `folders` are the folders the caller shows (the tree or the menu), for the first free icon; the folder
/// being edited comes from them too, so after reading again it saves with its new revision.
export function FolderEditDialog({ scope, folders, target, onSaved, onClose, focusFallback }: {
  scope: FolderScope;
  folders: readonly FormFolder[];
  target: FolderEditTarget;
  onSaved?: (folder: FormFolder) => void;
  onClose: () => void;
  focusFallback?: RefObject<HTMLElement | null>;
}) {
  const { t } = useTranslation("formFolders");
  const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
  const writes = useFolderWrites(scope);
  const editing = target.kind === "edit" ? target.folder : null;
  const topLevel = editing ? editing.parentId === null : target.kind === "create" && target.parent === null;
  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState<MenuIconName>(() => editing?.icon ?? firstFreeIcon(folders));
  const [errors, setErrors] = useState<Errors>({});
  const pending = writes.create.pending || writes.update.pending;
  const title = editing ? t("editDialog.edit", { name: editing.name })
    : target.kind === "create" && target.parent ? t("newSubfolder", { name: target.parent.name }) : t("newFolder");
  const changed = !editing || name.trim() !== editing.name || topLevel && icon !== editing.icon;
  const feedbackId = "form-folders:write";
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || !changed) return;
    const clean = name.trim();
    if (clean === "") { setErrors({ name: t("name.required") }); return; }
    try {
      const saved = editing
        ? await writes.update.run(editing.id, editing.revision, clean, editing.parentId, topLevel ? icon : null)
        : await writes.create.run(target.kind === "create" ? target.parent?.id ?? null : null, clean, topLevel ? icon : null);
      notify({ id: feedbackId, kind: "success", message: t(editing ? "editDialog.done" : "created", { name: saved.name }) });
      onSaved?.(saved);
      onClose();
    } catch (failure) {
      const fields = folderWriteFailure(failure, { t, id: feedbackId, fields: ["name", "icon", "parentId"], reread: () => { void writes.reread(); } });
      // Where it goes is not in this dialog: a problem with it (a folder that became a subfolder in between) goes under the name.
      if (fields) setErrors({ name: fields.name ?? fields.parentId, icon: fields.icon });
    }
  };
  const busyLabel = editing ? t("editDialog.saving") : t("editDialog.creating");
  return (
    <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={restoreFocus} closeDisabledReason={pending ? busyLabel : undefined}>
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form noValidate className="flex flex-col gap-4" onSubmit={event => { void submit(event); }}>
          <FormField label={t("editDialog.name")} error={errors.name}>
            <Input autoFocus value={name} maxLength={folderNameMaxLength} readOnly={pending}
              onChange={event => { setName(event.target.value); setErrors(previous => ({ ...previous, name: undefined })); }} />
          </FormField>
          {/* The icon is the only piece to choose (DS1-A): the drawing of each icon before its name, also in the closed field,
              and the tick on the left (OE1-A). */}
          {topLevel ? (
            <FormField label={t("editDialog.icon")} error={errors.icon}>
              <Picker className="sm:w-56" label={t("editDialog.icon")} value={icon} disabled={pending}
                onChange={value => { if (isMenuIconName(value)) { setIcon(value); setErrors(previous => ({ ...previous, icon: undefined })); } }}
                options={menuIconNames.map(option => {
                  const Icon = menuIcons[option];
                  return { id: option, label: t("icons." + option), icon: <Icon className="size-4" /> };
                })} />
            </FormField>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("common:actions.cancel")}</Button>
            <Button type="submit" disabled={!changed} pending={pending}>
              {pending ? busyLabel : editing ? t("editDialog.save") : t("editDialog.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
