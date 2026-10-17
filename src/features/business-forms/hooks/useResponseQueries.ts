import { useCallback, useContext, useEffect, useState } from "react";
import {
  keepPreviousData,
  useQuery,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { useCountdown } from "@/shared/hooks/useCountdown";
import {
  fetchResponseDetail,
  fetchResponseFacet,
  fetchResponseNavigation,
  fetchResponseSheet,
} from "../api/responses";
import { ResponseWorkspaceContext } from "./useResponseWorkspace";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";
import type { ResponseQuery } from "../responses";
export function useResponseScope() {
  const { data: user } = useCurrentUser();
  const { i18n } = useTranslation();
  const context = useContext(ResponseWorkspaceContext);
  const allowed =
    !!user?.permissions.includes("formrecords.read") && !context?.denied;
  return {
    user,
    allowed,
    culture: i18n.language.startsWith("en") ? "en" : "es",
    owner: [
      user?.id ?? "",
      i18n.language,
      [...(user?.permissions ?? [])].sort().join(","),
      context?.denied ? "denied" : "read",
    ].join(":"),
    actor: allowed ? user!.id : null,
  };
}
export function useResponseFeedback(
  error: unknown,
  id: string,
  retry?: () => void,
) {
  const { t } = useTranslation("forms");
  const deny = useContext(ResponseWorkspaceContext)?.deny;
  useEffect(() => {
    if (error instanceof ApiError && error.status === 403) deny?.();
    if (!error) {
      dismissNotification(id);
      return;
    }
    if (error instanceof ApiError && error.status === 404) return;
    if (
      ["cancelled", "session", "forbidden"].includes(errorFeedback(error).kind)
    )
      return;
    notify({
      id,
      kind: "error",
      message: readErrorMessage(error, t),
      action: retry && errorFeedback(error).network
        ? { label: t("common:actions.retry"), onClick: retry }
        : undefined,
    });
  }, [error, id, t, deny, retry]);
  useEffect(
    () => () => {
      dismissNotification(id);
    },
    [id],
  );
}
export function useResponseNavigation(page = 1, pageSize = 4, search = "") {
  const scope = useResponseScope();
  useUnobservedQueryCleanup(["form-responses", scope.owner]);
  const query = useQuery({
    queryKey: [
      "form-responses",
      scope.owner,
      "navigation",
      page,
      pageSize,
      search,
    ],
    queryFn: ({ signal }) =>
      fetchResponseNavigation({ page, pageSize, search }, signal),
    enabled: scope.allowed,
    gcTime: 0,
    meta: { errorOwner: "local" },
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === scope.owner
        ? keepPreviousData(previous)
        : undefined,
  });
  return { query, scope };
}
export function useResponseSheet(
  id: string,
  filter: ResponseQuery,
  enabled = true,
) {
  const scope = useResponseScope();
  useUnobservedQueryCleanup(["form-responses", scope.owner]);
  const owner = scope.owner + ":" + id;
  const [last, setLast] = useState<{
    owner: string;
    data: Awaited<ReturnType<typeof fetchResponseSheet>>;
  } | null>(null);
  const query = useQuery({
    queryKey: ["form-responses", scope.owner, "sheet", id, filter],
    queryFn: ({ signal }) => fetchResponseSheet(id, filter, signal),
    enabled: enabled && scope.allowed && !!id,
    gcTime: 0,
    meta: { errorOwner: "local" },
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === scope.owner &&
      previousQuery.queryKey[3] === id
        ? keepPreviousData(previous)
        : undefined,
  });
  if (last && (!scope.allowed || last.owner !== owner)) setLast(null);
  if (
    scope.allowed &&
    query.data &&
    !query.isPlaceholderData &&
    last?.data !== query.data
  )
    setLast({ owner, data: query.data });
  return {
    query: {
      ...query,
      data: scope.allowed
        ? (query.data ?? (last?.owner === owner ? last.data : undefined))
        : undefined,
    },
    scope,
  };
}
export function useResponseDetail(id: string, formId: string) {
  const scope = useResponseScope();
  useUnobservedQueryCleanup(["form-responses", scope.owner]);
  const query = useQuery({
    queryKey: ["form-responses", scope.owner, "record", formId, id],
    queryFn: ({ signal }) => fetchResponseDetail(id, signal),
    enabled: scope.allowed && !!id,
    gcTime: 0,
    meta: { errorOwner: "local" },
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === scope.owner && previousQuery.queryKey[3] === formId ? keepPreviousData(previous) : undefined,
  });
  return { query, scope };
}
export function useResponseFacet(
  id: string,
  filter: ResponseQuery | null,
  dimension: string,
  fieldId: string | undefined,
  page: number,
  search: string,
  enabled = true,
  localFeedback = true,
) {
  const scope = useResponseScope();
  const { t } = useTranslation("forms");
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  const [paused, setPaused] = useState(false);
  useUnobservedQueryCleanup(["form-responses", scope.owner]);
  const [retainedFilter, setRetainedFilter] = useState(filter);
  if (filter && retainedFilter !== filter) setRetainedFilter(filter);
  const currentFilter = filter ?? retainedFilter;
  const facetFilter = currentFilter ? { ...currentFilter, actorIds: dimension === "actor" ? [] : currentFilter.actorIds, versionIds: dimension === "version" ? [] : currentFilter.versionIds, conditions: dimension === "choice" || dimension === "presence" ? currentFilter.conditions?.filter(item => item.fieldId !== fieldId) : currentFilter.conditions } : null;
  const query = useQuery({
    queryKey: [
      "form-responses",
      scope.owner,
      "facet",
      id,
      facetFilter,
      dimension,
      fieldId,
      page,
      search,
    ],
    queryFn: async ({ signal }) => {
      try {
        return await fetchResponseFacet(id, facetFilter!, dimension, fieldId, page, search, signal);
      } catch (error) {
        if (error instanceof ApiError && error.status === 429) setPaused(true);
        throw error;
      }
    },
    enabled: enabled && scope.allowed && !!id && !!filter && !paused,
    gcTime: 0,
    staleTime: Infinity,
    meta: { errorOwner: "local" },
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === scope.owner &&
      previousQuery.queryKey[3] === id &&
      previousQuery.queryKey[5] === dimension &&
      previousQuery.queryKey[6] === fieldId
        ? keepPreviousData(previous)
        : undefined,
  });
  useResponseFeedback(
    !localFeedback && !(query.error instanceof ApiError && query.error.status === 403) || query.error instanceof ApiError && query.error.status === 429 ? null : query.error,
    `responses:facet:${scope.owner}:${id}:${dimension}:${fieldId ?? ""}`,
    errorFeedback(query.error).network ? query.refetch : undefined,
  );
  const feedbackId = `responses:facet-wait:${scope.owner}:${id}:${dimension}:${fieldId ?? ""}`;
  useEffect(() => {
    if (!(query.error instanceof ApiError) || query.error.status !== 429) return;
    const seconds = Math.min(86400, Math.max(1, query.error.retryAfterSeconds ?? 60));
    restart(seconds);
    if (localFeedback) notify({ id: feedbackId, kind: "error", message: t("wait", { count: seconds }) });
  }, [query.error, restart, t, feedbackId, localFeedback]);
  useEffect(() => () => dismissNotification(feedbackId), [feedbackId]);
  return { ...query, cooldown, retry: () => {
    if (cooldown.isRunning) return;
    if (paused) setPaused(false);
    else void query.refetch();
  } };
}

export function useResponseCount(id: string, filter: ResponseQuery | null) {
  const scope = useResponseScope();
  const cooldown = useCountdown(0);
  const [paused, setPaused] = useState(false);
  const query = useQuery({ queryKey: ["form-responses", scope.owner, "count", id, filter], enabled: scope.allowed && !!filter && !paused,
    queryFn: async ({ signal }) => { try { return (await fetchResponseSheet(id, { ...filter!, page: 1, pageSize: 1 }, signal)).records.totalCount; } catch (error) {
      if (error instanceof ApiError && error.status === 429) { setPaused(true); cooldown.restart(error.retryAfterSeconds ?? 60); } throw error;
    } }, gcTime: 0, meta: { errorOwner: "local" } });
  const { refetch } = query;
  const { isRunning } = cooldown;
  const retry = useCallback(() => { if (isRunning) return; if (paused) setPaused(false); else void refetch(); }, [isRunning, paused, refetch]);
  return { ...query, cooldown, retry, isCountPaused: paused };
}
