import { useQuery } from "@tanstack/react-query";
import { api } from "./httpClient";
import type { SystemAppearance } from "@/shared/lib/appearance";

export interface SystemPresentation {
  readonly defaultCulture: "es" | "en";
  readonly defaultTimeZoneId: string;
  readonly defaultPageSize: number;
  readonly appearance: SystemAppearance;
  readonly installedFeatures?: readonly string[];
}

export const presentationQueryKey = ["system-presentation"] as const;
export function useSystemPresentation() {
  return useQuery({ queryKey: presentationQueryKey, queryFn: () => api.get<SystemPresentation>("/api/settings/presentation") });
}
