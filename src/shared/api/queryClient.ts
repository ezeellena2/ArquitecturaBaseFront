import { QueryCache, QueryClient } from "@tanstack/react-query";
import i18n from "@/shared/i18n";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { ApiError } from "./ApiError";
import { errorFeedback, readErrorMessage } from "./errorFeedback";

export function createQueryClient() {
  const cache = new QueryCache({
      onSuccess: (_, query) => dismissNotification('query:' + query.queryHash),
      onError: (error, query) => {
        // silent conserva consumidores heredados pendientes de la migración transversal.
        if (query.meta?.silent === true || query.meta?.errorOwner === "local") return;
        const feedback = errorFeedback(error);
        if (["session", "forbidden", "cancelled"].includes(feedback.kind)) return;
        notify({ id: 'query:' + query.queryHash, kind: "error",
          message: readErrorMessage(error, i18n.t),
          action: feedback.network && query.getObserversCount() > 0 ? { label: i18n.t("actions.retry"), onClick: () => { if (query.getObserversCount() > 0) void query.fetch().catch(() => undefined); } } : undefined,
        });
      },
    });
  cache.subscribe(event => {
    if (event.type === "removed" || (event.type === "observerRemoved" && event.query.getObserversCount() === 0)) dismissNotification('query:' + event.query.queryHash);
  });
  return new QueryClient({
    queryCache: cache,
    defaultOptions: { queries: { staleTime: 30_000, retry: (failureCount, error) => failureCount < 2 && errorFeedback(error).kind !== "cancelled" && (!(error instanceof ApiError) || error.isNetworkError) } },
  });
}
export const queryClient = createQueryClient();
