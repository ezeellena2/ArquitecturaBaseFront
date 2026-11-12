import { useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchFormDashboard } from "../api/dashboard";
import type { DashboardPeriod } from "../dashboardPeriod";
import type { ResponseQuery } from "../responses";
import { formDashboardKeyRoot } from "./formDashboardKey";
import { useResponseFeedback, useResponseScope } from "./useResponseQueries";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";

/**
 * The dashboard of a form (DOC7-A) with the sheet's search and one period, read like the sheet: private, never cached, by owner,
 * and a 403 takes the whole reading away. While another filter or period arrives, the previous dashboard stays in sight. A 429
 * keeps «Reintentar» off for the time the server asked, as its reason.
 */
export function useFormDashboard(formId: string, filter: ResponseQuery, period: DashboardPeriod, enabled: boolean) {
  const { t } = useTranslation("forms");
  const scope = useResponseScope();
  useUnobservedQueryCleanup(["form-responses", scope.owner]);
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  const query = useQuery({
    queryKey: [...formDashboardKeyRoot(scope.owner, formId), filter, period],
    queryFn: ({ signal }) => fetchFormDashboard(formId, filter, period, signal),
    enabled: enabled && scope.allowed && !!formId,
    gcTime: 0,
    meta: { errorOwner: "local" },
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === scope.owner && previousQuery.queryKey[3] === formId ? keepPreviousData(previous) : undefined,
  });
  const waiting = query.error instanceof ApiError && query.error.status === 429;
  useResponseFeedback(waiting ? null : query.error, `responses:dashboard:${scope.owner}:${formId}`, query.refetch);
  const waitId = `responses:dashboard-wait:${scope.owner}:${formId}`;
  useEffect(() => {
    if (!(query.error instanceof ApiError) || query.error.status !== 429) return;
    const seconds = Math.min(86400, Math.max(1, query.error.retryAfterSeconds ?? 60));
    restart(seconds);
    notify({ id: waitId, kind: "error", message: t("wait", { count: seconds }) });
  }, [query.error, restart, t, waitId]);
  useEffect(() => () => dismissNotification(waitId), [waitId]);
  return { query: { ...query, data: scope.allowed ? query.data : undefined }, cooldown };
}
