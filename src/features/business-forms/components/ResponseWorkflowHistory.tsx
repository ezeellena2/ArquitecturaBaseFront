import { useRef, useState } from "react";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import type { ResponseDetail } from "../api/responses";
import type { useResponseWorkflow } from "../hooks/useResponseWorkflow";
import { sameWorkflowReviewTarget, workflowCanReview, workflowNextAction, type WorkflowReviewTarget } from "../workflow";
export function ResponseWorkflowHistory({ workflow, record, timeZoneId }: { workflow: ReturnType<typeof useResponseWorkflow>; record: ResponseDetail; timeZoneId?: string }) {
  const { t, i18n } = useTranslation("forms");
  const data = workflow.query.data?.recordId === record.id ? workflow.query.data : undefined;
  const date = (utc: string) => formatDateTimeInZone(utc, i18n.language, timeZoneId);
  const canManage = workflow.canManage;
  const [reviewTarget, setReviewTarget] = useState<WorkflowReviewTarget | null>(null);
  const [wasSent, setWasSent] = useState<boolean | undefined>();
  const reviewFocus = useRef<HTMLElement | null>(null);
  const reviewing = data?.actions.find(action => action.id === reviewTarget?.runId);
  const reviewingRecipient = reviewing?.recipients.find(recipient => recipient.user.userId === reviewTarget?.recipientUserId);
  const reviewOpen = !!reviewing && reviewing.revision === reviewTarget?.expectedRevision && !!reviewingRecipient && canManage && workflowCanReview(reviewingRecipient);
  const needsConsult = !!reviewTarget && sameWorkflowReviewTarget(workflow.needsConsultReview, reviewTarget);
  const restoreFocus = useRestoreFocusOnClose(reviewOpen, reviewFocus);
  const disabled = workflow.busy || workflow.query.isFetching || workflow.cooldown.isRunning;
  const closeReview = () => { setReviewTarget(null); setWasSent(undefined); };
  return <Surface title={t("workflow.title")} padded actions={data?.ruleRevision ? <span className="text-xs">{t("workflow.ruleRevision", { revision: data.ruleRevision })}</span> : undefined}>
    <ol className="flex flex-col gap-4">
      {record.history.map(event => <li key={event.kind} className="flex flex-wrap gap-2 text-sm"><time dateTime={event.atUtc}>{date(event.atUtc)}</time><span>{t("responses.history" + event.kind)}</span>{event.actor?.displayName ? <span>· {event.actor.displayName}</span> : null}</li>)}
      {data?.task?.decidedAtUtc ? <li className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3 text-sm"><p><Badge variant="outline">{t("approvals.taskStates." + data.task.state)}</Badge> · {data.task.roleName}</p><p>{t("approvals.decisionBy", { name: data.task.decidedBy?.displayName ?? t("responses.unknownPerson"), date: date(data.task.decidedAtUtc) })}</p>{data.task.reason ? <p className="whitespace-pre-wrap">{data.task.reason}</p> : null}</li> : null}
      {data?.actions.map(action => {
        const next = canManage ? workflowNextAction(action) : null;
        return <li key={action.id} tabIndex={-1} className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-3 text-sm sm:flex-row sm:items-start">
          <time className="text-xs text-[var(--color-content-muted)]" dateTime={action.completedAtUtc ?? action.updatedAtUtc}>{date(action.completedAtUtc ?? action.updatedAtUtc)}</time>
          <div className="min-w-0 flex-1 space-y-2"><p>{t("rules.actions." + action.kind)}</p><p className="text-xs text-[var(--color-content-muted)]">{t("rules.events." + action.event)}</p>{action.reason ? <p>{action.reason}</p> : null}{action.state === "Uncertain" ? <p className="text-xs text-[var(--color-content-muted)]">{t("workflow.consultFirst")}</p> : action.state === "NotApplicable" ? <p className="text-xs text-[var(--color-content-muted)]">{t("workflow.notApplicable")}</p> : null}
            {action.recipients.length ? <ul className="space-y-3">{action.recipients.map(recipient => <li key={recipient.user.userId} tabIndex={-1} aria-label={t("workflow.recipient", { name: recipient.user.displayName ?? t("responses.unknownPerson") })} className="space-y-2 border-l border-[var(--color-border)] pl-3">
              <div className="flex flex-wrap items-center gap-2"><span>{recipient.user.displayName ?? t("responses.unknownPerson")}</span><Badge variant="outline">{t("workflow.recipientStates." + recipient.state)}</Badge></div>
              {recipient.reason ? <p>{recipient.reason}</p> : null}
              {recipient.review ? <div className="space-y-1 text-xs text-[var(--color-content-muted)]"><p>{t(recipient.review.wasSent ? "workflow.reviewSent" : "workflow.reviewNotSent", { name: recipient.review.reviewedBy.displayName ?? t("responses.unknownPerson") })}</p><time dateTime={recipient.review.reviewedAtUtc}>{date(recipient.review.reviewedAtUtc)}</time><p>{t("workflow.humanReviewHint")}</p></div> : null}
              {canManage && workflowCanReview(recipient) ? <Button variant="outline" size="sm" disabled={disabled} onClick={event => { reviewFocus.current = event.currentTarget.closest("li"); setWasSent(undefined); setReviewTarget({ runId: action.id, recipientUserId: recipient.user.userId, expectedRevision: action.revision }); }}>{t("workflow.review")}</Button> : null}
            </li>)}</ul> : null}
            {next ? <Button variant="outline" size="sm" disabled={disabled} onClick={() => void workflow.act(action.id)}>{t(workflow.busy ? "workflow.working" : next === "consult" ? "workflow.consult" : "common:actions.retry")}</Button> : null}
          </div><Badge variant="outline" className="self-start">{t("workflow.states." + action.state)}</Badge>
        </li>;
      })}
    </ol>
    {workflow.query.isPending || !data && !workflow.query.isError ? <Spinner /> : null}
    {workflow.query.error ? <div className="space-y-2 text-sm"><p role="status">{readErrorMessage(workflow.query.error, t)}</p>{!(workflow.query.error instanceof ApiError && workflow.query.error.status === 404) ? <Button variant="outline" disabled={workflow.query.isFetching} onClick={() => void workflow.query.refetch()}>{t("common:actions.retry")}</Button> : null}</div> : null}
    {workflow.controlsDenied ? <p role="status" className="text-sm">{t("workflow.noManagePermission")}</p> : null}
    {workflow.cooldown.isRunning && !reviewOpen ? <p role="status" className="text-sm">{t("wait", { count: workflow.cooldown.seconds })}</p> : null}
    <p className="text-xs text-[var(--color-content-muted)]">{t("workflow.retryHint")}</p>
    <Dialog open={reviewOpen} onOpenChange={open => { if (!open && !workflow.busy) closeReview(); }}>
      <DialogContent onCloseAutoFocus={restoreFocus} showCloseButton={!workflow.busy} onEscapeKeyDown={event => { if (workflow.busy) event.preventDefault(); }} onPointerDownOutside={event => { if (workflow.busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>{t("workflow.reviewTitle")}</DialogTitle><DialogDescription>{t("workflow.reviewDescription")}</DialogDescription></DialogHeader>
        <p className="text-sm">{t("workflow.recipient", { name: reviewingRecipient?.user.displayName ?? t("responses.unknownPerson") })}</p>
        <RadioGroupField label={t("workflow.reviewTitle")} value={wasSent === undefined ? undefined : String(wasSent)} onValueChange={value => setWasSent(value === "true")} options={[
          { value: "true", label: t("workflow.sent"), description: t("workflow.sentHint"), disabled: workflow.busy || needsConsult },
          { value: "false", label: t("workflow.notSent"), description: t(reviewing?.kind === "NotifyRole" ? "workflow.notSentRoleHint" : "workflow.notSentHint"), disabled: workflow.busy || needsConsult },
        ]} />
        {workflow.cooldown.isRunning ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("wait", { count: workflow.cooldown.seconds })}</p> : null}
        {needsConsult ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("workflow.reviewCheckRequired")}</p> : null}
        <DialogFooter><Button variant="outline" disabled={workflow.busy} onClick={closeReview}>{t("common:actions.cancel")}</Button><Button disabled={disabled || !needsConsult && wasSent === undefined} onClick={async () => { if (!reviewTarget) return; const resolved = needsConsult ? await workflow.checkReview(reviewTarget) : wasSent !== undefined && await workflow.review(reviewTarget, wasSent); if (resolved) closeReview(); }}>{t(needsConsult ? "workflow.consult" : wasSent === undefined ? "workflow.confirmReview" : wasSent ? "workflow.confirmSent" : "workflow.confirmNotSent")}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </Surface>;
}
