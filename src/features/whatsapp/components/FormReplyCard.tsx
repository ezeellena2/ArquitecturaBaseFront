import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import { useCallback, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { MessageCard } from "@/shared/ui/MessageCard";
import { AlertTriangleIcon, CheckIcon, ClockIcon, FormIcon, InfoIcon } from "@/shared/ui/icons";
import { FormReplyValues } from "./FormReplyValues";
import type { FormReplyPresentation } from "../lib/formReplyPresentation";
export type { FormReplyPresentation } from "../lib/formReplyPresentation";

// A response number is a code: it never breaks at its hyphen («ENT-» / «000031»). It moves whole to the next line, and only one longer
// than a line («VISLONGNAME1-9223372036854775807» at 320 px) wraps inside its box instead of running past the card.
const recordNumber = { number: <span className="inline-block max-w-full" /> };

export function FormReplyCard({ reply, preserveViewport, onResend, actor="", timeZone }: {
  reply: FormReplyPresentation; actor?:string;timeZone?:string; preserveViewport?: (change: () => void) => void; onResend?: () => void;
}) {
  const { t, i18n } = useTranslation("whatsapp");
  const [filePermissionLost,setFilePermissionLost]=useState(false);
  const loseFilePermission=useCallback(()=>setFilePermissionLost(true),[]);
  const focusFallback=useRef<HTMLDivElement>(null);
  const fileRecordId=reply.state==="Completed"?reply.recordId:"";
  const fileErrorReported=useRef(false);
  const reportFileError=useCallback((error:unknown)=>{
    if(fileErrorReported.current)return;
    fileErrorReported.current=true;
    notify({id:"form-files:"+actor+":"+fileRecordId,kind:"error",message:readErrorMessage(error,t)});
  },[actor,fileRecordId,t]);
  const name = reply.name ?? t(["Downloading","RetryingFiles"].includes(reply.state)?"forms.reply.receiving":"forms.formLabel");
  const receivedDate=reply.receivedAtUtc?formatDateTimeInZone(reply.receivedAtUtc,i18n.resolvedLanguage??"es",timeZone):undefined;
  const completed = reply.state === "Completed";
  const label = completed ? t("forms.reply.savedName", { name, number: reply.recordNumber }) : t("forms.reply.stateName", { name });
  const inactive = reply.state === "Rejected" && reply.rejectionCode === "Forms.Record.CatalogItemInactive";
  const fileRejection=reply.state==="Rejected"&&reply.rejectionCode?.startsWith("Files.Content.");
  // W3 (UC5): a send keeps one response, the first that arrives; the second one says which one was kept, like any rejection.
  const kept = reply.state === "Rejected" ? reply.savedNumber : undefined;
  const StateIcon = ["Pending","Downloading","RetryingFiles"].includes(reply.state) ? ClockIcon : reply.state === "Rejected" ? AlertTriangleIcon : InfoIcon;
  return <div ref={focusFallback} tabIndex={-1} role="group" aria-label={label}>
    <MessageCard icon={<FormIcon className="size-4" />} title={name} description={t("forms.reply.label")}>
      {completed ? <>
        {reply.values !== null && !filePermissionLost ? <FormReplyValues rows={reply.values} actor={actor} recordId={reply.recordId} onForbidden={loseFilePermission} onFileError={reportFileError} focusFallback={focusFallback} date={receivedDate} preserveViewport={preserveViewport} /> : null}
        <p className="flex items-start gap-2 border-t border-[var(--color-border)] bg-[var(--color-success-50)] px-3 py-2 text-sm text-[var(--color-success-700)]"><CheckIcon className="mt-0.5 size-4 shrink-0" /><span><Trans t={t} i18nKey="forms.reply.saved" values={{ number: reply.recordNumber }} components={recordNumber} /></span></p>
        {/* What arrived stays as it was; the mark says it was later corrected or voided (CW10-A, CW11-A). */}
        {reply.amendment ? <p className="flex items-start gap-2 border-t border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-content-muted)]"><InfoIcon className="mt-0.5 size-4 shrink-0" />{t(reply.amendment === "Replaced" ? "forms.reply.corrected" : "forms.reply.voided", { number: reply.recordNumber })}</p> : null}
        {reply.values === null || filePermissionLost ? <p className="flex items-start gap-2 border-t border-[var(--color-border)] px-3 py-2 text-sm"><InfoIcon className="mt-0.5 size-4 shrink-0" />{t(reply.valuesRevoked || filePermissionLost ? "forms.reply.revoked" : "forms.reply.noPermission")}</p> : null}
        {reply.messageRemoved ? <p className="flex items-start gap-2 border-t border-[var(--color-border)] px-3 py-2 text-sm"><InfoIcon className="mt-0.5 size-4 shrink-0" />{t("forms.reply.messageRemoved")}</p> : null}
      </> : <p className="flex items-start gap-2 border-t border-[var(--color-border)] px-3 py-2 text-sm"><span aria-hidden="true"><StateIcon className="mt-0.5 size-4 shrink-0" /></span>{kept ? <span><Trans t={t} i18nKey="forms.reply.alreadySaved" values={{ number: kept }} components={recordNumber} /></span> : inactive ? t("forms.reply.catalogInactive",{label:reply.rejectedQuestion??t("forms.formLabel")}) : fileRejection ? t(reply.rejectedQuestion?"forms.reply.filesRejectedQuestion":reply.rejectionCode==="Files.Content.Unavailable"?"forms.reply.filesUnavailable":"forms.reply.filesRejected",{label:reply.rejectedQuestion}) : t(reply.state === "Downloading" ? reply.fileCount===undefined ? "forms.reply.downloading" : "forms.reply.downloadingCount" : reply.state === "RetryingFiles" ? "forms.reply.retryingFiles" : reply.state === "Pending" ? "forms.reply.pending" : reply.state === "Rejected" ? "forms.reply.rejected" : reply.state === "Unrecognized" ? "forms.reply.unrecognized" : "forms.reply.valuesUnavailable",{count:reply.fileCount})}</p>}
      {(inactive||fileRejection)&&onResend ? <div className="flex justify-end border-t border-[var(--color-border)] px-3 py-2"><Button type="button" variant="outline" size="sm" onClick={onResend}>{t("forms.reply.resend")}</Button></div> : null}
    </MessageCard>
  </div>;
}
