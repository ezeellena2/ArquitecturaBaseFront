import { useQuery } from "@tanstack/react-query";
import { api } from "./httpClient";
import type { SystemAppearance } from "@/shared/lib/appearance";

/// ME7: what the sign-in and the shell show before the session: the name and the versions of the logo and the icon (null without them).
export interface SystemPresentationBrand {
  readonly appName: string;
  readonly logoVersion: string | null;
  readonly iconVersion: string | null;
}

export interface SystemPresentation {
  readonly defaultCulture: "es" | "en";
  readonly defaultTimeZoneId: string;
  readonly defaultPageSize: number;
  readonly appearance: SystemAppearance;
  readonly brand?: SystemPresentationBrand;
  readonly installedFeatures?: readonly string[];
}

export type BrandImageKind = "logo" | "icon";

/// ME2d: the public address of the logo or the icon. With its version the browser keeps it a year; a new upload has another.
export const brandImageUrl = (kind: BrandImageKind, version: string) =>
  `/api/settings/brand/${kind}?v=${encodeURIComponent(version)}`;

export const presentationQueryKey = ["system-presentation"] as const;
export function useSystemPresentation() {
  return useQuery({ queryKey: presentationQueryKey, queryFn: () => api.get<SystemPresentation>("/api/settings/presentation") });
}
