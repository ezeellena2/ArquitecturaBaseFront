import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { formatDateTimeInZone, formatRelativeTime } from "@/shared/lib/dateTime";
import { ActionTooltip } from "@/shared/ui/ActionTooltip";
import { Button } from "@/shared/ui/button";
import { AlertTriangleIcon, BanIcon, CheckIcon, ClockIcon } from "@/shared/ui/icons";
import { FormRecordFiles } from "@/shared/ui/FormRecordFiles";
import { Surface } from "@/shared/ui/Surface";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/Tabs";
import type { ApprovalTask } from "../api/approvals";
import type { ResponseDetailState } from "../hooks/useResponseDetailState";
import { composeWorkflowMoments, workflowMomentState } from "../workflowMoments";
import { ApprovalDecisionPanel } from "./ApprovalDecisionPanel";
import { ResponseDocuments } from "./ResponseDocuments";
import { ResponseWorkflowHistory } from "./ResponseWorkflowHistory";
import { ResponseAnswer } from "./ResponseAnswer";

export function ResponseDetailContent({ state, formId, recordId, onDecided, onDecisionForbidden, decisionAllowed = true }: {
  state: ResponseDetailState; formId: string; recordId: string; onDecided?: () => void; onDecisionForbidden?: () => void; decisionAllowed?: boolean;
}) {
  const { t, i18n } = useTranslation("forms");
  const { detail, workflow, data, current, hasPhotos, photos, downloads, loadingTarget, deny, onFileError } = state;
  const [params] = useSearchParams();
  const update = useQueryUpdate();
  const [decisionActions, setDecisionActions] = useState<HTMLDivElement | null>(null);
  const invalidTab = data?.id === recordId && data.definitionId === formId && !detail.query.isPlaceholderData &&
    (params.get("tab") === "photos" && !hasPhotos || params.get("tab") === "pdf" && current?.recordId === recordId && !current.documents.length);
  useEffect(() => { if (invalidTab) update({ tab: undefined }); }, [invalidTab, update]);
  if (!data) return null;
  const date = (utc: string) => formatDateTimeInZone(utc, i18n.language, detail.scope.user?.timeZoneId);
  const moments = composeWorkflowMoments(data, current);
  const canDecide = decisionAllowed && detail.scope.user?.permissions.includes("formapprovals.decide");
  const tab = ["answer", "activity", ...(hasPhotos ? ["photos"] : [])].includes(params.get("tab") ?? "") ? params.get("tab")! : params.get("tab") === "pdf" && current?.documents.length ? "pdf" : "answer";
  const refresh = async (task?: ApprovalTask) => { if (task && !await workflow.observeApproval(task)) return; void workflow.query.refetch(); onDecided?.(); };
  return <div className={canDecide && current?.task?.state === "Open" ? "max-sm:pb-20" : undefined}>
    <ol className="mb-4 space-y-3 border-b border-[var(--color-border)] pb-4">
      {moments.map(moment => {
        const state = workflowMomentState(moment);
        const Icon = state === "pending" ? ClockIcon : state === "failed" || state === "rejected" ? BanIcon : state === "uncertain" ? AlertTriangleIcon : CheckIcon;
        const iconTone = state === "completed" ? "text-[var(--color-success-700)]" : state === "failed" || state === "rejected" ? "text-[var(--color-danger-700)]" : "text-[var(--color-warning-700)]";
        return <li key={moment.key} data-moment-state={state} className={"relative border-l-2 py-1 pl-7 " + (state === "pending" ? "border-[var(--color-warning)] bg-[var(--color-warning-50)]" : "border-[var(--color-border)]")}>
        <Icon className={"absolute top-1.5 left-1 size-4 " + iconTone}/>
        {moment.kind === "received" ? <><h3 className="font-semibold">{t("responses.received")}</h3><p className="text-sm">{data.actor.displayName ?? t("responses.unknownPerson")} · {date(moment.atUtc)}</p>{moment.origin ? <p className="text-xs text-[var(--color-content-muted)]">{t(moment.origin.senderKind === "Assistant" ? "detail.originAssistant" : "detail.originManual", { name: moment.origin.senderName ?? t("responses.unknownPerson") })}</p> : null}</> : moment.kind === "effects" ? <><h3 className="font-semibold">{t("detail.events." + moment.event)}</h3><Button variant="link" size="inline" onClick={() => update({ tab: "activity" })}>{t("detail.actionsCompleted", { completed: moment.completedCount, count: moment.totalCount })}</Button>{moment.actions.some(action => action.state === "Failed" || action.state === "Uncertain" || action.recipients.some(recipient => recipient.state === "Failed" || recipient.state === "Uncertain")) ? <p className="text-xs text-[var(--color-content-muted)]">{t("detail.issues")}</p> : null}</> : <>
          <h3 id={"approval-moment-" + moment.task.id} className="font-semibold">{t("approvals.taskStates." + moment.task.state)}</h3>
          {moment.task.state === "Open" ? <p className="text-xs text-[var(--color-content-muted)]"><ActionTooltip label={date(moment.task.requestedAtUtc)}><time dateTime={moment.task.requestedAtUtc} tabIndex={0}>{formatRelativeTime(moment.task.requestedAtUtc, i18n.language)}</time></ActionTooltip></p> : null}
          {canDecide ? <><ApprovalDecisionPanel embedded statusId={"approval-moment-" + moment.task.id} taskId={moment.task.id} disabled={loadingTarget} onForbidden={onDecisionForbidden} actionsTarget={decisionActions} onDecided={refresh}/><div ref={setDecisionActions} className={moment.task.state === "Open" ? "mt-2 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:border-t max-sm:border-[var(--color-border)] max-sm:bg-[var(--color-surface)] max-sm:p-4" : undefined}/></> : <><p className="text-sm">{moment.task.roleName ?? t("responses.unknownPerson")}</p>{moment.task.decidedAtUtc ? <p className="text-sm">{t("approvals.decisionBy", { name: moment.task.decidedBy?.displayName ?? t("responses.unknownPerson"), date: date(moment.task.decidedAtUtc) })}</p> : null}{moment.task.reason ? <p className="text-sm whitespace-pre-wrap">{moment.task.reason}</p> : null}</>}
        </>}
      </li>; })}
    </ol>
    <Tabs value={tab} onValueChange={value => update({ tab: value === "answer" ? undefined : value })}>
      <TabsList aria-label={t("responses.detail")}><TabsTrigger value="answer">{t("responses.answer")}</TabsTrigger>{hasPhotos ? <TabsTrigger value="photos">{t("detail.photos")} ({photos.length})</TabsTrigger> : null}<TabsTrigger value="activity">{t("detail.activity")}</TabsTrigger>{current?.documents.length ? <TabsTrigger value="pdf">{t("detail.pdf")}</TabsTrigger> : null}</TabsList>
      <TabsContent value="answer"><ResponseAnswer record={data} actor={detail.scope.user!.id} busy={loadingTarget} photos={photos} onForbidden={deny} onError={onFileError}/></TabsContent>
      <TabsContent value="photos">{photos.length ? <FormRecordFiles actor={detail.scope.user!.id} recordId={data.id} files={photos} photo label={t("responses.photos")} number={data.number} thumbnailLimit={photos.length} viewerFiles={photos} onForbidden={deny} onError={onFileError}/> : <p className="text-sm text-[var(--color-content-muted)]">{t("responses.unanswered")}</p>}</TabsContent>
      <TabsContent value="activity" forceMount hidden={tab !== "activity"}><Surface title={t("detail.activity")} padded actions={workflow.query.data?.recordId === data.id && workflow.query.data.ruleRevision ? <span className="text-xs">{t("workflow.ruleRevision", { revision: workflow.query.data.ruleRevision })}</span> : undefined}><ResponseWorkflowHistory key={detail.scope.owner + ":" + data.id} workflow={workflow} record={data} timeZoneId={detail.scope.user?.timeZoneId}/></Surface></TabsContent>
      {current?.documents.length ? <TabsContent value="pdf"><ResponseDocuments downloads={downloads} owner={detail.scope.owner} recordId={data.id} documents={current.documents} onForbidden={deny} timeZoneId={detail.scope.user?.timeZoneId}/></TabsContent> : null}
    </Tabs>
    </div>;
}
