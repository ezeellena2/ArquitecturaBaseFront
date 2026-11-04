import { Fragment, useRef, useState, type ReactNode } from "react";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { calendarDateInZone, formatDateInZone, formatDateTimeInZone, formatTimeInZone } from "@/shared/lib/dateTime";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Spinner } from "@/shared/ui/Spinner";
import type { ResponseDetail } from "../api/responses";
import type { ResponseAction, ResponseRecipient, ResponseWorkflow } from "../api/workflow";
import type { useResponseWorkflow } from "../hooks/useResponseWorkflow";
import { approvalStateVariant } from "../approvals";
import { composeWorkflowMoments } from "../workflowMoments";
import { sameWorkflowReviewTarget, workflowCanReview, workflowNextAction, type WorkflowReviewTarget } from "../workflow";

type IssuedDocument = ResponseWorkflow["documents"][number];
type ApprovalTask = NonNullable<ResponseWorkflow["task"]>;
// Each thing in a fixed column, the same in every row (board TL3-A): the time, what happened with who and the detail under
// it in grey, the state and the actions. Each person of a role's notice goes in a row of their own, under the action.
interface ActivityRow { key: string; atUtc?: string; text: ReactNode; detail?: ReactNode; state?: ReactNode; actions?: ReactNode; person?: string; focusable?: boolean }
const actionTone = (state: ResponseAction["state"]) => state === "Completed" ? "success" : state === "Failed" ? "danger" : state === "Uncertain" ? "warning" : "outline";
const recipientTone = (state: ResponseRecipient["state"]) => state === "Failed" ? "danger" : state === "Uncertain" ? "warning" : "outline";
const Detail = ({ children }: { children: ReactNode }) => <p className="text-xs text-[var(--color-content-muted)]">{children}</p>;

export function ResponseWorkflowHistory({ workflow, record, timeZoneId, documentActions }: { workflow: ReturnType<typeof useResponseWorkflow>; record: ResponseDetail; timeZoneId?: string; documentActions?: (document: IssuedDocument) => ReactNode }) {
  const { t, i18n } = useTranslation("forms");
  const data = workflow.query.data?.recordId === record.id ? workflow.query.data : undefined;
  const canManage = workflow.canManage;
  const [reviewTarget, setReviewTarget] = useState<WorkflowReviewTarget | null>(null);
  const [wasSent, setWasSent] = useState<boolean | undefined>();
  const reviewFocus = useRef<HTMLElement | null>(null);
  const reviewingAction = data?.actions.find(action => action.id === reviewTarget?.runId);
  const reviewingRecipient = reviewingAction?.recipients.find(recipient => recipient.user.userId === reviewTarget?.recipientUserId);
  const reviewOpen = !!reviewingAction && reviewingAction.revision === reviewTarget?.expectedRevision && !!reviewingRecipient && canManage && workflowCanReview(reviewingRecipient);
  const needsConsult = !!reviewTarget && sameWorkflowReviewTarget(workflow.needsConsultReview, reviewTarget);
  const restoreFocus = useRestoreFocusOnClose(reviewOpen, reviewFocus);
  const disabled = workflow.busy || workflow.query.isFetching || workflow.cooldown.isRunning;
  // The wait of a 429 is the reason of each disabled action, not a text under the history or in the dialog. A background
  // refetch (every 2 s while an action runs, or on focus) is not the history working: it keeps the reason, so the actions
  // are not remounted under the mouse or the keyboard focus.
  const waitReason = workflow.busy || !workflow.cooldown.isRunning ? null : t("wait", { count: workflow.cooldown.seconds });
  const closeReview = () => { setReviewTarget(null); setWasSent(undefined); };
  // Only the touched button says what it is doing (board LC1-A): «Consultando…» or «Reintentando…» on its action, and
  // «Consultando…» or «Confirmando…» in the dialog; the rest only turn off.
  const acting = workflow.working?.kind === "act" ? workflow.working.runId : null;
  const reviewing = workflow.working?.kind === "check" ? "workflow.working" : workflow.working?.kind === "review" ? "workflow.confirming" : null;
  const unknown = t("responses.unknownPerson");
  // Whoever loaded it goes once, under «Se respondió el formulario», with its channel; the assistant has no person.
  const recordRow = (event: ResponseDetail["history"][number]): ActivityRow => {
    const name = event.actor?.displayName ?? undefined;
    const who = event.kind === "Submitted" && record.channel === "app" ? t("detail.inApp", { name: name ?? unknown })
      : event.kind === "Submitted" && record.channel === "phone" ? t("detail.byWhatsApp", { name: name ?? unknown })
      : event.kind === "Sent" && !event.actor && record.origin?.senderKind === "Assistant" ? t("detail.assistant") : name;
    return { key: "record:" + event.kind + ":" + event.atUtc, atUtc: event.atUtc, text: t("responses.history" + event.kind), detail: who ? <Detail>{who}</Detail> : null };
  };
  // The state goes once, in its column: the decision is a row, with the reason of a rejection under it in its box.
  const approvalRows = (task: ApprovalTask): ActivityRow[] => [
    { key: "request:" + task.id, atUtc: task.requestedAtUtc, text: t("detail.approvalRequested"), detail: <Detail>{t("detail.role", { role: task.roleName ?? t("rules.unavailableRole") })}</Detail>,
      state: task.state === "Open" ? <Badge variant={approvalStateVariant(task.state)}>{t("approvals.taskStates.Open")}</Badge> : undefined },
    ...(task.state !== "Open" && task.decidedAtUtc ? [{ key: "decision:" + task.id, atUtc: task.decidedAtUtc,
      text: t(task.state === "Approved" ? "detail.approvedBy" : "detail.rejectedBy", { name: task.decidedBy?.displayName ?? unknown }),
      detail: task.reason ? <p className="mt-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-1 whitespace-pre-wrap">{task.reason}</p> : null,
      state: <Badge variant={approvalStateVariant(task.state)}>{t("approvals.taskStates." + task.state)}</Badge> }] : []),
  ];
  const when = (utc: string) => formatDateTimeInZone(utc, i18n.language, timeZoneId);
  const menu = i18n.language.startsWith("en") ? "en" : "es";
  const recipientState = (recipient: ResponseRecipient) => <Badge variant={recipientTone(recipient.state)}>{t("workflow.recipientStates." + recipient.state)}</Badge>;
  // The receipts of the provider keep their time under the person, apart from a human review.
  const recipientNotes = (recipient: ResponseRecipient) => <>
    {recipient.deliveredAtUtc || recipient.readAtUtc ? <p className="flex flex-wrap gap-x-2 text-xs text-[var(--color-content-muted)]">
      {recipient.deliveredAtUtc ? <span><span>{t("workflow.delivered")}</span> <time dateTime={recipient.deliveredAtUtc}>{when(recipient.deliveredAtUtc)}</time></span> : null}
      {recipient.readAtUtc ? <span><span>{t("workflow.read")}</span> <time dateTime={recipient.readAtUtc}>{when(recipient.readAtUtc)}</time></span> : null}
    </p> : null}
    {recipient.reason ? <Detail>{recipient.reason}</Detail> : null}
    {recipient.review ? <ReviewNote text={t(recipient.review.wasSent ? "workflow.reviewSent" : "workflow.reviewNotSent", { name: recipient.review.reviewedBy.displayName ?? unknown })} atUtc={recipient.review.reviewedAtUtc} when={when(recipient.review.reviewedAtUtc)}/> : null}
  </>;
  const reviewButton = (action: ResponseAction, recipient: ResponseRecipient) => canManage && workflowCanReview(recipient)
    ? <DisabledReason key={"review:" + recipient.user.userId} reason={waitReason}><Button variant="outline" size="sm" disabled={disabled} onClick={event => { reviewFocus.current = event.currentTarget.closest("li"); setWasSent(undefined); setReviewTarget({ runId: action.id, recipientUserId: recipient.user.userId, expectedRevision: action.revision }); }}>{t("workflow.review")}</Button></DisabledReason>
    : null;
  // The message to whoever loaded it is one row, with their name under the action; each person of a role, a row of their
  // own with the state of their send, since the notice can be done while one of them did not get it.
  const actionRows = (action: ResponseAction): ActivityRow[] => {
    const next = canManage ? workflowNextAction(action) : null;
    const single = action.kind === "NotifyAuthor" && action.recipients.length === 1 ? action.recipients[0] : undefined;
    const documents = data?.documents.filter(document => document.runId === action.id) ?? [];
    const actions = [
      ...(documentActions ? documents.map(document => <Fragment key={document.id}>{documentActions(document)}</Fragment>) : []),
      next ? <span key="recover" className="inline-flex items-center gap-1"><DisabledReason reason={waitReason}><Button variant="outline" size="sm" pending={acting === action.id} disabled={disabled} onClick={() => void workflow.act(action.id)}>{t(acting === action.id ? next === "consult" ? "workflow.working" : "responses.retrying" : next === "consult" ? "workflow.consult" : "common:actions.retry")}</Button></DisabledReason>
        {next === "retry" ? <InfoTip label={t("common:actions.moreInfo", { label: t("common:actions.retry") })} text={t("workflow.retryHint")}/> : null}</span> : null,
      single ? reviewButton(action, single) : null,
    ].filter(Boolean);
    const row: ActivityRow = {
      key: "action:" + action.id, atUtc: action.completedAtUtc ?? action.updatedAtUtc, text: t("rules.actions." + action.kind), focusable: true,
      detail: <>
        {/* NI1-A (2026-11-03): only a copy in the other language names it. */}
        {documents.map(document => <Detail key={document.id}>{document.name}{document.culture !== menu ? " · " + t("cultures." + document.culture) : null}</Detail>)}
        {single ? <Detail>{single.user.displayName ?? unknown}</Detail> : action.recipients.length ? <Detail>{t("detail.recipients", { count: action.recipients.length })}</Detail> : null}
        {action.reason ? <Detail>{action.reason}</Detail> : null}
        {single ? recipientNotes(single) : null}
      </>,
      state: <Badge variant={actionTone(action.state)}>{t("workflow.states." + action.state)}</Badge>,
      actions: actions.length ? actions : undefined,
    };
    return [row, ...(single ? [] : action.recipients.map(recipient => {
      const review = reviewButton(action, recipient);
      return { key: "recipient:" + action.id + ":" + recipient.user.userId, person: recipient.user.displayName ?? unknown, text: recipient.user.displayName ?? unknown, focusable: true, detail: recipientNotes(recipient), state: recipientState(recipient), actions: review ?? undefined };
    }))];
  };
  // The moments are thin bands that order the story without saying the state: what was done on receipt goes with the
  // response itself, under «Al recibirla», and inside each band the rows go in the order they happened. An action keeps
  // the people of its notice under it.
  const bands: { key: string; title: string; groups: ActivityRow[][] }[] = [];
  for (const moment of composeWorkflowMoments(record, data)) {
    if (moment.kind === "received") bands.push({ key: "Received", title: t("detail.events.Received"), groups: moment.history.map(event => [recordRow(event)]) });
    else if (moment.kind === "approval") bands.push({ key: "approval", title: t("detail.approvalBand"), groups: approvalRows(moment.task).map(row => [row]) });
    else {
      const groups = moment.actions.map(actionRows);
      const band = bands.find(item => item.key === moment.event);
      if (band) band.groups.push(...groups); else bands.push({ key: moment.event, title: t("detail.events." + moment.event), groups });
    }
  }
  const instant = (group: ActivityRow[]) => Date.parse(group[0].atUtc ?? "");
  // The date goes once a day, in its first row, and the time in all of them.
  let previousDay: string | undefined;
  const renderRow = (row: ActivityRow) => {
    const day = row.atUtc ? calendarDateInZone(row.atUtc, timeZoneId) : undefined;
    const newDay = !!day && day !== previousDay;
    if (day) previousDay = day;
    return <li key={row.key} tabIndex={row.focusable ? -1 : undefined} aria-label={row.person ? t("workflow.recipient", { name: row.person }) : undefined} className="col-span-full grid grid-cols-subgrid items-start gap-y-1 border-t border-[var(--color-border)] px-3 py-2 first:border-t-0">
      <span className="tabular-nums">{row.atUtc ? <time dateTime={row.atUtc} className="flex flex-col">{newDay ? <span className="text-xs text-[var(--color-content-muted)]">{formatDateInZone(row.atUtc, i18n.language, timeZoneId)}</span> : null}{formatTimeInZone(row.atUtc, i18n.language, timeZoneId)}</time> : null}</span>
      <div className={cn("min-w-0 space-y-0.5 break-words", row.person && "border-l-2 border-[var(--color-surface-header)] pl-2.5")}><p>{row.text}</p>{row.detail}</div>
      {/* On the phone the state and the actions go together under what happened; in the quick view the state has its
          column and the actions stay under the text, so it keeps its width; wide, each in its column. */}
      <div className="col-start-2 flex flex-wrap items-center gap-2 empty:hidden @min-[26rem]:contents">
        {row.state ? <div className="@min-[26rem]:col-start-3">{row.state}</div> : null}
        {row.actions ? <div className="flex flex-wrap items-center gap-1 @min-[26rem]:col-start-2 @min-[40rem]:col-start-4 @min-[40rem]:justify-end">{row.actions}</div> : null}
      </div>
    </li>;
  };
  return <>
    <div className="@container">
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 overflow-hidden rounded-md border border-[var(--color-border)] text-sm @min-[26rem]:grid-cols-[3.5rem_minmax(0,1fr)_auto] @min-[40rem]:grid-cols-[6rem_minmax(0,1fr)_auto_auto]">
        <div aria-hidden="true" className="col-span-full hidden grid-cols-subgrid border-b border-[var(--color-border)] bg-[var(--color-surface-header)] px-3 py-1.5 text-xs font-semibold text-[var(--color-surface-header-foreground)] @min-[26rem]:grid">
          <span>{t("detail.columns.date")}</span><span>{t("detail.columns.what")}</span><span>{t("detail.columns.state")}</span><span className="hidden text-right @min-[40rem]:block">{t("detail.columns.actions")}</span>
        </div>
        <ol className="col-span-full grid grid-cols-subgrid">
          {bands.map(band => <li key={band.key} aria-label={band.title} className="col-span-full grid grid-cols-subgrid border-t border-[var(--color-border)] first:border-t-0">
            <p className="col-span-full border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-1 font-semibold">{band.title}</p>
            <ol className="col-span-full grid grid-cols-subgrid">{[...band.groups].sort((left, right) => instant(left) - instant(right)).flat().map(renderRow)}</ol>
          </li>)}
        </ol>
      </div>
    </div>
    {workflow.query.isPending || !data && !workflow.query.isError ? <Spinner /> : null}
    {workflow.query.error ? <div className="space-y-2 text-sm"><p role="status">{t("common:states.loadFailed")}</p>{!(workflow.query.error instanceof ApiError && workflow.query.error.status === 404) ? <Button variant="outline" pending={workflow.query.isFetching} onClick={() => void workflow.query.refetch()}>{t(workflow.query.isFetching ? "responses.retrying" : "common:actions.retry")}</Button> : null}</div> : null}
    {workflow.controlsDenied ? <p role="status" className="text-sm">{t("workflow.noManagePermission")}</p> : null}
    {/* While the review works the dialog waits open, with the × off and its gerund as the reason, as a confirmation that waits. */}
    <Dialog open={reviewOpen} onOpenChange={open => { if (!open && !workflow.busy) closeReview(); }}>
      <DialogContent aria-describedby={undefined} onCloseAutoFocus={restoreFocus} closeDisabledReason={workflow.busy ? t(reviewing ?? "workflow.confirming") : undefined} onEscapeKeyDown={event => { if (workflow.busy) event.preventDefault(); }} onPointerDownOutside={event => { if (workflow.busy) event.preventDefault(); }}>
        <DialogHeader><DialogTitle>{t("workflow.reviewTitle")}</DialogTitle></DialogHeader>
        <p className="text-sm">{t("workflow.recipient", { name: reviewingRecipient?.user.displayName ?? unknown })}</p>
        <RadioGroupField label={t("workflow.reviewTitle")} value={wasSent === undefined ? undefined : String(wasSent)} onValueChange={value => setWasSent(value === "true")} options={[
          { value: "true", label: t("workflow.sent"), help: t("workflow.sentHint"), disabled: workflow.busy || needsConsult },
          { value: "false", label: t("workflow.notSent"), help: t(reviewingAction?.kind === "NotifyRole" ? "workflow.notSentRoleHint" : "workflow.notSentHint"), disabled: workflow.busy || needsConsult },
        ]} />
        {needsConsult ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("workflow.reviewCheckRequired")}</p> : null}
        <DialogFooter><Button variant="outline" disabled={workflow.busy} onClick={closeReview}>{t("common:actions.cancel")}</Button><DisabledReason reason={waitReason} className="max-sm:*:flex-1"><Button pending={!!reviewing} disabled={disabled || !needsConsult && wasSent === undefined} onClick={async () => { if (!reviewTarget) return; const resolved = needsConsult ? await workflow.checkReview(reviewTarget) : wasSent !== undefined && await workflow.review(reviewTarget, wasSent); if (resolved) closeReview(); }}>{t(reviewing ?? (needsConsult ? "workflow.consult" : wasSent === undefined ? "workflow.confirmReview" : wasSent ? "workflow.confirmSent" : "workflow.confirmNotSent"))}</Button></DisabledReason></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}

/// Who said a send went out: that a human review does not confirm the WhatsApp delivery goes in the (i) next to it, not
/// in a line under it (decision of 2026-10-31).
function ReviewNote({ text, atUtc, when }: { text: string; atUtc: string; when: string }) {
  const { t } = useTranslation("forms");
  return <p className="flex flex-wrap items-center gap-x-1 text-xs text-[var(--color-content-muted)]">{text}<InfoTip label={t("common:actions.moreInfo", { label: text })} text={t("workflow.humanReviewHint")}/><time dateTime={atUtc}>{when}</time></p>;
}
