import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { fetchFormOverview, type FormOverviewQuery } from "../api/overview";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";

export function useFormOverviewScope() {
  const { data: user } = useCurrentUser();
  const { i18n } = useTranslation();
  const owner = [user?.id ?? "", i18n.language, [...(user?.permissions ?? [])].sort().join(",")].join(":");
  const canRead = !!user?.permissions.includes("formrecords.read");
  const canDecide = !!user?.permissions.includes("formapprovals.decide");
  return { user, owner, canRead, canDecide };
}
export function useFormOverview(filter: FormOverviewQuery, enabled: boolean) {
  const { user, owner, canRead, canDecide } = useFormOverviewScope();
  const [deniedOwner, setDeniedOwner] = useState<string | null>(null);
  const client = useQueryClient();
  const allowed = (canRead || canDecide) && deniedOwner !== owner;
  useUnobservedQueryCleanup(["form-overview", owner]);
  const query = useQuery({
    queryKey: ["form-overview", owner, filter],
    queryFn: ({ signal }) => fetchFormOverview(filter, signal),
    enabled: allowed && enabled, gcTime: 0, meta: { errorOwner: "local" },
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === owner ? keepPreviousData(previous) : undefined,
  });
  const forbidden = deniedOwner === owner || query.error instanceof ApiError && query.error.status === 403;
  if (forbidden && deniedOwner !== owner) setDeniedOwner(owner);
  useEffect(() => { if (deniedOwner === owner) client.removeQueries({ queryKey: ["form-overview", owner] }); }, [client, deniedOwner, owner]);
  return { scope: { user, owner, allowed, canRead, canDecide }, query: { ...query, data: allowed && !forbidden ? query.data : undefined }, forbidden };
}
