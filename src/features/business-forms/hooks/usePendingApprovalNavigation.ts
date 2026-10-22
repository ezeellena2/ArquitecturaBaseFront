import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isCancelledError, useQueryClient } from "@tanstack/react-query";
import { fetchApprovalContinuation, type ApprovalContinuationDirection } from "../api/approvals";
import { approvalForbidden } from "./useApprovalQueries";
import type { PendingApprovalNavigation } from "./useResponseWorkspace";

type PendingReference = PendingApprovalNavigation["tasks"][number];
export function usePendingApprovalNavigation({ owner, formId, taskId, pending, allowed, disabled, onForbidden, onNavigate, onQueue }: {
  owner: string; formId: string; taskId?: string; pending?: PendingApprovalNavigation; allowed: boolean; disabled: boolean;
  onForbidden: () => void;
  onNavigate: (task: PendingReference, queue: PendingApprovalNavigation, returnPage: number) => void;
  onQueue: (queue: PendingApprovalNavigation) => void;
}) {
  const client = useQueryClient();
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const key = [owner, formId, taskId ?? "", allowed].join(":");
  const current = useRef({ key, pending, onForbidden, onNavigate, onQueue });
  useLayoutEffect(() => { current.current = { key, pending, onForbidden, onNavigate, onQueue }; });
  useEffect(() => () => {
    const queryKey = ["form-approvals", owner, "continuation", formId, taskId];
    void client.cancelQueries({ queryKey });
    client.removeQueries({ queryKey });
  }, [client, owner, formId, taskId, allowed]);
  const [motion, setMotion] = useState<{ key: string; busy: boolean; error: unknown }>({ key, busy: false, error: null });
  const inFlight = useRef<string | null>(null);
  const lastDirection = useRef(1);
  const index = taskId ? pending?.tasks.findIndex(task => task.id === taskId) ?? -1 : -1;
  const offset = pending?.offset ?? ((pending?.page ?? 1) - 1) * (pending?.pageSize ?? 20);
  const previous = index >= 0 && (index > 0 || (pending?.hasPrevious ?? offset > 0));
  const next = index >= 0 && (index < (pending?.tasks.length ?? 0) - 1 || (pending?.hasNext ?? offset + (pending?.tasks.length ?? 0) < (pending?.totalCount ?? 0)));
  const busy = motion.key === key && motion.busy;
  const move = async (step: number) => {
    if (!allowed || disabled || busy || inFlight.current === key || !pending || !taskId || index < 0 || !(step < 0 ? previous : next)) return;
    const expected = key;
    inFlight.current = expected; lastDirection.current = step;
    setMotion({ key: expected, busy: true, error: null });
    const isCurrent = () => live.current && current.current.key === expected;
    try {
      let queue = pending;
      let target = queue.tasks[index + step];
      if (!target) {
        const direction: ApprovalContinuationDirection = step < 0 ? "Previous" : "Next";
        const query = { definitionId: formId, direction, pageSize: pending.pageSize };
        const result = await client.fetchQuery({ queryKey: ["form-approvals", owner, "continuation", formId, taskId, direction, pending.pageSize],
          queryFn: ({ signal }) => fetchApprovalContinuation(taskId, query, signal), gcTime: 0, staleTime: 0, retry: false, meta: { errorOwner: "local" } });
        if (!isCurrent()) return;
        const latest = current.current.pending;
        if (!latest || !latest.tasks.some(task => task.id === taskId)) return;
        const references = result.items.map(item => ({ id: item.task.id, recordId: item.task.recordId, requestedAtUtc: item.task.requestedAtUtc, position: item.position }));
        const additions = references.filter(task => !latest.tasks.some(observed => observed.id === task.id));
        const observed = latest.tasks.map(task => {
          const update = references.find(item => item.id === task.id);
          return update ? { ...task, position: update.position } : task;
        });
        const merged = [...observed, ...additions].sort(compareReferences);
        const base = latest.offset ?? (latest.page - 1) * latest.pageSize;
        queue = { ...latest, tasks: merged,
          offset: step < 0 ? base - additions.length : base,
          ...(step < 0 ? { hasPrevious: result.hasMore } : { hasNext: result.hasMore }) };
        target = queue.tasks[queue.tasks.findIndex(task => task.id === taskId) + step];
        current.current.onQueue(queue);
      }
      if (target && isCurrent()) {
        const targetIndex = queue.tasks.findIndex(task => task.id === target.id);
        const capturedPosition = (queue.offset ?? (queue.page - 1) * queue.pageSize) + targetIndex + 1;
        current.current.onNavigate(target, queue, Math.ceil((target.position ?? capturedPosition) / queue.pageSize));
      }
    } catch (error) {
      if (isCancelledError(error) || error instanceof Error && error.name === "AbortError") return;
      if (isCurrent()) {
        if (approvalForbidden(error)) current.current.onForbidden();
        else setMotion({ key: expected, busy: false, error });
      }
    } finally {
      if (inFlight.current === expected) inFlight.current = null;
      if (isCurrent()) setMotion(value => ({ ...value, busy: false }));
    }
  };
  return { previous, next, position: index >= 0 ? offset + index + 1 : undefined, count: pending?.totalCount,
    busy, error: motion.key === key ? motion.error : null, move, retry: () => { void move(lastDirection.current); } };
}

function compareReferences(first: PendingReference, second: PendingReference) {
  const timestamp = (value: string) => {
    const [utc, fraction = ""] = value.slice(0, -1).split(".");
    return utc + "." + fraction.padEnd(7, "0");
  };
  const firstTime = timestamp(first.requestedAtUtc), secondTime = timestamp(second.requestedAtUtc);
  if (firstTime !== secondTime) return firstTime < secondTime ? -1 : 1;
  const firstId = first.id.toLowerCase(), secondId = second.id.toLowerCase();
  return firstId === secondId ? 0 : firstId < secondId ? -1 : 1;
}
