import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/shared/hooks/usePagination";
import { assistantKey } from "../assistant/model";
import { assistantApi } from "../api/assistant";

export function useAssistantConversationList(userId: string, language: string, permissionsVersion: string) {
  const pagination = usePagination();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...assistantKey(userId), "conversations", pagination.page, pagination.pageSize, pagination.sort, language, permissionsVersion],
    queryFn: ({ signal }) => assistantApi.conversations({ page: pagination.page, pageSize: pagination.pageSize, sort: pagination.sort ?? "-lastActivityAtUtc" }, signal),
    enabled: !!userId,
    gcTime: 60000,
    staleTime: 0,
  });
  useEffect(() => {
    if (query.data && query.data.page > Math.max(1, query.data.totalPages)) pagination.setPage(Math.max(1, query.data.totalPages));
  }, [query.data, pagination]);
  useEffect(() => () => {
    void client.cancelQueries({ queryKey: [...assistantKey(userId), "conversations"] });
  }, [client, userId, permissionsVersion]);
  return { query, pagination };
}
