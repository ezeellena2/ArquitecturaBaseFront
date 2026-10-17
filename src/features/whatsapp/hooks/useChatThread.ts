import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ApiError } from "@/shared/api/ApiError";
import { getThread, markRead, type Thread } from "../api/chat";
import { mergeMessages } from "../lib/history";
import { withoutFormReplyValues } from "../lib/threadPrivacy";
import { createFormReplyReadGate } from "./formReplyReadGate";
import { chatReadScopeKey, useChatReadCleanup, type ChatReadScope } from "./useChatReadScope";

export function useVisibleChat() {
  const [visible, setVisible] = useState(document.visibilityState !== "hidden");
  useEffect(() => {
    const show = () => setVisible(document.visibilityState !== "hidden");
    const hide = () => setVisible(false);
    document.addEventListener("visibilitychange", show);
    window.addEventListener("focus", show);
    window.addEventListener("blur", hide);
    return () => { document.removeEventListener("visibilitychange", show); window.removeEventListener("focus", show); window.removeEventListener("blur", hide); };
  }, []);
  return visible;
}

export function useChatThread(id: string, scope: ChatReadScope, atBottom: boolean) {
  const client = useQueryClient();
  const visible = useVisibleChat();
  const root = [...chatReadScopeKey(scope), "conversation", id] as const;
  useChatReadCleanup(root);
  const scopeStamp = JSON.stringify(root);
  const [deniedScope, setDeniedScope] = useState<string>();
  const forbiddenRead = useMemo(() => new ApiError(403, {}), []);
  const enabled = scope.permissions.includes("whatsapp.read") && deniedScope !== scopeStamp;
  const gate = useMemo(() => createFormReplyReadGate(scopeStamp), [scopeStamp]);
  // A server revocation changes this external snapshot synchronously, before the query observer's deferred notification.
  const allowed = useSyncExternalStore(gate.subscribe, gate.getSnapshot, () => false);
  const canReadRecords = scope.permissions.includes("formrecords.read");
  function receive(result: Thread, signal: AbortSignal, source: "latest" | "older", revision: number) {
    signal.throwIfAborted();
    const previouslyAllowed = gate.getSnapshot();
    if (!canReadRecords || result.canReadFormRecords !== true) {
      if (gate.deny()) {
        // A late older response must not restore private data through cancellation rollback.
        if (source === "latest") void client.cancelQueries({ queryKey: [...root, "older"] }, { revert: false });
      }
      const olderKey = [...root, "older"];
      client.setQueryData<InfiniteData<Thread>>(olderKey, data => data
        ? { ...data, pages: data.pages.map(withoutFormReplyValues) } : undefined);
      client.setQueryData<Thread>([...root, "thread"], data => data ? withoutFormReplyValues(data) : undefined);
    } else if (source === "latest" && revision === gate.revision) {
      gate.grant(revision);
    }
    if (previouslyAllowed !== gate.getSnapshot()) gate.notify();
    return gate.getSnapshot() && revision === gate.revision ? result : withoutFormReplyValues(result);
  }
  const latest = useQuery({ queryKey: [...root, "thread"], enabled, queryFn: async ({ signal }) => {
    const revision = gate.revision;
    const result = await getThread(id, undefined, signal);
    return receive(result, signal, "latest", revision);
  },
    refetchInterval: query => query.state.error instanceof ApiError && query.state.error.status === 403 ? false : visible ? 5000 : false,
    refetchOnWindowFocus: true });
  const history = useInfiniteQuery({ queryKey: [...root, "older"], enabled: false,
    initialPageParam: latest.data?.beforeAtUtc && latest.data.beforeId ? { at: latest.data.beforeAtUtc, id: latest.data.beforeId } : undefined,
    queryFn: async ({ pageParam, signal }) => {
      const revision = gate.revision;
      const result = await getThread(id, pageParam, signal);
      return receive(result, signal, "older", revision);
    },
    getNextPageParam: page => page.beforeAtUtc && page.beforeId ? { at: page.beforeAtUtc, id: page.beforeId } : undefined });
  const forbidden = latest.error instanceof ApiError && latest.error.status === 403 || history.error instanceof ApiError && history.error.status === 403;
  const readDenied = forbidden || deniedScope === scopeStamp;
  if (forbidden && deniedScope !== scopeStamp) setDeniedScope(scopeStamp);
  useEffect(() => {
    if (!readDenied) return;
    const queryKey: readonly unknown[] = JSON.parse(scopeStamp) as readonly unknown[];
    void client.cancelQueries({ queryKey }, { revert: false });
    client.removeQueries({ queryKey });
  }, [client, scopeStamp, readDenied]);
  const messages = useMemo(() => mergeMessages([...(history.data?.pages.map(page => allowed ? page.messages : withoutFormReplyValues(page).messages) ?? []),
    latest.data ? allowed ? latest.data.messages : withoutFormReplyValues(latest.data).messages : []]),
    [history.data?.pages, latest.data, allowed]);
  const read = useMutation({ mutationFn: (sequence: number) => markRead(id, sequence), retry: false,
    onSuccess: () => { void client.invalidateQueries({ queryKey: [...chatReadScopeKey(scope), "list"] }); } });
  const sequence = latest.data?.messages.reduce((max, message) => Math.max(max, message.inboundSequence), 0) ?? 0;
  const [readThrough, setReadThrough] = useState(0);
  useEffect(() => {
    if (!enabled || readDenied || !visible || !atBottom || !latest.data || latest.isError || read.isPending || read.isError || sequence <= readThrough) return;
    read.mutate(sequence, { onSuccess: () => setReadThrough(sequence) });
  }, [enabled, visible, atBottom, latest.data, latest.isError, sequence, readThrough, read, readDenied]);
  return { latest: { ...latest, error: readDenied ? forbiddenRead : latest.error, isError: readDenied || latest.isError, data: enabled && !readDenied && latest.data ? allowed ? latest.data : withoutFormReplyValues(latest.data) : undefined, refetch: () => enabled && !readDenied ? latest.refetch() : Promise.resolve(undefined) },
    history: { ...history, data: enabled && !readDenied && history.data ? allowed ? history.data : { ...history.data, pages: history.data.pages.map(withoutFormReplyValues) } : undefined, fetchNextPage: () => enabled && !readDenied ? history.fetchNextPage() : Promise.resolve(undefined) },
    messages: enabled && !readDenied ? messages : [], read, visible, formValuesRevoked: gate.wasGranted && !allowed };
}
