import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useMatch, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSystemPresentation } from "@/shared/api/presentation";
import { usePagination } from "@/shared/hooks/usePagination";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { formatDateTimeInZone, formatRelativeTime } from "@/shared/lib/dateTime";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { FilterBar } from "@/shared/ui/FilterBar";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { DataTable } from "@/shared/ui/DataTable";
import { Pagination } from "@/shared/ui/Pagination";
import { Button } from "@/shared/ui/button";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Spinner } from "@/shared/ui/Spinner";
import { ResponsePanelFrame } from "../components/ResponsePanelFrame";
import { ResponseWorkspaceProvider } from "../components/ResponseWorkspaceProvider";
import { FormResponseDetailPage } from "./FormResponseDetailPage";
import { ApprovalDecisionPanel } from "../components/ApprovalDecisionPanel";
import { useResponseFeedback } from "../hooks/useResponseQueries";
import { approvalForbidden, useApprovalInbox, useApprovalScope } from "../hooks/useApprovalQueries";
import { fetchApprovalTask, fetchApprovalTasks, type ApprovalTask } from "../api/approvals";
export function ApprovalInboxPage() { const scope = useApprovalScope(); const [denied, setDenied] = useState<string | null>(null); return scope.allowed && denied !== scope.owner ? <ApprovalInbox key={scope.owner} onForbidden={() => setDenied(scope.owner)}/> : <ForbiddenPage />; }
function ApprovalInbox({ onForbidden }: {
    onForbidden: () => void;
}) {
    const { t, i18n } = useTranslation("forms");
    const [params] = useSearchParams();
    const update = useQueryUpdate();
    const presentation = useSystemPresentation();
    const pagination = usePagination(presentation.data?.defaultPageSize, true);
    const onlyMine = params.get("view") !== "all";
    const definitionId = params.get("definitionId") ?? undefined;
    const { scope, query, options, otherCount } = useApprovalInbox({ page: pagination.page, pageSize: pagination.pageSize, onlyMine, definitionId }, pagination.ready);
    const taskId = useMatch("/formularios/por-aprobar/:taskId")?.params.taskId;
    const client = useQueryClient();
    const [deniedTask, setDeniedTask] = useState<string | undefined>();
    const [readableTarget, setReadableTarget] = useState<{ taskId: string; definitionId: string; recordId: string } | null>(null);
    const key = useMemo(() => taskId === deniedTask && taskId ? ["form-approvals", scope.owner, "unavailable-task"] : ["form-approvals", scope.owner, "task", taskId], [scope.owner, taskId, deniedTask]);
    const selected = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchApprovalTask(taskId!, signal), enabled: scope.allowed && !!taskId && taskId !== deniedTask, gcTime: 0 });
    const [context, setContext] = useState<{ ids: string[]; page: number } | null>(null);
    const contextKey = [scope.owner, taskId, onlyMine, definitionId, pagination.page, pagination.pageSize].join(":");
  const [motion, setMotion] = useState<{ key: string; busy: boolean; error: unknown }>({ key: contextKey, busy: false, error: null });
  if (motion.key !== contextKey) setMotion({ key: contextKey, busy: false, error: null });
  const moving = motion.key === contextKey && motion.busy;
  const moveError = motion.key === contextKey ? motion.error : null;
  const setMoving = (busy: boolean) => setMotion(previous => ({ key: contextKey, busy, error: previous.key === contextKey ? previous.error : null }));
  const setMoveError = (error: unknown) => setMotion(previous => ({ key: contextKey, busy: previous.key === contextKey && previous.busy, error }));
    const [decisionActions, setDecisionActions] = useState<HTMLDivElement | null>(null);
    const table = useRef<HTMLDivElement | null>(null);
    const lastTask = useRef(taskId);
    const live = useRef(true);
    const moveDirection = useRef(1);
    const currentContext = useRef("");
    useLayoutEffect(() => { currentContext.current = contextKey; }, [contextKey]);
    useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
    useLayoutEffect(() => { if (taskId) lastTask.current = taskId; else if (lastTask.current) { (table.current?.querySelector<HTMLElement>('[data-task-id="' + lastTask.current + '"]') ?? table.current?.querySelector<HTMLElement>("[data-task-id]") ?? fallback.current)?.focus(); lastTask.current = undefined; } }, [taskId]);
    const ids = context?.ids ?? query.data?.items.map(task => task.id) ?? [];
    const index = taskId ? ids.indexOf(taskId) : -1;
    const open = (task: ApprovalTask) => {
      setContext({ ids: query.data?.items.map(item => item.id) ?? [], page: pagination.page });
      update({ tab: undefined }, { pathname: "/formularios/por-aprobar/" + task.id, replace: false });
    };
    const move = async (direction: number) => {
      if (moving || index < 0 || !query.data) return;
      const expected = scope.owner;
      const expectedContext = contextKey;
      moveDirection.current = direction;
      let id: string | undefined = ids[index + direction];
      let page = context?.page ?? pagination.page;
      setMoving(true); setMoveError(null);
      try {
        if (!id) {
          page += direction;
          const filter = { page, pageSize: pagination.pageSize, onlyMine, definitionId };
          const result = await client.fetchQuery({ queryKey: ["form-approvals", expected, "list", filter], queryFn: ({ signal }) => fetchApprovalTasks(filter, signal), gcTime: 0, meta: { errorOwner: "local" } });
          id = direction < 0 ? result.items.at(-1)?.id : result.items[0]?.id;
          if (live.current && currentContext.current === expectedContext) setContext({ ids: result.items.map(task => task.id), page });
        }
        if (id && live.current && currentContext.current === expectedContext) update({ page: page === 1 ? undefined : String(page), tab: undefined }, { pathname: "/formularios/por-aprobar/" + id, replace: false });
      } catch (error) { if (live.current && currentContext.current === expectedContext) setMoveError(error); }
      finally { if (live.current && currentContext.current === expectedContext) setMoving(false); }
    };
    const navigation = { previous: index > 0 || index === 0 && !!query.data?.hasPrevious, next: index >= 0 && (index < ids.length - 1 || !!query.data?.hasNext), busy: moving, onMove: (direction: number) => { void move(direction); }, onClose: () => update({ tab: undefined }, { pathname: "/formularios/por-aprobar", replace: false }), error: moveError, onRetry: () => { void move(moveDirection.current); } };
    const changeList = (changes: Record<string, string | undefined>) => { setContext(null); setMoveError(null); update({ ...changes, tab: undefined }, { pathname: "/formularios/por-aprobar" }); };
    const fallback = useRef<HTMLSelectElement | null>(null);
    const forbidden = approvalForbidden(query.error) || approvalForbidden(options.error);
    useEffect(() => { if (forbidden)
        onForbidden(); }, [forbidden, onForbidden]);
    const current = query.data?.totalCount;
    const mine = onlyMine ? current : otherCount.data?.count;
    const all = onlyMine ? otherCount.data?.count : current;
    const canRead = scope.user?.permissions.includes("formrecords.read");
    const denyTask = useCallback(() => { if (canRead && taskId && selected.data) setReadableTarget({ taskId, definitionId: selected.data.definitionId, recordId: selected.data.recordId }); setDeniedTask(taskId); }, [canRead, taskId, selected.data]);
    if (approvalForbidden(selected.error) && deniedTask !== taskId) denyTask();
    useResponseFeedback(canRead ? null : moveError, "approvals:move:" + scope.owner, navigation.onRetry);
    const target = selected.data ?? (readableTarget?.taskId === taskId ? readableTarget : undefined);
    if (forbidden) return <ForbiddenPage />;
    return <div ref={table} className="relative h-full min-h-0"><div className="h-full overflow-y-auto"><Page title={t("approvals.title")}>
  <FilterBar><SegmentedControl aria-label={t("approvals.scope")} options={[{ key: "mine", label: t("approvals.mine", { count: mine ?? 0 }), pressed: onlyMine, onSelect: () => changeList({ view: undefined, page: undefined }) }, { key: "all", label: t("approvals.all", { count: all ?? 0 }), pressed: !onlyMine, onSelect: () => changeList({ view: "all", page: undefined }) }]}/><NativeSelect ref={fallback} aria-label={t("approvals.form")} value={definitionId ?? ""} onChange={event => changeList({ definitionId: event.target.value || undefined, page: undefined })}><option value="">{t("approvals.allForms")}</option>{options.data?.forms.map(form => <option key={form.id} value={form.id}>{form.name}</option>)}</NativeSelect></FilterBar>
  {options.error || otherCount.error ? <Button variant="outline" onClick={() => { if (options.error) void options.refetch(); if (otherCount.error) void otherCount.refetch(); }}>{t("common:actions.retry")}</Button> : null}
  <Surface><DataTable columns={[
            { id: "number", header: t("responses.number"), cell: row => <Link data-task-id={row.id} className="font-medium text-[var(--color-brand-700)] underline" to={"/formularios/por-aprobar/" + row.id + "?" + params.toString()} onClick={() => setContext({ ids: query.data?.items.map(item => item.id) ?? [], page: pagination.page })}>{row.number}</Link> },
            { id: "form", header: t("formColumn"), cell: row => row.formName },
            { id: "author", header: t("responses.actor"), cell: row => row.author.displayName ?? t("responses.unknownPerson") },
            { id: "received", header: t("responses.received"), cell: row => <time dateTime={row.requestedAtUtc}>{formatDateTimeInZone(row.requestedAtUtc, i18n.language, scope.user?.timeZoneId)}</time> },
            { id: "waiting", header: t("approvals.waiting"), cell: row => formatRelativeTime(row.requestedAtUtc, i18n.language) },
            { id: "role", header: t("approvals.role"), cell: row => <div>{row.role.name}{row.cannotDecideReason === "OwnResponse" ? <p className="text-xs text-[var(--color-content-muted)]">{t("approvals.ownResponse")}</p> : null}</div> }
        ]} rows={query.data?.items ?? []} rowKey={row => row.id} selectedRowKey={taskId} onRowClick={open} isLoading={query.isPending} hasData={!!query.data} error={query.error ? t("approvals.loadFailed") : undefined} onRetry={() => void query.refetch()} emptyTitle={t("approvals.empty")} emptyDescription={t("approvals.emptyHint")}/>{query.data ? <Pagination {...query.data} onPageChange={page => changeList({ page: page === 1 ? undefined : String(page) })} onPageSizeChange={size => changeList({ pageSize: String(size), page: undefined })}/> : null}</Surface>
 </Page></div>
 {taskId ? target && canRead ? <ResponseWorkspaceProvider key={scope.owner + ":" + target.definitionId} owner={scope.owner} formId={target.definitionId}><FormResponseDetailPage key={scope.owner + ":" + target.definitionId} formId={target.definitionId} recordId={target.recordId} onDecisionForbidden={denyTask} navigation={navigation} onDecided={() => { void query.refetch(); }}/></ResponseWorkspaceProvider> : <ResponsePanelFrame title={selected.data?.number ?? t("responses.detail")} subtitle={selected.data?.formName} navigation={navigation}>{deniedTask === taskId ? <p role="status">{t("approvals.noPermission")}</p> : selected.data ? <div className={selected.data.state === "Open" ? "max-sm:pb-20" : undefined}><ApprovalDecisionPanel taskId={taskId} actionsTarget={decisionActions} onForbidden={denyTask} onDecided={() => { void query.refetch(); }}/><div ref={setDecisionActions} className={selected.data.state === "Open" ? "mt-3 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-30 max-sm:border-t max-sm:border-[var(--color-border)] max-sm:bg-[var(--color-surface)] max-sm:p-4" : undefined}/></div> : selected.isPending ? <Spinner/> : <Button variant="outline" onClick={() => void selected.refetch()}>{t("common:actions.retry")}</Button>}</ResponsePanelFrame> : null}
 </div>;
}
