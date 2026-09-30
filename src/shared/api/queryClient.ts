import { QueryCache, QueryClient } from "@tanstack/react-query";
import i18n from "@/shared/i18n";
import { notify } from "@/shared/ui/notifications";
import { ApiError } from "./ApiError";
import { errorFeedback } from "./errorFeedback";

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // silent conserva consumidores heredados pendientes de la migración transversal.
        if (query.meta?.silent === true || query.meta?.errorOwner === "local") return;
        const feedback = errorFeedback(error);
        if (feedback.kind === "session" || feedback.kind === "forbidden") return;
        const serverFailure = error instanceof ApiError && error.status >= 500;
        notify({ id: 'query:' + query.queryHash, kind: "error",
          message: feedback.network ? i18n.t("errors.network") : serverFailure ? i18n.t("errors.unexpected", { traceId: feedback.traceId ?? "?" }) : feedback.detail ?? i18n.t("states.error"),
          action: feedback.network ? { label: i18n.t("actions.retry"), onClick: () => void query.fetch() } : undefined,
        });
      },
    }),
    defaultOptions: { queries: { staleTime: 30_000, retry: (failureCount, error) => !(error instanceof ApiError) || (error.isNetworkError && failureCount < 2) } },
  });
}
export const queryClient = createQueryClient();
