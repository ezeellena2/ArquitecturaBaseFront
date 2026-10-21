import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { responseFullPath } from "../responseNavigationPaths";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { Page } from "@/shared/ui/Page";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { DataTable } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Pagination } from "@/shared/ui/Pagination";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { fetchApprovalTask, fetchApprovalTasks, type ApprovalPage, type ApprovalTask } from "../api/approvals";
import { approvalForbidden } from "../hooks/useApprovalQueries";
import { useFormPendingApprovals } from "../hooks/useFormPendingApprovals";
import { useResponseFeedback, useResponseScope } from "../hooks/useResponseQueries";
import { useResponsePanelNavigation } from "../hooks/useResponsePanelNavigation";
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
  const client = useQueryClient();
  const table = useRef<HTMLElement | null>(null);
  const previousTask = useRef(taskId);
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
  const queue = useMemo(() => {
    if (!captured) return undefined;
    const appended = taskId && !query.data?.items.some(task => task.id === taskId) && query.data?.page === captured.page
      ? query.data.items.filter(task => !captured.tasks.some(item => item.id === task.id)).map(task => ({ id: task.id, recordId: task.recordId })) : [];
    return appended.length ? { ...captured, tasks: [...captured.tasks, ...appended] } : captured;
  }, [captured, taskId, query.data]);
  const ids = queue?.tasks.map(task => task.id) ?? query.data?.items.map(task => task.id) ?? [];
  const navigationPage = captured?.page ?? page;
  const index = taskId ? ids.indexOf(taskId) : -1;
  const motion = useResponsePanelNavigation({ contextKey: [scope.owner, formId, taskId, page].join(":"), ids, index, page: navigationPage,
    disabled: !query.data || query.isPlaceholderData || selected.isPlaceholderData,
    loadPage: async nextPage => {
      const filter = { definitionId: formId, onlyMine: true, page: nextPage, pageSize };
      try {
        const result = await client.fetchQuery({ queryKey: ["form-approvals", scope.owner, "list", filter],
          queryFn: ({ signal }) => fetchApprovalTasks(filter, signal), gcTime: 0, meta: { errorOwner: "local" } });
        return { ids: result.items.map(task => task.id), totalCount: result.totalCount };
      } catch (error) { if (approvalForbidden(error)) deny(); throw error; }
    },
    onNavigate: (id, nextPage) => {
      const loaded = client.getQueryData<ApprovalPage>(["form-approvals", scope.owner, "list", { definitionId: formId, onlyMine: true, page: nextPage, pageSize }]);
      const nextQueue = queue?.page === nextPage ? queue : loaded ? { tasks: loaded.items.map(task => ({ id: task.id, recordId: task.recordId })), page: nextPage, pageSize, totalCount: loaded.totalCount } : undefined;
      const target = nextQueue?.tasks.find(task => task.id === id);
      if (!nextQueue || !target) return;
      workspace.setNavigation({ origin: "pending", selection: { taskId: target.id, recordId: target.recordId }, search: pendingSearch(target.id, nextPage), pending: nextQueue });
      update({ approval: id, approvalPage: nextPage === 1 ? undefined : String(nextPage), tab: undefined }, { pathname: "/formularios/" + formId + "/respuestas", replace: true });
    },
  });
  const task = selected.data?.definitionId === formId ? selected.data : undefined;
  const taskNavigationReady = workspace.navigation?.origin === "pending" && workspace.navigation.selection.taskId === taskId &&
    workspace.navigation.selection.recordId === task?.recordId && !!workspace.navigation.pending;
  useLayoutEffect(() => {
    if (!readScope.allowed || !scope.allowed || forbidden || taskNavigationReady || !taskId || task?.id !== taskId ||
      !query.data || query.isPlaceholderData || selected.isPlaceholderData) return;
    workspace.setNavigation({ origin: "pending", selection: { taskId: task.id, recordId: task.recordId }, search: pendingSearch(task.id),
      pending: { tasks: query.data.items.map(item => ({ id: item.id, recordId: item.recordId })), page: query.data.page, pageSize: query.data.pageSize, totalCount: query.data.totalCount } });
  }, [readScope.allowed, scope.allowed, forbidden, taskNavigationReady, taskId, task, query.data, query.isPlaceholderData, selected.isPlaceholderData, workspace, pendingSearch]);
  useLayoutEffect(() => {
    const current = workspace.navigation;
    if (!scope.allowed || forbidden || query.isPlaceholderData || selected.isPlaceholderData || !queue || queue === captured || !taskId ||
      current?.origin !== "pending" || current.selection.taskId !== taskId || current.selection.recordId !== task?.recordId) return;
    workspace.setNavigation({ ...current, pending: queue });
  }, [workspace, scope.allowed, forbidden, query.isPlaceholderData, selected.isPlaceholderData, queue, captured, taskId, task?.recordId]);
  const busy = motion.busy || selected.isPlaceholderData;
  const navigation = { selectionId: taskId, focusRequest, previous: index > 0 || index === 0 && (navigationPage > 1),
    next: index >= 0 && (index < ids.length - 1 || (navigationPage - 1) * pageSize + index + 1 < (queue?.totalCount ?? query.data?.totalCount ?? 0)), busy,
    position: index >= 0 ? (navigationPage - 1) * pageSize + index + 1 : undefined, count: captured?.totalCount ?? query.data?.totalCount, kind: "pending" as const,
    onMove: (direction: number) => { void motion.move(direction); },
    onClose: () => update({ approval: undefined, tab: undefined }, { replace: false }), error: motion.error, onRetry: motion.retry };
  useLayoutEffect(() => {
    if (taskId) previousTask.current = taskId;
    else if (previousTask.current) {
      (table.current?.querySelector<HTMLElement>('[data-pending-task="' + previousTask.current + '"]') ?? table.current)?.focus();
      previousTask.current = undefined;
    }
  }, [taskId]);
  const remember = (task: ApprovalTask) => workspace.setNavigation({ origin: "pending", selection: { taskId: task.id, recordId: task.recordId },
    search: pendingSearch(task.id), pending: { tasks: query.data?.items.map(item => ({ id: item.id, recordId: item.recordId })) ?? [], page, pageSize, totalCount: query.data?.totalCount ?? 0 } });
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
  useResponseFeedback(approvalForbidden(selectionError) ? null : selectionError, "approvals:form-selection:" + scope.owner + ":" + formId, motion.error ? motion.retry : selected.refetch);
  const title = query.data?.items[0]?.formName ?? task?.formName ?? t("overview.pendingColumn");
  const present = (content: ReactNode) => standalone ? <PendingFormPage title={title}>{content}</PendingFormPage> : content;
  if (forbidden) return present(<Surface title={t("overview.pendingColumn")} padded><p role="status">{t("approvals.noPermission")}</p></Surface>);
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
  {taskId ? task && readScope.allowed ? taskNavigationReady ? <FormResponseDetailPage formId={formId} recordId={task.recordId} navigation={navigation} onDecided={refresh} onDecisionForbidden={deny}/> : <Spinner/> :
    <ResponsePanelFrame title={task?.number ?? t("responses.detail")} subtitle={task?.formName} navigation={navigation} loading={busy}>
      {approvalForbidden(selected.error) ? <p role="status">{t("approvals.noPermission")}</p> : task ? <div className={task.state === "Open" ? "max-sm:pb-20" : undefined}>
        <ApprovalDecisionPanel taskId={task.id} disabled={busy} actionsTarget={decisionActions} onDecided={refresh} onForbidden={deny}/>
        <div ref={setDecisionActions} className={task.state === "Open" ? "mt-3 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:border-t max-sm:border-[var(--color-border)] max-sm:bg-[var(--color-surface)] max-sm:p-4" : undefined}/>
      </div> : selected.isPending ? <Spinner/> : <EmptyState embedded title={t("responses.unavailable")}/>}
    </ResponsePanelFrame> : null}
  </>);
}

function PendingFormPage({ title, children }: { title: string; children: ReactNode }) {
  const { t } = useTranslation("forms");
  useBreadcrumbLeaf(title);
  return <div className="relative h-full min-h-0"><Page title={title} backTo={{ to: "/formularios/respuestas", label: t("overview.title") }}>{children}</Page></div>;
}
