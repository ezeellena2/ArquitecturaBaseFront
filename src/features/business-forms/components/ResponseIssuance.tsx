import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { calendarDateInZone, formatDateInZone, formatDateOnly, formatTimeInZone } from "@/shared/lib/dateTime";
import { formatExactDecimal } from "@/shared/lib/decimal";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { InfoTip } from "@/shared/ui/InfoTip";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import type { ResponseDetail } from "../api/responses";
import type { ResponseAction, ResponseIssueConfirmation, ResponseWorkflow } from "../api/workflow";
import type { ResponseDetailState } from "../hooks/useResponseDetailState";
import { useResponseIssuance } from "../hooks/useResponseIssuance";
import { notIssuedCode, responseIssuance, type IssuanceStage } from "../issuance";
import { issueText } from "../issuePreview";
import { ResponseResults, ResultData } from "./ResponseResults";

/**
 * The zone «Comprobante» (EM1-A), the first of the detail: what the issuance left (RE1-A) and, while it is not issued, how it
 * stands, with what unlocks it in its band: «Revisar» (NC1-A, for who may decide) or «No emitir» and «Emitir» (EM2-A, for
 * whoever loaded it). The title says the state of the response («Anulándose»); the zone, the one of the issuance. Nothing says
 * which issuer it is: its name, its codes and its texts come from the server, and the reasons in review, from texts tied to the
 * codes it sends. Without an issuance nor results there is no zone.
 */
export function ResponseIssuance({ state, formId, onChanged }: { state: ResponseDetailState; formId: string; onChanged?: () => void }) {
  const { data, current, detail, workflow, loadingTarget } = state;
  if (!data) return null;
  return <IssuanceZone key={detail.scope.owner + ":" + data.id} record={data} flow={current} owner={detail.scope.owner} formId={formId} disabled={loadingTarget}
    timeZoneId={detail.scope.user?.timeZoneId}
    readFlow={() => { void workflow.query.refetch(); }} readDetail={() => { if (!detail.query.isPlaceholderData) void detail.query.refetch(); }} onChanged={onChanged}/>;
}

function IssuanceZone({ record, flow, owner, formId, disabled, timeZoneId, readFlow, readDetail, onChanged }: {
  record: ResponseDetail; flow: ResponseWorkflow | undefined; owner: string; formId: string; disabled: boolean; timeZoneId?: string;
  readFlow: () => void; readDetail: () => void; onChanged?: () => void;
}) {
  const { t, i18n } = useTranslation("forms");
  const issuance = responseIssuance(flow);
  const actions = useResponseIssuance({ owner, formId, recordId: record.id, number: record.number, onRead: () => { readFlow(); readDetail(); onChanged?.(); } });
  const [reviewing, setReviewing] = useState<{ runId: string; revision: number } | null>(null);
  const [skipping, setSkipping] = useState(false);
  // The detail follows the flow: when an issuance or its reversal moves, its result, its void and what may be done with it come
  // with the detail, which does not poll. The first reading of the flow, or a response without an issuance, reads nothing more.
  const signature = (flow?.actions ?? []).filter(action => action.kind === "IssueDocument").map(action => action.id + ":" + action.state).join("|");
  const seen = useRef(signature);
  useEffect(() => {
    if (seen.current === signature) return;
    const moved = seen.current !== "";
    seen.current = signature;
    if (moved) readDetail();
  }, [signature, readDetail]);
  const band = issuance.band;
  const confirmation = issuance.confirmation;
  if (!band && !confirmation && !record.results?.length) return null;
  const working = actions.working;
  const reviewAction = band?.stage === "review" && band.action.canReview ? band.action : null;
  const open = reviewing && reviewAction && reviewAction.id === reviewing.runId && reviewAction.revision === reviewing.revision ? reviewAction : null;
  const bandActions = reviewAction ? <Button variant="outline" size="sm" disabled={disabled || !!working} onClick={() => setReviewing({ runId: reviewAction.id, revision: reviewAction.revision })}>{t("issuance.review")}</Button>
    : confirmation ? <>
      <Button variant="destructive-outline" size="sm" disabled={disabled || !!working} onClick={() => setSkipping(true)}>{t("issuance.skip")}</Button>
      {/* Decision 4: a summary that failed offers «Volver a probar» instead of «Emitir». */}
      {confirmation.failureCode
        ? <Button size="sm" pending={working === "retry"} disabled={disabled || !!working} onClick={() => void actions.retry(confirmation.runId)}>{t(working === "retry" ? "issuance.retrying" : "issuance.retry")}</Button>
        : <Button size="sm" pending={working === "issue"} disabled={disabled || !!working} onClick={() => void actions.confirm(confirmation.runId, true)}>{t(working === "issue" ? "issuance.issuingAction" : "issuance.issue")}</Button>}
    </> : null;
  return <Surface title={t("issuance.title")} padded actions={bandActions}>
    {confirmation ? <>
      <p className="text-sm font-semibold">{t("issuance.awaiting")}</p>
      {confirmation.failureCode
        ? <Banner tone="warning"><span className="font-semibold">{t("issuance.previewFailed")}</span>{" · "}{confirmation.failureMessage ?? confirmation.failureCode}</Banner>
        : <ConfirmationSummary confirmation={confirmation} language={i18n.language}/>}
    </> : band?.stage === "awaiting" ? <p className="text-sm text-[var(--color-content-muted)]">{t("issuance.awaitingOthers")}</p> : null}
    {/* What the issuance left stays in sight while it is reversed (NC1-A): the credit note joins it once issued. */}
    <ResponseResults results={record.results}/>
    {band ? <BandNotice band={band.stage} action={band.action} reversal={band.reversal} issued={issuance.issued} timeZoneId={timeZoneId}/> : null}
    {open ? <IssuanceReviewDialog number={record.number} action={open} working={working === "proceed" || working === "stop" ? working : null}
      onClose={() => setReviewing(null)} onDecide={async proceed => { if (await actions.review(open.id, open.revision, proceed)) setReviewing(null); }}/> : null}
    {confirmation ? <ConfirmDialog open={skipping} onOpenChange={value => { if (!value && working !== "skip") setSkipping(false); }} destructive
      title={t("issuance.skipTitle", { number: record.number })} description={t("issuance.skipDescription", { number: record.number })}
      confirmLabel={t("issuance.skip")} pending={working === "skip"} pendingLabel={t("issuance.skipping")}
      onConfirm={() => { void actions.confirm(confirmation.runId, false).then(() => setSkipping(false)); }}/> : null}
  </Surface>;
}

// A reason the server knows reads translated in `reason`; one only the issuer knows (its own code) comes as the code itself.
const reasonText = (action: ResponseAction) => action.reason && action.reason !== action.reasonCode ? action.reason : action.reasonCode;

function BandNotice({ band, action, reversal, issued, timeZoneId }: { band: IssuanceStage; action: ResponseAction; reversal: boolean; issued: boolean; timeZoneId?: string }) {
  const { t, i18n } = useTranslation("forms");
  const titled = (title: string, detail: ReactNode) => <><span className="font-semibold">{title}</span>{detail ? <>{" · "}{detail}</> : null}</>;
  // «En cola»: the issuer did not answer; it says when it tries again (the time today, or the date and time) and how many times it
  // tried. The title is its own: the reason of the wait asks to try again later, and here the system tries again by itself.
  if (band === "queued" && action.nextAttemptAtUtc && action.attempts) {
    const next = action.nextAttemptAtUtc;
    const time = formatTimeInZone(next, i18n.language, timeZoneId);
    const today = calendarDateInZone(next, timeZoneId) === calendarDateInZone(new Date().toISOString(), timeZoneId);
    const when = today ? t("issuance.queuedAt", { time }) : t("issuance.queuedOn", { date: formatDateInZone(next, i18n.language, timeZoneId), time });
    return <Banner tone="warning">{titled(t("issuance.queuedTitle"), when + " " + t("issuance.queuedTried", { count: action.attempts }))}</Banner>;
  }
  if (band === "issuing" || band === "queued")
    return <p role="status" className="flex items-center gap-2 text-sm"><Spinner decorative/>{t(!reversal ? "issuance.issuing" : issued ? "issuance.voidingCreditNote" : "issuance.voidingCancel")}</p>;
  if (band === "failed") {
    if (!reversal && action.reasonCode === notIssuedCode) return <p className="text-sm text-[var(--color-content-muted)]">{reasonText(action)}</p>;
    return <Banner tone="danger">{titled(t(reversal ? "issuance.voidFailedTitle" : "issuance.failedTitle"), reasonText(action))}{reversal ? null : <> {t("issuance.failedFix")}</>}</Banner>;
  }
  if (band === "review") {
    // The reasons the issuer gives (another number, the date) are texts tied to its codes; another one reads as the server says.
    const key = "issuance.reasons." + action.reasonCode;
    const known = !!action.reasonCode && i18n.exists("forms:" + key + ".title");
    return <Banner tone="warning">{titled(known ? t(key + ".title") : t("issuance.reviewTitle"), known ? t(key + ".detail") : action.reason !== action.reasonCode ? action.reason : null)}
      {action.canReview ? null : <> {t("issuance.reviewOthers")}</>}</Banner>;
  }
  return null;
}

const money = (value: string | null | undefined, language: string) => value ? "$ " + (formatExactDecimal(value, language) ?? value) : "—";

// «Esperando que lo confirmes» (EM2-A): what «¿La emito?» said, as in the app: the document with why in its (i), the customer,
// the date, the amounts it itemizes and the total.
function ConfirmationSummary({ confirmation, language }: { confirmation: ResponseIssueConfirmation; language: string }) {
  const { t } = useTranslation("forms");
  const info = issueText(confirmation.info, language);
  return <ResultData label={t("issuance.awaiting")} items={[
    { key: "document", label: t("issuance.document"), value: <span className="inline-flex items-center gap-1">{issueText(confirmation.document, language) || "—"}{info ? <InfoTip label={t("issuance.why")} text={info}/> : null}</span> },
    { key: "receiver", label: t("issuance.receiver"), value: confirmation.receiver ?? "—" },
    ...confirmation.date ? [{ key: "date", label: t("issuance.date"), value: formatDateOnly(confirmation.date, language) ?? confirmation.date }] : [],
    ...(confirmation.amounts ?? []).map((amount, index) => ({ key: "amount:" + index, label: issueText(amount.label, language), value: money(amount.value, language) })),
    { key: "total", label: t("issuance.total"), value: money(confirmation.total, language), strong: true },
  ]}/>;
}

/**
 * «Revisar la emisión de FAC-000012» (NC1-A): go on as the reason allows (the next number, today's date) or do not issue; the
 * first comes chosen. By the number, it first says where to look. It waits open while it decides; if someone else decided first,
 * the flow is read again and the dialog goes away with the review.
 */
function IssuanceReviewDialog({ number, action, working, onClose, onDecide }: {
  number: string; action: ResponseAction; working: "proceed" | "stop" | null; onClose: () => void; onDecide: (proceed: boolean) => void;
}) {
  const { t, i18n } = useTranslation("forms");
  const [choice, setChoice] = useState("proceed");
  const key = "issuance.reasons." + action.reasonCode;
  const known = !!action.reasonCode && i18n.exists("forms:" + key + ".proceed");
  const advice = known && i18n.exists("forms:" + key + ".advice") ? t(key + ".advice") : null;
  return <Dialog open onOpenChange={value => { if (!value && !working) onClose(); }}>
    <DialogContent aria-describedby={undefined} closeDisabledReason={working ? t("issuance.confirming") : undefined}
      onEscapeKeyDown={event => { if (working) event.preventDefault(); }} onPointerDownOutside={event => { if (working) event.preventDefault(); }}>
      <DialogHeader><DialogTitle>{t("issuance.reviewDialogTitle", { number })}</DialogTitle></DialogHeader>
      {advice ? <Banner>{advice}</Banner> : null}
      <RadioGroupField label={t("issuance.reviewChoice")} value={choice} onValueChange={setChoice} options={[
        { value: "proceed", label: known ? t(key + ".proceed") : t("issuance.proceed"), disabled: !!working },
        { value: "stop", label: t("issuance.stop"), help: t("issuance.stopHelp"), disabled: !!working },
      ]}/>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={!!working} onClick={onClose}>{t("common:actions.cancel")}</Button>
        <Button type="button" pending={!!working} onClick={() => onDecide(choice === "proceed")}>{t(working ? "issuance.confirming" : "issuance.confirm")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
