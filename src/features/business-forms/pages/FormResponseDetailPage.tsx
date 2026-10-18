import { useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { readErrorMessage } from "@/shared/api/errorFeedback";
import { PrivateFormFilesScopeProvider } from "@/shared/hooks/PrivateFormFilesScope";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { formatDateTimeInZone, formatRelativeTime } from "@/shared/lib/dateTime";
import { ActionTooltip } from "@/shared/ui/ActionTooltip";
import { Button } from "@/shared/ui/button";
import { AlertTriangleIcon, BanIcon, CheckIcon, ClockIcon } from "@/shared/ui/icons";
import type { ApprovalTask } from "../api/approvals";
import { approvalStateVariant } from "../approvals";
import { Badge } from "@/shared/ui/badge";
import { Spinner } from "@/shared/ui/Spinner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { FormRecordFiles } from "@/shared/ui/FormRecordFiles";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/ui/Tabs";
import { notify } from "@/shared/ui/notifications";
import { useResponseDetail, useResponseFeedback } from "../hooks/useResponseQueries";
import { ResponseWorkspaceContext } from "../hooks/useResponseWorkspace";
import { useResponseDocumentDownloads } from "../hooks/useResponseDocumentDownloads";
import { useResponseWorkflow } from "../hooks/useResponseWorkflow";
import { ResponseDocuments, ResponseDocumentDownloads } from "../components/ResponseDocuments";
import { ApprovalDecisionPanel } from "../components/ApprovalDecisionPanel";
import { ResponseWorkflowHistory } from "../components/ResponseWorkflowHistory";
import { ResponseValue } from "../components/ResponseValue";
import { ResponseAssistance, ResponseAssistanceBadges } from "../components/ResponseAssistance";
import { ResponsePanelFrame, type ResponsePanelNavigation } from "../components/ResponsePanelFrame";
import { composeWorkflowMoments, workflowMomentState } from "../workflowMoments";
function ResponsePanelFilesScope({ enabled, scope, children }: { enabled: boolean; scope: string | null; children: ReactNode }) {
  return enabled ? <PrivateFormFilesScopeProvider scope={scope}>{children}</PrivateFormFilesScopeProvider> : children;
}
export function FormResponseDetailPage({ formId, recordId, navigation, onDecided, onDecisionForbidden, retainPreviousForm = false }: {
  formId: string; recordId: string; navigation: ResponsePanelNavigation; onDecided?: () => void; onDecisionForbidden?: () => void; retainPreviousForm?: boolean;
}) {
  const { t, i18n } = useTranslation("forms");
  const detail = useResponseDetail(recordId, formId, retainPreviousForm);
  const workflow = useResponseWorkflow(formId, recordId, retainPreviousForm);
  const workspace = useContext(ResponseWorkspaceContext);
  const [params] = useSearchParams();
  const update = useQueryUpdate();
  const [decisionActions, setDecisionActions] = useState<HTMLDivElement | null>(null);
  useResponseFeedback(detail.query.isPending ? null : detail.query.error ?? workflow.error ?? navigation.error,
    "responses:detail-page:" + detail.scope.owner + ":" + formId,
    detail.query.error ? detail.query.refetch : workflow.error ? workflow.query.refetch : navigation.onRetry);
  const deny = useCallback(() => workspace?.deny(), [workspace]);
  const onFileError = useCallback((error: unknown) => notify({ id: "responses:files:" + detail.scope.owner + ":" + recordId, kind: "error", message: readErrorMessage(error, t) }), [detail.scope.owner, recordId, t]);
  const data = detail.query.data;
  const [presentedWorkflow, setPresentedWorkflow] = useState<{ owner: string; data: NonNullable<typeof workflow.query.data> } | null>(null);
  if (presentedWorkflow && (!detail.scope.allowed || presentedWorkflow.owner !== detail.scope.owner)) setPresentedWorkflow(null);
  if (detail.scope.allowed && workflow.query.data?.recordId === data?.id && workflow.query.data && presentedWorkflow?.data !== workflow.query.data) setPresentedWorkflow({ owner: detail.scope.owner, data: workflow.query.data });
  const current = workflow.query.data?.recordId === data?.id ? workflow.query.data : presentedWorkflow?.owner === detail.scope.owner && presentedWorkflow.data.recordId === data?.id ? presentedWorkflow.data : undefined;
  const hasPhotos = data?.values.some(value => value.type === "photo") ?? false;
  const invalidTab = data?.id === recordId && data.definitionId === formId && !detail.query.isPlaceholderData &&
    (params.get("tab") === "photos" && !hasPhotos || params.get("tab") === "pdf" && current?.recordId === recordId && !current.documents.length);
  useEffect(() => { if (invalidTab) update({ tab: undefined }); }, [invalidTab, update]);
  const downloads = useResponseDocumentDownloads(detail.scope.owner, recordId, deny, navigation.busy || detail.query.isPlaceholderData || data?.id !== recordId);
  const unavailable = !!data && !detail.query.isPlaceholderData && data.definitionId !== formId || detail.query.error instanceof ApiError && detail.query.error.status === 404;
  const fileScope = detail.scope.allowed && data && !unavailable ? detail.scope.owner + ":" + data.definitionId : null;
  if (!detail.scope.allowed || detail.query.error instanceof ApiError && detail.query.error.status === 403) return <ResponsePanelFilesScope enabled={retainPreviousForm} scope={null}><ResponsePanelFrame title={t("responses.detail")} navigation={navigation}><ForbiddenPage/></ResponsePanelFrame></ResponsePanelFilesScope>;
  if (!data || unavailable) return <ResponsePanelFilesScope enabled={retainPreviousForm} scope={fileScope}><ResponsePanelFrame title={t("responses.detail")} navigation={navigation}>{detail.query.isPending ? <Spinner/> : <EmptyState embedded title={t(unavailable ? "responses.unavailable" : "responses.loadFailed")} action={unavailable ? undefined : <Button variant="outline" onClick={() => void detail.query.refetch()}>{t("common:actions.retry")}</Button>}/>}</ResponsePanelFrame></ResponsePanelFilesScope>;
  const loadingTarget = navigation.busy || detail.query.isPlaceholderData || data.id !== recordId;
  const date = (utc: string) => formatDateTimeInZone(utc, i18n.language, detail.scope.user?.timeZoneId);
  const photos = data.values.filter(value => value.type === "photo").flatMap(value => Array.isArray(value.value) ? value.value : []);
  const moments = composeWorkflowMoments(data, current);
  const canDecide = detail.scope.user?.permissions.includes("formapprovals.decide");
  const tab = ["answer", "activity", ...(hasPhotos ? ["photos"] : [])].includes(params.get("tab") ?? "") ? params.get("tab")! : params.get("tab") === "pdf" && current?.documents.length ? "pdf" : "answer";
  const refresh = async (task?: ApprovalTask) => { if (task && !await workflow.observeApproval(task)) return; void workflow.query.refetch(); onDecided?.(); };
  return <ResponsePanelFilesScope enabled={retainPreviousForm} scope={fileScope}><ResponsePanelFrame title={data.number} loading={navigation.busy || detail.query.isFetching} navigation={{ ...navigation, busy: navigation.busy || loadingTarget }} status={current ? <Badge variant={approvalStateVariant(current.recordState)}>{t("approvals.states." + current.recordState)}</Badge> : null} subtitle={data.name + " · " + t("responses.versionLabel", { version: data.versionNumber })} actions={<>
    {data.origin?.conversationId && detail.scope.user?.permissions.includes("whatsapp.read") ? <Button variant="link" size="inline" asChild><Link to={"/whatsapp/chat?conversacion=" + data.origin.conversationId}>{t("responses.openChat")}</Link></Button> : null}
    {current?.documents.length ? <ResponseDocumentDownloads documents={current.documents} downloads={downloads}/> : null}
  </>}>
    <div className={canDecide && current?.task?.state === "Open" ? "max-sm:pb-20" : undefined}>
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
      <TabsContent value="answer"><dl className="divide-y divide-[var(--color-border)]">{data.values.map(value => <div key={value.fieldId} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-3"><dt className="min-w-0 break-words text-sm text-[var(--color-content-muted)]">{value.label}</dt><dd className="min-w-0 text-sm"><ResponseValue cell={{ ...value, state: value.value === null || Array.isArray(value.value) && value.value.length === 0 ? "Unanswered" : "Answered" }} actor={detail.scope.user!.id} recordId={data.id} number={data.number} label={value.label} detail viewerFiles={photos} onForbidden={deny} onError={onFileError} detailLink=""/><ResponseAssistanceBadges record={data} fieldId={value.fieldId}/></dd></div>)}</dl><ResponseAssistance key={data.id} record={data} actor={detail.scope.user!.id} busy={loadingTarget} onForbidden={deny} onError={onFileError}/></TabsContent>
      <TabsContent value="photos">{photos.length ? <FormRecordFiles actor={detail.scope.user!.id} recordId={data.id} files={photos} photo label={t("responses.photos")} number={data.number} thumbnailLimit={photos.length} viewerFiles={photos} onForbidden={deny} onError={onFileError}/> : <p className="text-sm text-[var(--color-content-muted)]">{t("responses.unanswered")}</p>}</TabsContent>
      <TabsContent value="activity" forceMount hidden={tab !== "activity"}><ResponseWorkflowHistory key={detail.scope.owner + ":" + data.id} workflow={workflow} record={data} timeZoneId={detail.scope.user?.timeZoneId}/></TabsContent>
      {current?.documents.length ? <TabsContent value="pdf"><ResponseDocuments downloads={downloads} owner={detail.scope.owner} recordId={data.id} documents={current.documents} onForbidden={deny} timeZoneId={detail.scope.user?.timeZoneId}/></TabsContent> : null}
    </Tabs>
    </div>
  </ResponsePanelFrame></ResponsePanelFilesScope>;
}
