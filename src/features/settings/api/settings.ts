import { api } from "@/shared/api/httpClient";
import type { SystemPresentation } from "@/shared/api/presentation";

/// Quién puede crear una cuenta (sección 4 del spec de la Fase 4). Viaja por su nombre, no por su número.
export type RegistrationMode = "InviteOnly" | "Open";

export interface SystemSettings extends SystemPresentation {
  readonly registrationMode: RegistrationMode;
  readonly revision: number;
}

export const systemSettingsQueryKey = ["system-settings"] as const;

export function fetchSystemSettings(): Promise<SystemSettings> {
  return api.get<SystemSettings>("/api/settings");
}

export type SettingField = "defaultCulture" | "defaultTimeZoneId" | "defaultPageSize" | "registrationMode";
export function updateSystemSettings(field: SettingField, value: string | number, expectedRevision: number): Promise<void> {
  return api.patch<void>("/api/settings", { expectedRevision, [field]: value });
}
