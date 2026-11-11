import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { addFormStandard, type FormStandard } from "../api/library";
import { suggestedPrefix } from "../libraryCopy";

/// A folder the copy can go to, with how deep it is in the tree so the list reads as one.
export interface FormStandardFolderOption {
  readonly id: string;
  readonly name: string;
  readonly depth: number;
}

const prefixPattern = /^[A-Z][A-Z0-9]{0,11}$/;

// BI1-A: «Agregar «Factura»» asks the name, the numbering prefix and the folder (the standard's by default), creates the draft and
// opens the editor. One request id per dialog: trying again after a failure gets the same draft.
export function FormStandardAddDialog({ standard, folders, onOpenChange }: {
  standard: FormStandard;
  /// Without folders to choose from, the copy goes to the standard's.
  folders?: readonly FormStandardFolderOption[];
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("forms");
  const navigate = useNavigate();
  const client = useQueryClient();
  const restoreFocus = useRestoreFocusOnClose();
  const [requestId] = useState(() => crypto.randomUUID());
  const [name, setName] = useState(standard.name);
  const [prefix, setPrefix] = useState(() => suggestedPrefix(standard));
  const [folderId, setFolderId] = useState("");
  const [errors, setErrors] = useState<{ name?: string; prefix?: string; folder?: string }>({});
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const feedbackId = "forms:library:add:" + standard.key;
  useEffect(() => () => { controller.current?.abort(); dismissNotification(feedbackId); }, [feedbackId]);

  async function submit() {
    const local = {
      name: name.trim() ? undefined : t("library.required"),
      prefix: prefixPattern.test(prefix) ? undefined : t("library.prefixInvalid"),
    };
    setErrors(local);
    if (local.name || local.prefix || busy) return;
    const pending = new AbortController();
    controller.current = pending;
    setBusy(true);
    dismissNotification(feedbackId);
    try {
      const created = await addFormStandard(standard, { requestId, name: name.trim(), prefix, ...(folderId ? { folderId } : {}) }, pending.signal);
      if (pending.signal.aborted) return;
      void client.invalidateQueries({ queryKey: ["form-library"] });
      notify({ id: feedbackId + ":success", kind: "success", message: t("library.added", { name: name.trim() }) });
      // Opening the editor leaves the library, and the dialog with it.
      void navigate(`/formularios/${created.definition.id}`);
    } catch (error: unknown) {
      if (pending.signal.aborted || errorFeedback(error).kind === "cancelled") return;
      if (error instanceof ApiError && error.code === "Forms.Folder.NotFound") { setErrors({ folder: t("library.folderGone") }); return; }
      if (error instanceof ApiError && error.status === 400 && error.errors) {
        const fields = Object.entries(error.errors);
        const message = (prefixOf: string) => fields.find(([key]) => key === prefixOf || key.startsWith(prefixOf + "."))?.[1][0];
        const found = { name: message("name"), prefix: message("prefix") };
        if (found.name || found.prefix) { setErrors(found); return; }
      }
      if (error instanceof ApiError && error.code === "Forms.Library.StandardNotFound") {
        notify({ id: feedbackId, kind: "error", message: t("library.unavailable") });
        void client.invalidateQueries({ queryKey: ["form-library"] });
        onOpenChange(false);
        return;
      }
      notify({ id: feedbackId, kind: "error", message: error instanceof ApiError && error.code === "Forms.Library.CatalogUnavailable" ? t("library.catalogUnavailable") : readErrorMessage(error, t) });
    } finally {
      if (!pending.signal.aborted) setBusy(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!busy) onOpenChange(open); }}>
    <DialogContent className="sm:max-w-xl" aria-describedby={undefined} onCloseAutoFocus={restoreFocus}>
      <DialogHeader>
        <DialogTitle>{t("library.addTitle", { name: standard.name })}</DialogTitle>
      </DialogHeader>
      <form className="flex flex-col gap-4" noValidate onSubmit={event => { event.preventDefault(); void submit(); }}>
        <FormField label={t("library.name")} error={errors.name} required>
          <Input value={name} maxLength={120} autoComplete="off" onChange={event => setName(event.target.value)} disabled={busy} />
        </FormField>
        <FormField label={t("library.prefix")} help={t("library.prefixHelp", { example: `${prefix || standard.prefix}-000001` })} error={errors.prefix} required>
          <Input value={prefix} maxLength={12} autoComplete="off" className="uppercase" onChange={event => setPrefix(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} disabled={busy} />
        </FormField>
        {folders && folders.length > 0 ? <FormField label={t("library.folder")} help={t("library.folderHelp")} error={errors.folder}>
          <NativeSelect value={folderId} onChange={event => setFolderId(event.target.value)} disabled={busy}>
            <option value="">{t("library.standardFolder")}</option>
            {folders.map(folder => <option key={folder.id} value={folder.id}>{"  ".repeat(folder.depth) + folder.name}</option>)}
          </NativeSelect>
        </FormField> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{t("common:actions.cancel")}</Button>
          <Button type="submit" disabled={busy}>{busy ? t("library.adding") : t("library.addAction")}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
