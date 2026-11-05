import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { notify } from "@/shared/ui/notifications";
import { Textarea } from "@/shared/ui/textarea";
import { voidFormRecord } from "../api/entries";

const maxReason = 500;

/**
 * Voiding a response (CW11-A): what happens, the required reason and «Anular respuesta». It is not undone: if it was a
 * mistake, it is loaded again. The owner closes the dialog and reads the sheet again when it succeeds.
 */
export function VoidResponseDialog({ formId, recordId, number, owner, onClose, onVoided }: {
  formId: string; recordId: string; number: string; owner: string; onClose: () => void; onVoided: () => void;
}) {
  const { t } = useTranslation("forms");
  const id = useId();
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const trimmed = reason.trim();
  const problem = !trimmed ? t("formEntries:correction.reasonRequired") : trimmed.length > maxReason ? t("formEntries:correction.reasonTooLong") : null;
  const confirm = async () => {
    setAttempted(true);
    if (problem || pending) { document.getElementById(id)?.focus(); return; }
    setPending(true);
    try {
      await voidFormRecord(formId, recordId, trimmed);
      notify({ id: `responses:void:${owner}:${recordId}`, kind: "success", message: t("detail.voided", { number }) });
      onVoided();
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      notify({ id: `responses:void:${owner}:${recordId}`, kind: "error", message: t("detail.voidFailed", { number }), description: readErrorMessage(error, t) });
      setPending(false);
    }
  };
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}>
    <DialogContent closeDisabledReason={pending ? t("detail.voiding") : undefined}>
      <DialogHeader>
        <DialogTitle>{t("detail.voidTitle", { number })}</DialogTitle>
        <DialogDescription>{t("detail.voidDescription", { number })}</DialogDescription>
      </DialogHeader>
      <FormField label={t("detail.voidReason")} htmlFor={id} required error={attempted && problem ? problem : undefined}>
        <Textarea id={id} value={reason} rows={2} maxLength={maxReason} disabled={pending} onChange={event => setReason(event.target.value)}/>
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t("common:actions.cancel")}</Button>
        <Button type="button" variant="destructive-outline" pending={pending} onClick={() => void confirm()}>{pending ? t("detail.voiding") : t("detail.voidConfirm")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
