import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { responseFullPath } from "../responseNavigationPaths";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { Page } from "@/shared/ui/Page";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { ApiError } from "@/shared/api/ApiError";
import { Button } from "@/shared/ui/button";
import { DataTable } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Pagination } from "@/shared/ui/Pagination";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { fetchApprovalTask, type ApprovalTask } from "../api/approvals";
import { approvalForbidden } from "../hooks/useApprovalQueries";
import { useFormPendingApprovals } from "../hooks/useFormPendingApprovals";
import { useResponseFeedback, useResponseScope } from "../hooks/useResponseQueries";
import { usePendingApprovalNavigation } from "../hooks/usePendingApprovalNavigation";
import { useResponseWorkspace } from "../hooks/useResponseWorkspace";
import { FormResponseDetailPage } from "../pages/FormResponseDetailPage";
import { ApprovalDecisionPanel } from "./ApprovalDecisionPanel";
import { ResponsePanelFrame } from "./ResponsePanelFrame";

export function FormPendingApprovals({ formId, onDecided, standalone = false }: { formId: string; onDecided?: () => void; standalone?: boolean }) {
  const { t, i18n } = useTranslation("forms");
  const [params] = useSearchParams();
  const update = useQueryUpdate();
  const location = useLocation();
  const navigate = useNavigate();
  const mobile = useMediaQuery("(width < 640px)");
  const page = Math.max(1, Number(params.get("approvalPage") ?? 1) || 1);
  const pageSize = Math.max(1, Number(params.get("approvalPageSize") ?? 20) || 20);
  const taskId = params.get("approval") ?? undefined;
  const { scope, query, deny, forbidden } = useFormPendingApprovals(formId, page, pageSize, taskId);
  const workspace = useResponseWorkspace(formId);
  const readScope = useResponseScope();
  const table = useRef<HTMLElement | null>(null);
  const previousTask = useRef(taskId);
  const [observedRecord, setObservedRecord] = useState<{ owner: string; formId: string; taskId: string; recordId: string } | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [decisionActions, setDecisionActions] = useState<HTMLDivElement | null>(null);
  const selected = useQuery({ queryKey: ["form-approvals", scope.owner, "task", taskId],
    queryFn: ({ signal }) => fetchApprovalTask(taskId!, signal),
    enabled: scope.allowed && !!taskId, gcTime: 0, meta: { errorOwner: "local" },
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === scope.owner && previousQuery.queryKey[2] === "task" ? previous : undefined });
  if (approvalForbidden(selected.error) && !forbidden) deny();
  const pendingSearch = useCallback((id: string, nextPage = page) => {
    const next = new URLSearchParams(params);
    next.set("approval", id); next.delete("tab");
    if (nextPage === 1) next.delete("approvalPage"); else next.set("approvalPage", String(nextPage));
    return next.toString();
  }, [params, page]);
  const captured = workspace.navigation?.origin === "pending" ? workspace.navigation.pending : undefined;
  const queue = captured;
  const motion = usePendingApprovalNavigation({ owner: scope.owner, formId, taskId, pending: queue, allowed: scope.allowed,
    disabled: !query.data || query.isPlaceholderData || selected.isPlaceholderData,
    onForbidden: deny,
    onQueue: pending => { const current = workspace.navigation; if (current?.origin === "pending") workspace.setNavigation({ ...current, pending }); },
    onNavigate: (target, pending, nextPage) => {
      workspace.setNavigation({ origin: "pending", selection: { taskId: target.id, recordId: target.recordId }, search: pendingSearch(target.id, nextPage), pending });
      update({ approval: target.id, approvalPage: nextPage === 1 ? undefined : String(nextPage) }, { pathname: "/formularios/" + formId + "/respuestas", replace: true });
    },
  });
  const task = selected.data?.definitionId === formId ? selected.data : undefined;
  if (readScope.allowed && scope.allowed && !forbidden && task && task.id === taskId && !selected.isPlaceholderData) {
    if (observedRecord?.owner !== scope.owner || observedRecord.formId !== formId || observedRecord.taskId !== taskId || observedRecord.recordId !== task.recordId)
      setObservedRecord({ owner: scope.owner, formId, taskId: task.id, recordId: task.recordId });
  } else if (observedRecord && (!readScope.allowed || !taskId || observedRecord.owner !== scope.owner || observedRecord.formId !== formId || observedRecord.taskId !== taskId)) {
    setObservedRecord(null);
  }
  const taskNavigationReady = !!task && !!captured?.tasks.some(item => item.id === taskId && item.recordId === task.recordId);
  useLayoutEffect(() => {
    if (!scope.allowed || forbidden || taskNavigationReady || !taskId || task?.id !== taskId ||
      !query.data || query.isPlaceholderData || selected.isPlaceholderData) return;
    workspace.setNavigation({ origin: "pending", selection: { taskId: task.id, recordId: task.recordId }, search: pendingSearch(task.id),
      pending: { tasks: query.data.items.map(item => ({ id: item.id, recordId: item.recordId, requestedAtUtc: item.requestedAtUtc })), page: query.data.page, pageSize: query.data.pageSize, totalCount: query.data.totalCount } });
  }, [readScope.allowed, scope.allowed, forbidden, taskNavigationReady, taskId, task, query.data, query.isPlaceholderData, selected.isPlaceholderData, workspace, pendingSearch]);
  const busy = motion.busy || selected.isPlaceholderData;
  const navigation = { selectionId: taskId, focusRequest, previous: motion.previous, next: motion.next, busy,
    position: motion.position, count: motion.count, kind: "pending" as const,
    onMove: (direction: number) => { void motion.move(direction); },
    onClose: () => {
      const reference = queue?.tasks.find(task => task.id === taskId);
      const source = workspace.navigation;
      if (source?.origin === "pending" && reference)
        workspace.setNavigation({ ...source, selection: { taskId: reference.id, recordId: reference.recordId }, search: params.toString() });
      update({ approval: undefined, tab: undefined }, { replace: false });
    }, error: motion.error, onRetry: motion.retry };
  useLayoutEffect(() => {
    if (taskId) previousTask.current = taskId;
    else if (previousTask.current) {
      (table.current?.querySelector<HTMLElement>('[data-pending-task="' + previousTask.current + '"]') ?? table.current)?.focus();
      previousTask.current = undefined;
    }
  }, [taskId]);
  const remember = (task: ApprovalTask) => workspace.setNavigation({ origin: "pending", selection: { taskId: task.id, recordId: task.recordId },
    search: pendingSearch(task.id), pending: { tasks: query.data?.items.map(item => ({ id: item.id, recordId: item.recordId, requestedAtUtc: item.requestedAtUtc })) ?? [], page, pageSize, totalCount: query.data?.totalCount ?? 0 } });
  const full = mobile && readScope.allowed;
  const open = (task: ApprovalTask) => { remember(task); if (full) { workspace.prepareFull(task.recordId); navigate(responseFullPath(formId, task.recordId, params.toString())); return; } if (task.id === taskId) setFocusRequest(value => value + 1); update({ approval: task.id, tab: undefined }, { pathname: "/formularios/" + formId + "/respuestas", replace: false }); };
  const refresh = () => { onDecided?.(); };
  useLayoutEffect(() => {
    if (location.pathname !== "/formularios/" + formId + "/respuestas" || taskId || workspace.fullEntry?.locationKey === null || !workspace.fullEntry || workspace.navigation?.origin !== "pending" || !query.data || query.isPlaceholderData) return;
    const target = workspace.navigation.selection.taskId;
    (table.current?.querySelector<HTMLElement>('[data-pending-task="' + target + '"]') ?? table.current)?.focus();
    workspace.finishFull();
  }, [location.pathname, formId, taskId, workspace, query.data, query.isPlaceholderData]);
  useLayoutEffect(() => { if (forbidden && workspace.navigation?.origin === "pending") workspace.setNavigation(null); }, [forbidden, workspace]);
  useResponseFeedback(approvalForbidden(query.error) ? null : query.error, "approvals:form:" + scope.owner + ":" + formId, query.refetch);
  const selectionError = selected.error ?? motion.error;
  const taskMissing = selected.error instanceof ApiError && selected.error.status === 404;
  useResponseFeedback(approvalForbidden(selectionError) ? null : selectionError, "approvals:form-selection:" + scope.owner + ":" + formId, motion.error ? motion.retry : selected.refetch);
  const title = query.data?.items[0]?.formName ?? task?.formName ?? t("overview.pendingColumn");
  const present = (content: ReactNode) => standalone ? <PendingFormPage title={title}>{content}</PendingFormPage> : content;
  if (forbidden) {
    const recordId = taskId && observedRecord?.taskId === taskId && readScope.allowed && observedRecord?.owner === scope.owner && observedRecord.formId === formId ? observedRecord.recordId : undefined;
    return present(<><Surface title={t("overview.pendingColumn")} padded><p role="status">{t("approvals.noPermission")}</p></Surface>
      {recordId ? <FormResponseDetailPage formId={formId} recordId={recordId} decisionAllowed={false} navigation={{ selectionId: recordId, previous: false, next: false, kind: "sheet", onMove: () => {}, onClose: navigation.onClose }}/> : null}</>);
  }
  if (!scope.allowed) return null;
  return present(<><div className="mb-4" ref={node => { table.current = node; }} tabIndex={-1}>
    <Surface title={query.data ? t("overview.pendingTitle", { count: query.data.totalCount }) : t("overview.pendingColumn")}>
      <DataTable columns={[
        { id: "number", header: t("responses.number"), cell: row => row.number },
        { id: "author", header: t("responses.actor"), cell: row => row.author.displayName ?? t("responses.unknownPerson") },
        { id: "received", header: t("responses.received"), cell: row => formatDateTimeInZone(row.requestedAtUtc, i18n.language, scope.user?.timeZoneId) },
        { id: "role", header: t("approvals.role"), cell: row => row.role.name },
        { id: "review", header: t("actionsColumn"), cell: row => <Button variant="link" size="inline" asChild><Link data-pending-task={row.id} aria-label={t("overview.review") + " " + row.number} to={full ? responseFullPath(formId, row.recordId, params.toString()) : "/formularios/" + formId + "/respuestas?" + pendingSearch(row.id)}
          onClick={event => { if (!event.defaultPrevented && event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { remember(row); if (full) workspace.prepareFull(row.recordId); if (row.id === taskId) setFocusRequest(value => value + 1); } }}>{t("overview.review")}</Link></Button> },
      ]} rows={query.data?.items ?? []} rowKey={row => row.id} selectedRowKey={taskId ?? (workspace.navigation?.origin === "pending" ? workspace.navigation.selection.taskId : undefined)} onRowClick={open}
        isLoading={query.isPending} hasData={!!query.data} error={query.error ? t("approvals.loadFailed") : undefined} onRetry={() => void query.refetch()}
        emptyTitle={t("overview.noPending")} emptyDescription={t("approvals.emptyHint")}/>
      {query.data && query.data.totalPages > 1 ? <Pagination {...query.data} onPageChange={next => update({ approvalPage: next === 1 ? undefined : String(next), approval: undefined })} onPageSizeChange={size => update({ approvalPageSize: String(size), approvalPage: undefined, approval: undefined })}/> : null}
    </Surface>
  </div>
  {taskId ? task && readScope.allowed ? taskNavigationReady || !mobile ? <FormResponseDetailPage formId={formId} recordId={task.recordId} navigation={navigation} onDecided={refresh} onDecisionForbidden={deny}/> : <Spinner/> :
    <ResponsePanelFrame title={task?.number ?? t("responses.detail")} subtitle={task?.formName} navigation={navigation} loading={busy}>
      {approvalForbidden(selected.error) ? <p role="status">{t("approvals.noPermission")}</p> : task ? <div className={task.state === "Open" ? "max-sm:pb-20" : undefined}>
        <ApprovalDecisionPanel taskId={task.id} disabled={busy} actionsTarget={decisionActions} onDecided={refresh} onForbidden={deny}/>
        <div ref={setDecisionActions} className={task.state === "Open" ? "mt-3 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:border-t max-sm:border-[var(--color-border)] max-sm:bg-[var(--color-surface)] max-sm:p-4" : undefined}/>
      </div> : selected.isPending ? <Spinner/> : <EmptyState embedded title={t(selected.error && !taskMissing ? "approvals.loadFailed" : "responses.unavailable")} action={selected.error && !taskMissing ? <Button variant="outline" onClick={() => void selected.refetch()}>{t("common:actions.retry")}</Button> : undefined}/>}
    </ResponsePanelFrame> : null}
  </>);
}

function PendingFormPage({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation("forms");
  useBreadcrumbLeaf(title);
  return <div className="relative h-full min-h-0"><Page title={title} backTo={{ to: "/formularios/respuestas", label: t("overview.title") }}>{children}</Page></div>;
}
