import { useLayoutEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchResponseRecordNavigation } from "../api/responses";
import { fetchApprovalTasks, type ApprovalPage } from "../api/approvals";
import { responseQueryFromParams } from "./useResponseRouteQuery";
import { useSystemPresentation } from "@/shared/api/presentation";
import { useResponseScope } from "./useResponseQueries";
import { useResponseWorkspace } from "./useResponseWorkspace";
import { useFormPendingApprovals } from "./useFormPendingApprovals";
import { approvalForbidden } from "./useApprovalQueries";
import { useResponsePanelNavigation } from "./useResponsePanelNavigation";
import { responseFullPath, responseSheetPath } from "../responseNavigationPaths";

export function useFullResponseNavigation(formId: string, recordId: string) {
  const workspace = useResponseWorkspace(formId);
  const scope = useResponseScope();
  const [params] = useSearchParams();
  const presentation = useSystemPresentation();
  const query = responseQueryFromParams(params, workspace.filter, 1, presentation.data?.defaultPageSize);
  const navigate = useNavigate();
  const client = useQueryClient();
  const source = workspace.navigation;
  const pendingSource = source?.origin === "pending" ? source.pending : undefined;
  const taskId = source?.origin === "pending" ? source.selection.taskId : undefined;
  const pending = useFormPendingApprovals(formId, pendingSource?.page ?? 1, pendingSource?.pageSize ?? 20, taskId, !!pendingSource);
  const appended = useMemo(() => pendingSource && taskId && !pending.query.isPlaceholderData && pending.query.data?.page === pendingSource.page &&
    !pending.query.data.items.some(task => task.id === taskId)
    ? pending.query.data.items.filter(task => !pendingSource.tasks.some(item => item.id === task.id)).map(task => ({ id: task.id, recordId: task.recordId })) : [], [pendingSource, taskId, pending.query.data, pending.query.isPlaceholderData]);
  useLayoutEffect(() => {
    if (pending.forbidden && source?.origin === "pending") workspace.setNavigation(null);
    else if (appended.length && source?.selection.recordId === recordId && pendingSource)
      workspace.setNavigation({ ...source, pending: { ...pendingSource, tasks: [...pendingSource.tasks, ...appended] } });
  }, [appended, pending.forbidden, pendingSource, recordId, source, workspace]);
  const anchor = useQuery({ queryKey: ["form-responses", scope.owner, "record-navigation", formId, recordId, query],
    queryFn: ({ signal }) => fetchResponseRecordNavigation(formId, recordId, query, signal),
    enabled: scope.allowed && presentation.isSuccess && !pendingSource, gcTime: 0, meta: { errorOwner: "local" } });
  const anchorData = anchor.data?.recordId.toLowerCase() === recordId.toLowerCase() ? anchor.data : undefined;
  const search = source?.search ?? params.toString();
  useLayoutEffect(() => {
    if (pendingSource || !anchorData || !source || source.selection.recordId !== recordId) return;
    const params = new URLSearchParams(source.search);
    const pageSize = Number(params.get("pageSize")) || query.pageSize;
    const page = Math.ceil(anchorData.position / pageSize);
    if (page === 1) params.delete("page"); else params.set("page", String(page));
    if (params.toString() !== source.search) workspace.setNavigation({ ...source, search: params.toString() });
  }, [anchorData, pendingSource, recordId, query.pageSize, source, workspace]);
  const open = (nextRecordId: string, nextSearch: string) => {
    workspace.prepareFull(nextRecordId);
    navigate(responseFullPath(formId, nextRecordId, nextSearch), { replace: true });
  };
  const ids = pendingSource?.tasks.map(task => task.id) ?? [];
  const index = taskId ? ids.indexOf(taskId) : -1;
  const motion = useResponsePanelNavigation({ contextKey: [scope.owner, formId, recordId, taskId].join(":"), ids, index,
    page: pendingSource?.page ?? 1, disabled: !pendingSource || !pending.scope.allowed || pending.query.isPlaceholderData,
    loadPage: async page => {
      const filter = { definitionId: formId, onlyMine: true, page, pageSize: pendingSource!.pageSize };
      try {
        const result = await client.fetchQuery({ queryKey: ["form-approvals", pending.scope.owner, "list", filter],
          queryFn: ({ signal }) => fetchApprovalTasks(filter, signal), gcTime: 0, meta: { errorOwner: "local" } });
        return { ids: result.items.map(task => task.id), totalCount: result.totalCount };
      } catch (error) { if (approvalForbidden(error)) pending.deny(); throw error; }
    },
    onNavigate: (id, page) => {
      if (!pendingSource || !source) return;
      const loaded = client.getQueryData<ApprovalPage>(["form-approvals", pending.scope.owner, "list", { definitionId: formId, onlyMine: true, page, pageSize: pendingSource.pageSize }]);
      const queue = page === pendingSource.page ? pendingSource : loaded ? { tasks: loaded.items.map(task => ({ id: task.id, recordId: task.recordId })), page, pageSize: pendingSource.pageSize, totalCount: loaded.totalCount } : undefined;
      const target = queue?.tasks.find(task => task.id === id);
      if (!queue || !target) return;
      const params = new URLSearchParams(search); params.set("approval", target.id);
      if (page === 1) params.delete("approvalPage"); else params.set("approvalPage", String(page));
      workspace.setNavigation({ origin: "pending", selection: { recordId: target.recordId, taskId: target.id }, search: params.toString(), pending: queue });
      open(target.recordId, params.toString());
    } });
  const move = (direction: number) => {
    if (pendingSource) { void motion.move(direction); return; }
    const target = direction < 0 ? anchorData?.previousId : anchorData?.nextId;
    if (!target || anchor.isFetching) return;
    workspace.setNavigation({ origin: "sheet", selection: { recordId: target }, search });
    open(target, search);
  };
  const position = pendingSource && index >= 0 ? (pendingSource.page - 1) * pendingSource.pageSize + index + 1 : anchorData?.position;
  const pendingError = motion.error ?? pending.query.error;
  return {
    kind: pendingSource ? "pending" as const : "sheet" as const,
    previous: pendingSource ? index > 0 || index === 0 && pendingSource.page > 1 : !!anchorData?.previousId,
    next: pendingSource ? index >= 0 && (index < ids.length - 1 || (position ?? 0) < pendingSource.totalCount) : !!anchorData?.nextId,
    position, count: pendingSource?.totalCount ?? anchorData?.totalCount,
    busy: pendingSource ? motion.busy : anchor.isFetching,
    error: pendingSource ? approvalForbidden(pendingError) ? null : pendingError : anchor.error,
    onRetry: pendingSource ? motion.error ? motion.retry : pending.query.refetch : anchor.refetch,
    onMove: move, backTo: responseSheetPath(formId, search),
    decisionDenied: pending.forbidden, denyDecision: pending.deny,
    refreshPending: () => { if (pendingSource) void pending.query.refetch(); },
  };
}