import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useUnobservedQueryCleanup(key: readonly unknown[]) {
  const client = useQueryClient();
  const stamp = JSON.stringify(key);
  useEffect(() => () => {
    const queryKey = JSON.parse(stamp) as readonly unknown[];
    queueMicrotask(() => {
      for (const query of client.getQueryCache().findAll({ queryKey })) {
        if (query.getObserversCount() > 0) continue;
        void client.cancelQueries({ queryKey: query.queryKey, exact: true });
        client.removeQueries({ queryKey: query.queryKey, exact: true });
      }
    });
  }, [client, stamp]);
}
