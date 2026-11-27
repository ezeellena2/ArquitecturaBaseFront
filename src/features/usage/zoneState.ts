import type { UseQueryResult } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";

/** A zone loads on its own (board «Estados» · 1): on entering, on changing the month and while «Reintentar» reads again. */
export function zoneLoading(query: Pick<UseQueryResult, "isPending" | "isError" | "isFetching">): boolean {
  return query.isPending || query.isError && query.isFetching;
}

/** A 403 takes the zone away (SP1-B): its permission was removed while the screen was open. */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}
