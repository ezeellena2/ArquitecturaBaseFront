import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/shared/api/ApiError";
import { getThread, markRead } from "../api/chat";
import { mergeMessages } from "../lib/history";
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
  const enabled = scope.permissions.includes("whatsapp.read");
  const latest = useQuery({ queryKey: [...root, "thread"], enabled, queryFn: async ({ signal }) => {
    const result = await getThread(id, undefined, signal);
    signal.throwIfAborted();
    return result;
  },
    refetchInterval: query => query.state.error instanceof ApiError && query.state.error.status === 403 ? false : visible ? 5000 : false,
    refetchOnWindowFocus: true });
  const history = useInfiniteQuery({ queryKey: [...root, "older"], enabled: false,
    initialPageParam: latest.data?.beforeAtUtc && latest.data.beforeId ? { at: latest.data.beforeAtUtc, id: latest.data.beforeId } : undefined,
    queryFn: async ({ pageParam, signal }) => {
      const result = await getThread(id, pageParam, signal);
      signal.throwIfAborted();
      return result;
    },
    getNextPageParam: page => page.beforeAtUtc && page.beforeId ? { at: page.beforeAtUtc, id: page.beforeId } : undefined });
  const messages = useMemo(() => mergeMessages([...(history.data?.pages.map(page => page.messages) ?? []), latest.data?.messages ?? []]),
    [history.data?.pages, latest.data?.messages]);
  const read = useMutation({ mutationFn: (sequence: number) => markRead(id, sequence), retry: false,
    onSuccess: () => { void client.invalidateQueries({ queryKey: [...chatReadScopeKey(scope), "list"] }); } });
  const sequence = latest.data?.messages.reduce((max, message) => Math.max(max, message.inboundSequence), 0) ?? 0;
  const [readThrough, setReadThrough] = useState(0);
  useEffect(() => {
    if (!enabled || !visible || !atBottom || !latest.data || latest.isError || read.isPending || read.isError || sequence <= readThrough) return;
    read.mutate(sequence, { onSuccess: () => setReadThrough(sequence) });
  }, [enabled, visible, atBottom, latest.data, latest.isError, sequence, readThrough, read]);
  return { latest: { ...latest, data: enabled ? latest.data : undefined, refetch: () => enabled ? latest.refetch() : Promise.resolve(undefined) },
    history: { ...history, data: enabled ? history.data : undefined, fetchNextPage: () => enabled ? history.fetchNextPage() : Promise.resolve(undefined) },
    messages: enabled ? messages : [], read, visible };
}
