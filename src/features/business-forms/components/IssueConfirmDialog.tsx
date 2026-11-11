import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatDateOnly } from "@/shared/lib/dateTime";
import { formatExactDecimal } from "@/shared/lib/decimal";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { InfoTip } from "@/shared/ui/InfoTip";
import type { FormIssuePreview } from "../api/entries";
import { issueText } from "../issuePreview";
const money = (value: string | null | undefined, language: string) => value ? "$ " + (formatExactDecimal(value, language) ?? value) : "—";

/**
 * «¿Emitimos la factura?» (EM2-A, with the amounts of IV3): what the issuer decided, the (i) with why, the receiver, the date, the
 * amounts it itemizes and the total. «Volver» keeps the answers; «Emitir factura» sends as always. If the issuer could not take
 * it, its message with «Volver a probar».
 */
export function IssueConfirmDialog({ preview, sending, retrying, onConfirm, onRetry, onClose }: {
  preview: FormIssuePreview | null; sending: boolean; retrying: boolean; onConfirm: () => void; onRetry: () => void; onClose: () => void;
}) {
  const { t, i18n } = useTranslation("formEntries");
  const language = i18n.language;
  const busy = sending || retrying;
  const document = issueText(preview?.document, language), info = issueText(preview?.info, language);
  return <Dialog open={preview !== null} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent aria-describedby={undefined} closeDisabledReason={busy ? t("issue.wait") : undefined}>
      <DialogHeader><DialogTitle>{t("issue.title")}</DialogTitle></DialogHeader>
      {preview?.failureCode ? <Banner tone="danger">{preview.failureMessage ?? t("issue.failed")}</Banner> : preview ? <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <IssueDatum label={t("issue.document")} value={<span className="inline-flex items-center gap-1">{document}{info ? <InfoTip label={t("issue.why")} text={info}/> : null}</span>}/>
          <IssueDatum label={t("issue.receiver")} value={preview.receiver ?? "—"}/>
          <IssueDatum label={t("issue.date")} value={preview.date ? formatDateOnly(preview.date, language) ?? preview.date : "—"}/>
          {preview.amounts?.map((amount, index) => <IssueDatum key={index} label={issueText(amount.label, language)} value={money(amount.value, language)} number/>)}
          <IssueDatum label={t("issue.total")} value={money(preview.total, language)} number strong/>
        </dl>
        <p className="text-sm text-[var(--color-content-muted)]">{t("issue.onlyCreditNote")}</p>
      </div> : null}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("issue.back")}</Button>
        {preview?.failureCode ? <Button type="button" pending={retrying} disabled={busy} onClick={onRetry}>{t(retrying ? "issue.retrying" : "issue.retry")}</Button>
          : <Button type="button" pending={sending} disabled={busy} onClick={onConfirm}>{t(sending ? "issue.issuing" : "issue.confirm")}</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function IssueDatum({ label, value, number, strong }: { label: string; value: ReactNode; number?: boolean; strong?: boolean }) {
  return <div className="flex min-w-0 flex-col gap-0.5">
    <dt className="text-xs text-[var(--color-content-muted)]">{label}</dt>
    <dd className={"min-w-0 break-words" + (number ? " tabular-nums" : "") + (strong ? " font-semibold" : "")}>{value}</dd>
  </div>;
}
