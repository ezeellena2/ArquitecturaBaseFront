import { api } from "@/shared/api/httpClient";

/// Quién puede crear una cuenta (sección 4 del spec de la Fase 4). Viaja por su nombre, no por su número.
export type RegistrationMode = "InviteOnly" | "Open";

export interface SystemSettings {
  readonly registrationMode: RegistrationMode;
}

export const systemSettingsQueryKey = ["system-settings"] as const;

export function fetchSystemSettings(): Promise<SystemSettings> {
  return api.get<SystemSettings>("/api/settings");
}

export function updateSystemSettings(body: SystemSettings): Promise<void> {
  return api.put<void>("/api/settings", body);
}
