import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { chatKey } from "../api/chat";

export interface ChatReadScope {
  readonly actor: string;
  readonly culture: string;
  readonly permissions: readonly string[];
}
export const chatReadScopeKey = (scope: ChatReadScope) =>
  [...chatKey, scope.actor, "read", scope.culture, [...new Set(scope.permissions)].sort().join(",")] as const;

// Each read owner removes its own partition, including every historical page and pending request.
export function useChatReadCleanup(key: readonly unknown[]) {
  const client = useQueryClient();
  const stamp = JSON.stringify(key);
  useEffect(() => () => {
    const queryKey: readonly unknown[] = JSON.parse(stamp) as readonly unknown[];
    void client.cancelQueries({ queryKey });
    client.removeQueries({ queryKey });
  }, [client, stamp]);
}
