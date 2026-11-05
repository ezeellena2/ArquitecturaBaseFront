import { useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { formatDateTimeInZone, formatRelativeTime } from "@/shared/lib/dateTime";
import { ActionTooltip } from "@/shared/ui/ActionTooltip";
import { Button } from "@/shared/ui/button";
import { AlertTriangleIcon, BanIcon, CheckIcon, ClockIcon } from "@/shared/ui/icons";
import { FormRecordFiles } from "@/shared/ui/FormRecordFiles";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/Tabs";
import type { ApprovalTask } from "../api/approvals";
import type { ResponseDetail } from "../api/responses";
import type { ResponseWorkflow } from "../api/workflow";
import type { ResponseDetailState } from "../hooks/useResponseDetailState";
import { composeWorkflowMoments, workflowMomentState } from "../workflowMoments";
import { responseFullPath } from "../responseNavigationPaths";
import { ApprovalDecisionPanel } from "./ApprovalDecisionPanel";
import { ResponseDocumentActions, ResponseDocuments } from "./ResponseDocuments";
import { ResponseWorkflowHistory } from "./ResponseWorkflowHistory";
import { ResponseAnswer } from "./ResponseAnswer";

export function ResponseDetailContent({ state, formId, recordId, onDecided, onDecisionForbidden, decisionAllowed = true }: {
  state: ResponseDetailState; formId: string; recordId: string; onDecided?: () => void; onDecisionForbidden?: () => void; decisionAllowed?: boolean;
}) {
  const { t } = useTranslation("forms");
  const { detail, workflow, data, current, hasPhotos, photos, downloads, loadingTarget, deny, onFileError } = state;
  const [params] = useSearchParams();
  const update = useQueryUpdate();
  const [decisionActions, setDecisionActions] = useState<HTMLDivElement | null>(null);
  const [unavailable, setUnavailable] = useState<ReadonlySet<string>>(() => new Set());
  const invalidTab = data?.id === recordId && data.definitionId === formId && !detail.query.isPlaceholderData &&
    (params.get("tab") === "photos" && !hasPhotos || params.get("tab") === "pdf" && current?.recordId === recordId && !current.documents.length);
  useEffect(() => { if (invalidTab) update({ tab: undefined }); }, [invalidTab, update]);
  if (!data) return null;
  // Whoever only loads sees where their response stands, without the internal activity (CW6-C).
  const own = detail.scope.ownOnly;
  const canDecide = decisionAllowed && detail.scope.user?.permissions.includes("formapprovals.decide");
  // Deciding also takes the task's role: outside it the panel hands the task back and its moment reads as for anyone else.
  const decisionKey = (taskId: string) => detail.scope.owner + ":" + taskId;
  const decidable = (taskId: string) => canDecide && !unavailable.has(decisionKey(taskId));
  const tab = ["answer", ...(own ? [] : ["activity"]), ...(hasPhotos ? ["photos"] : [])].includes(params.get("tab") ?? "") ? params.get("tab")! : params.get("tab") === "pdf" && current?.documents.length ? "pdf" : "answer";
  const refresh = async (task?: ApprovalTask) => { if (task && !await workflow.observeApproval(task)) return; void workflow.query.refetch(); onDecided?.(); };
  return <div className={current?.task?.state === "Open" && decidable(current.task.id) ? "max-sm:pb-20" : undefined}>
    <ResponseMoments data={data} current={current} own={own} timeZoneId={detail.scope.user?.timeZoneId} onActivity={() => update({ tab: "activity" })}
      decision={task => decidable(task.id) ? <><ApprovalDecisionPanel embedded statusId={"approval-moment-" + task.id} taskId={task.id} disabled={loadingTarget} onForbidden={onDecisionForbidden} onUnavailable={() => { const key = decisionKey(task.id); setUnavailable(previous => previous.has(key) ? previous : new Set(previous).add(key)); }} actionsTarget={decisionActions} onDecided={refresh}/><div ref={setDecisionActions} className={task.state === "Open" ? "mt-2 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:border-t max-sm:border-[var(--color-border)] max-sm:bg-[var(--color-surface)] max-sm:p-4" : undefined}/></> : null}/>
    <Tabs value={tab} onValueChange={value => update({ tab: value === "answer" ? undefined : value })}>
      <TabsList aria-label={t("responses.detail")}><TabsTrigger value="answer">{t("responses.answer")}</TabsTrigger>{hasPhotos ? <TabsTrigger value="photos">{t("detail.photos")} ({photos.length})</TabsTrigger> : null}{own ? null : <TabsTrigger value="activity">{t("detail.activity")}</TabsTrigger>}{current?.documents.length ? <TabsTrigger value="pdf">{t("detail.pdf")}</TabsTrigger> : null}</TabsList>
      <TabsContent value="answer"><ResponseAnswer record={data} actor={detail.scope.user!.id} busy={loadingTarget} photos={photos} onForbidden={deny} onError={onFileError}/></TabsContent>
      <TabsContent value="photos">{photos.length ? <FormRecordFiles actor={detail.scope.user!.id} recordId={data.id} files={photos} photo label={t("responses.photos")} number={data.number} thumbnailLimit={photos.length} viewerFiles={photos} onForbidden={deny} onError={onFileError}/> : <p className="text-sm text-[var(--color-content-muted)]">{t("responses.unanswered")}</p>}</TabsContent>
      {/* The tab already says «Actividad»: over the columns only the revision of the rules that ran. In the quick view
          «Ver PDF» and «Descargar» are icons (board TL3-A). */}
      {own ? null : <TabsContent value="activity" forceMount hidden={tab !== "activity"} className="space-y-2">{workflow.query.data?.recordId === data.id && workflow.query.data.ruleRevision ? <p className="text-right text-xs text-[var(--color-content-muted)]">{t("workflow.ruleRevision", { revision: workflow.query.data.ruleRevision })}</p> : null}<ResponseWorkflowHistory key={detail.scope.owner + ":" + data.id} workflow={workflow} record={data} timeZoneId={detail.scope.user?.timeZoneId} documentActions={document => <ResponseDocumentActions compact owner={detail.scope.owner} recordId={data.id} document={document} downloads={downloads} onForbidden={deny}/>}/></TabsContent>}
      {current?.documents.length ? <TabsContent value="pdf"><ResponseDocuments downloads={downloads} owner={detail.scope.owner} recordId={data.id} documents={current.documents} onForbidden={deny} timeZoneId={detail.scope.user?.timeZoneId}/></TabsContent> : null}
    </Tabs>
    </div>;
}

/**
 * Where a response stands: each moment in a row, with its date at the right and, under it in grey, who or what (board TL1-A).
 * `decision` gives the panel of a task the viewer decides; whoever only loads sees neither their own name nor who decided (CW6-C).
 */
export function ResponseMoments({ data, current, own, timeZoneId, onActivity, decision }: {
  data: ResponseDetail; current?: ResponseWorkflow; own: boolean; timeZoneId?: string; onActivity?: () => void;
  decision?: (task: NonNullable<ResponseWorkflow["task"]>) => ReactNode;
}) {
  const { t, i18n } = useTranslation("forms");
  const date = (utc: string) => formatDateTimeInZone(utc, i18n.language, timeZoneId);
  const unknown = t("responses.unknownPerson");
  const name = data.actor.displayName ?? unknown;
  const loadedBy = data.channel === "app" ? t(own ? "detail.ownInApp" : "detail.inApp", { name })
    : data.channel === "phone" ? t(own ? "detail.ownByWhatsApp" : "detail.byWhatsApp", { name }) : own ? null : name;
  return <ol className="mb-4 space-y-2 border-b border-[var(--color-border)] pb-4">
    {composeWorkflowMoments(data, current).map(moment => {
      const state = workflowMomentState(moment);
      const Icon = state === "pending" ? ClockIcon : state === "failed" || state === "rejected" ? BanIcon : state === "uncertain" ? AlertTriangleIcon : CheckIcon;
      const iconTone = state === "completed" ? "text-[var(--color-success-700)]" : state === "failed" || state === "rejected" ? "text-[var(--color-danger-700)]" : "text-[var(--color-warning-700)]";
      const heading = (title: string, when: ReactNode, id?: string) => <div className="flex flex-wrap items-baseline justify-between gap-x-3"><h3 id={id} className="font-semibold">{title}</h3>{when ? <span className="text-xs text-[var(--color-content-muted)]">{when}</span> : null}</div>;
      const who = (text: ReactNode) => <p className="text-xs text-[var(--color-content-muted)]">{text}</p>;
      const panel = moment.kind === "approval" ? decision?.(moment.task) ?? null : null;
      const completed = moment.kind === "effects" ? t("detail.actionsCompleted", { completed: moment.completedCount, count: moment.totalCount }) : null;
      return <li key={moment.key} data-moment-state={state} className={"relative border-l-2 py-1 pl-7 " + (state === "pending" ? "border-[var(--color-warning)] bg-[var(--color-warning-50)]" : "border-[var(--color-border)]")}>
        <Icon className={"absolute top-1.5 left-1 size-4 " + iconTone}/>
        {moment.kind === "received" ? <>{heading(t("responses.received"), date(moment.atUtc))}{loadedBy ? who(loadedBy) : null}</>
        : moment.kind === "previousDecision" ? <>{heading(t("approvals.taskStates." + moment.state), date(moment.atUtc))}
          {own && !moment.pdfAtUtc ? null : who([...own ? [] : [moment.by?.displayName ?? unknown], ...moment.pdfAtUtc ? [t("detail.previousPdf", { date: date(moment.pdfAtUtc) })] : []].join(" · "))}</>
        // Who corrected and why, and the version it replaced, as it was (CW10-A).
        : moment.kind === "corrected" ? <>{heading(t("detail.corrected"), date(moment.correction.atUtc))}
          {who(own ? "«" + moment.correction.reason + "»" : t("detail.correctedBy", { name: moment.correction.by.displayName ?? unknown, reason: moment.correction.reason }))}
          <Link to={responseFullPath(data.definitionId, moment.correction.previousRecordId, "")} className="text-xs text-[var(--color-brand-700)] underline">
            {t(moment.correction.previousPdfAtUtc ? "detail.viewPreviousWithPdf" : "detail.viewPrevious")}</Link></>
        : moment.kind === "voided" ? <>{heading(t("approvals.states.Voided"), date(moment.atUtc))}
          {who(own ? "«" + moment.reason + "»" : t("detail.voidedBy", { name: moment.by.displayName ?? unknown, reason: moment.reason }))}</>
        : moment.kind === "effects" ? <>
          {heading(t("detail.events." + moment.event), onActivity ? <Button variant="link" size="inline" onClick={onActivity}>{completed}</Button> : completed)}
          {who(moment.actions.map(action => t("rules.actions." + action.kind)).join(" · "))}
          {moment.actions.some(action => action.state === "Failed" || action.state === "Uncertain" || action.recipients.some(recipient => recipient.state === "Failed" || recipient.state === "Uncertain")) ? who(t("detail.issues")) : null}</> : <>
          {heading(moment.again ? t("detail.pendingAgain") : t("approvals.taskStates." + moment.task.state), moment.task.state === "Open" ? <ActionTooltip label={date(moment.task.requestedAtUtc)}><time dateTime={moment.task.requestedAtUtc} tabIndex={0}>{formatRelativeTime(moment.task.requestedAtUtc, i18n.language)}</time></ActionTooltip> : moment.task.decidedAtUtc && !panel ? date(moment.task.decidedAtUtc) : null, "approval-moment-" + moment.task.id)}
          {panel ?? <>{moment.again ? who(t("detail.newPdfOnApproval")) : own ? null : who([moment.task.roleName ?? unknown, ...(moment.task.state !== "Open" ? [moment.task.decidedBy?.displayName ?? unknown] : [])].join(" · "))}{moment.task.reason ? <p className="mt-1 text-sm whitespace-pre-wrap">{moment.task.reason}</p> : null}</>}
        </>}
      </li>; })}
  </ol>;
}
