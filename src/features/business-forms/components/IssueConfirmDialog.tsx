import { useTranslation } from "react-i18next";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import type { FormIssuePreview } from "../api/entries";
import { IssueSummary } from "./IssueSummary";

/**
 * «¿Emitimos la factura?» (EM2-A, with the amounts of IV3): what the issuer decided, the (i) with why, the receiver, the date, the
 * amounts it itemizes and the total, as «Esperando que lo confirmes» reads them (`IssueSummary`). «Volver» keeps the answers;
 * «Emitir factura» sends as always. If the issuer could not take it, its message with «Volver a probar».
 */
export function IssueConfirmDialog({ preview, sending, retrying, retryWait = 0, onConfirm, onRetry, onClose }: {
  preview: FormIssuePreview | null; sending: boolean; retrying: boolean; retryWait?: number; onConfirm: () => void; onRetry: () => void; onClose: () => void;
}) {
  const { t } = useTranslation(["formEntries", "forms"]);
  const busy = sending || retrying;
  return <Dialog open={preview !== null} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent aria-describedby={undefined} closeDisabledReason={busy ? t("formEntries:issue.wait") : undefined}>
      <DialogHeader><DialogTitle>{t("formEntries:issue.title")}</DialogTitle></DialogHeader>
      {preview?.failureCode ? <Banner tone="danger">{preview.failureMessage ?? t("formEntries:issue.failed")}</Banner> : preview ? <div className="flex flex-col gap-3">
        <IssueSummary summary={preview} layout="two"/>
        <p className="text-sm text-[var(--color-content-muted)]">{t("formEntries:issue.onlyCreditNote")}</p>
      </div> : null}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("formEntries:issue.back")}</Button>
        {/* The wait of a 429 is the reason of the disabled «Volver a probar», not a text in the dialog. */}
        {preview?.failureCode ? <DisabledReason reason={busy || retryWait === 0 ? null : t("forms:wait", { count: retryWait })}>
          <Button type="button" pending={retrying} disabled={busy || retryWait > 0} onClick={onRetry}>{t(retrying ? "formEntries:issue.retrying" : "formEntries:issue.retry")}</Button></DisabledReason>
          : <Button type="button" pending={sending} disabled={busy} onClick={onConfirm}>{t(sending ? "formEntries:issue.issuing" : "formEntries:issue.confirm")}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
