import { useContext, useEffect, useState } from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import {
  fetchResponseDetail,
  fetchResponseFacet,
  fetchResponseNavigation,
  fetchResponseSheet,
} from "../api/responses";
import { ResponseWorkspaceContext } from "./useResponseWorkspace";
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
function useCleanup(owner: string) {
  const client = useQueryClient();
  useEffect(
    () => () => {
      for (const query of client
        .getQueryCache()
        .findAll({ queryKey: ["form-responses", owner] })) {
        if (query.getObserversCount() === 0) {
          void client.cancelQueries({ queryKey: query.queryKey, exact: true });
          client.removeQueries({ queryKey: query.queryKey, exact: true });
        }
      }
    },
    [client, owner],
  );
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
      action: retry
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
  useCleanup(scope.owner);
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
  useResponseFeedback(
    query.error,
    `responses:navigation:${scope.owner}`,
    query.refetch,
  );
  return { query, scope };
}
export function useResponseSheet(
  id: string,
  filter: ResponseQuery,
  enabled = true,
) {
  const scope = useResponseScope();
  useCleanup(scope.owner);
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
  useResponseFeedback(
    query.error,
    `responses:sheet:${scope.owner}:${id}`,
    query.refetch,
  );
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
export function useResponseDetail(id: string) {
  const scope = useResponseScope();
  useCleanup(scope.owner);
  const query = useQuery({
    queryKey: ["form-responses", scope.owner, "record", id],
    queryFn: ({ signal }) => fetchResponseDetail(id, signal),
    enabled: scope.allowed && !!id,
    gcTime: 0,
    meta: { errorOwner: "local" },
  });
  useResponseFeedback(
    query.error,
    `responses:detail:${scope.owner}:${id}`,
    query.refetch,
  );
  return { query, scope };
}
export function useResponseFacet(
  id: string,
  filter: ResponseQuery,
  dimension: string,
  fieldId: string | undefined,
  page: number,
  search: string,
) {
  const scope = useResponseScope();
  useCleanup(scope.owner);
  const query = useQuery({
    queryKey: [
      "form-responses",
      scope.owner,
      "facet",
      id,
      filter,
      dimension,
      fieldId,
      page,
      search,
    ],
    queryFn: ({ signal }) =>
      fetchResponseFacet(id, filter, dimension, fieldId, page, search, signal),
    enabled: scope.allowed && !!id,
    gcTime: 0,
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
    query.error,
    `responses:facet:${scope.owner}:${id}:${dimension}:${fieldId ?? ""}`,
    query.refetch,
  );
  return query;
}
