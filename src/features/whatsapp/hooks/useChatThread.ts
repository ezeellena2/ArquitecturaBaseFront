import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ApiError } from "@/shared/api/ApiError";
import { chatKey, getThread, markRead } from "../api/chat";
import { mergeMessages } from "../lib/history";

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

export function useChatThread(id: string, actor: string, atBottom: boolean) {
  const client = useQueryClient();
  const visible = useVisibleChat();
  const latest = useQuery({ queryKey: [...chatKey, actor, "thread", id], queryFn: ({ signal }) => getThread(id, undefined, signal),
    refetchInterval: query => query.state.error instanceof ApiError && query.state.error.status === 403 ? false : visible ? 5000 : false,
    refetchOnWindowFocus: true });
  const history = useInfiniteQuery({ queryKey: [...chatKey, actor, "older", id], enabled: false,
    initialPageParam: latest.data?.beforeAtUtc && latest.data.beforeId ? { at: latest.data.beforeAtUtc, id: latest.data.beforeId } : undefined,
    queryFn: ({ pageParam, signal }) => getThread(id, pageParam, signal),
    getNextPageParam: page => page.beforeAtUtc && page.beforeId ? { at: page.beforeAtUtc, id: page.beforeId } : undefined });
  const messages = useMemo(() => mergeMessages([...(history.data?.pages.map(page => page.messages) ?? []), latest.data?.messages ?? []]),
    [history.data?.pages, latest.data?.messages]);
  const read = useMutation({ mutationFn: (sequence: number) => markRead(id, sequence), retry: false,
    onSuccess: () => { void client.invalidateQueries({ queryKey: [...chatKey, actor, "list"] }); } });
  const sequence = latest.data?.messages.reduce((max, message) => Math.max(max, message.inboundSequence), 0) ?? 0;
  const [readThrough, setReadThrough] = useState(0);
  useEffect(() => {
    if (!visible || !atBottom || !latest.data || latest.isError || read.isPending || read.isError || sequence <= readThrough) return;
    read.mutate(sequence, { onSuccess: () => setReadThrough(sequence) });
  }, [visible, atBottom, latest.data, latest.isError, sequence, readThrough, read]);
  return { latest, history, messages, read, visible };
}
