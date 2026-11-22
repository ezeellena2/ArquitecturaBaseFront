import { api } from "@/shared/api/httpClient";
import type { SystemPresentation } from "@/shared/api/presentation";
import type { SystemAppearance } from "@/shared/lib/appearance";

/// Quién puede crear una cuenta (sección 4 del spec de la Fase 4). Viaja por su nombre, no por su número.
export type RegistrationMode = "InviteOnly" | "Open";

/// RC6-B: cómo se presenta la instalación en los correos, en la invitación por WhatsApp y en los PDF. Sin logo, null.
export interface SystemBranding {
  readonly appName: string;
  readonly emailSenderName: string;
  readonly emailLogoUrl: string | null;
}

/// RC1-A: cuánto se guardan los datos del ingreso. La retención los lee de la base en cada corrida.
export interface IdentityRetention {
  readonly loginAuditMonths: number;
  readonly loginCodeDays: number;
  readonly invitationDays: number;
}

export interface SystemSettings extends SystemPresentation {
  readonly registrationMode: RegistrationMode;
  readonly revision: number;
  readonly branding: SystemBranding;
  readonly retention: IdentityRetention;
}

export const systemSettingsQueryKey = ["system-settings"] as const;

export function fetchSystemSettings(): Promise<SystemSettings> {
  return api.get<SystemSettings>("/api/settings");
}

export type RetentionField = keyof IdentityRetention;
export const retentionFields: RetentionField[] = ["loginAuditMonths", "loginCodeDays", "invitationDays"];
/// Los mismos rangos que valida el servidor: un día de códigos cubre los límites de 24 h y siete de invitaciones, su entrega.
export const retentionRanges: Record<RetentionField, { min: number; max: number }> = {
  loginAuditMonths: { min: 1, max: 120 }, loginCodeDays: { min: 1, max: 3650 }, invitationDays: { min: 7, max: 3650 },
};

type ScalarField = "defaultCulture" | "defaultTimeZoneId" | "defaultPageSize" | "registrationMode";
export type SettingField = ScalarField | RetentionField;
export const settingFields: SettingField[] = ["defaultCulture", "defaultTimeZoneId", "defaultPageSize", "registrationMode", ...retentionFields];
/// Los plazos se editan como texto: el cuadro puede quedar vacío mientras se escribe, y se validan al guardar.
export type SettingsDraft = Pick<SystemSettings, ScalarField> & Record<RetentionField, string>;
export type SettingsChanges = Partial<Pick<SystemSettings, ScalarField>> & {
  appearance?: SystemAppearance;
  branding?: SystemBranding;
  retention?: IdentityRetention;
};
/// Cómo nombra el servidor el error de cada ajuste: los plazos viajan juntos, dentro de `retention`.
export const settingErrorKey = (field: SettingField) => retentionFields.includes(field as RetentionField) ? `retention.${field}` : field;

export function updateSystemSettings(changes: SettingsChanges, expectedRevision: number): Promise<void> {
  return api.patch<void>("/api/settings", { expectedRevision, ...changes });
}
