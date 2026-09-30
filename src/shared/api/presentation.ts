import { useQuery } from "@tanstack/react-query";
import { api } from "./httpClient";

export interface SystemPresentation {
  readonly defaultCulture: "es" | "en";
  readonly defaultTimeZoneId: string;
  readonly defaultPageSize: number;
}

export const presentationQueryKey = ["system-presentation"] as const;
export function useSystemPresentation() {
  return useQuery({ queryKey: presentationQueryKey, queryFn: () => api.get<SystemPresentation>("/api/settings/presentation") });
}
