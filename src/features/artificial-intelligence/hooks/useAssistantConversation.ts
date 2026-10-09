import { useEffect } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { assistantApi, type AssistantTurn } from "../api/assistant";
import { assistantKey, isActiveTurn } from "../assistant/model";
export function useAssistantConversation(
  userId: string,
  conversationId: string | undefined,
  acceptedRequestId: string | undefined,
  language: string,
  permissionsVersion: string,
) {
  const client = useQueryClient();
  const key = assistantKey(userId);
  const conversation = useQuery({
    queryKey: [
      ...key,
      "conversation",
      conversationId,
      language,
      permissionsVersion,
    ],
    queryFn: ({ signal }) => assistantApi.conversation(conversationId!, signal),
    enabled: !!conversationId,
    staleTime: 0,
    gcTime: 60000,
  });
  const requestId =
    conversation.data?.activeRequestId ?? acceptedRequestId ?? undefined;
  const turn = useQuery({
    queryKey: [...key, "turn", requestId, language, permissionsVersion],
    queryFn: ({ signal }) => assistantApi.turn(requestId!, signal),
    enabled: !!requestId,
    staleTime: 0,
    gcTime: 60000,
    refetchInterval: (query) =>
      query.state.error
        ? false
        : isActiveTurn(query.state.data)
          ? Math.max(1, query.state.data?.pollingAfterSeconds ?? 2) * 1000
          : false,
    refetchIntervalInBackground: false,
  });
  const blocked =
    conversation.data?.contentAccess === "blocked" ||
    conversation.data?.contentAccess === "expired" ||
    turn.data?.contentAccess === "blocked";
  const history = useInfiniteQuery({
    queryKey: [...key, "turns", conversationId, language, permissionsVersion],
    queryFn: ({ signal, pageParam }) =>
      assistantApi.turns(conversationId!, pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (page) => (page.hasNext ? page.page + 1 : undefined),
    enabled: !!conversationId && !blocked,
    staleTime: 0,
    gcTime: 60000,
  });
  useEffect(() => {
    if (!conversationId) return;
    return () => {
      void client.cancelQueries({
        queryKey: [...assistantKey(userId), "conversation", conversationId],
      });
      void client.cancelQueries({
        queryKey: [...assistantKey(userId), "turns", conversationId],
      });
    };
  }, [client, conversationId, userId]);
  useEffect(() => {
    if (!requestId) return;
    return () => {
      void client.cancelQueries({
        queryKey: [...assistantKey(userId), "turn", requestId],
      });
    };
  }, [client, requestId, userId]);
  useEffect(() => {
    if (blocked) {
      client.removeQueries({
        queryKey: [...assistantKey(userId), "turns", conversationId],
      });
      for (const query of client
        .getQueryCache()
        .findAll({ queryKey: [...assistantKey(userId), "turn"] })) {
        const data = query.state.data as AssistantTurn | undefined;
        if (data?.conversationId === conversationId)
          client.setQueryData(query.queryKey, {
            ...data,
            contentAccess: "blocked",
            question: null,
            answer: null,
            evidences: [],
          });
      }
    }
  }, [blocked, client, userId, conversationId]);
  useEffect(() => {
    if (turn.data && !isActiveTurn(turn.data)) {
      void client.invalidateQueries({ queryKey: [...assistantKey(userId), "conversations"] });
      void client.invalidateQueries({
        queryKey: [...assistantKey(userId), "conversation", conversationId],
      });
      void client.invalidateQueries({
        queryKey: [...assistantKey(userId), "turns", conversationId],
      });
    }
  }, [turn.data, client, userId, conversationId]);
  const turns = new Map<string, AssistantTurn>();
  if (!blocked) {
    for (const item of history.data?.pages.flatMap((page) => page.items) ?? [])
      turns.set(item.requestId, item);
    if (turn.data) turns.set(turn.data.requestId, turn.data);
  }
  return {
    conversation,
    history,
    turn,
    turns: [...turns.values()].sort(
      (first, second) => first.ordinal - second.ordinal,
    ),
    blocked,
    requestId,
    active:
      isActiveTurn(turn.data) ||
      (!!conversation.data?.activeRequestId && !turn.data),
    refetch: async () => {
      await Promise.allSettled([
        conversation.refetch(),
        history.refetch(),
        ...(requestId ? [turn.refetch()] : []),
      ]);
    },
  };
}
