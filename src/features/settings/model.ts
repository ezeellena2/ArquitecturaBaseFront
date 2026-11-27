import type { BrandImageKind } from "@/shared/api/presentation";
import { retentionFields, retentionRanges, settingFields, type RetentionField, type SettingField, type SettingsChanges, type SettingsDraft, type SystemBranding, type SystemBrandingChanges, type SystemSettings } from "./api/settings";

export function draftFrom(settings: SystemSettings): SettingsDraft {
  return {
    defaultCulture: settings.defaultCulture,
    defaultTimeZoneId: settings.defaultTimeZoneId,
    defaultPageSize: settings.defaultPageSize,
    registrationMode: settings.registrationMode,
    loginAuditMonths: String(settings.retention.loginAuditMonths),
    loginCodeDays: String(settings.retention.loginCodeDays),
    invitationDays: String(settings.retention.invitationDays),
  };
}

const normalized = (value: string | number) => typeof value === "string" ? value.trim() : value;

/// Los ajustes del borrador que no son los guardados.
export function changedFields(draft: SettingsDraft, baseline: SystemSettings): SettingField[] {
  const saved = draftFrom(baseline);
  return settingFields.filter(field => normalized(draft[field]) !== saved[field]);
}

/// RC1-A: los plazos fuera de su rango, o que no son un número entero, con el rango de cada uno.
export function retentionIssues(draft: SettingsDraft): Partial<Record<RetentionField, { min: number; max: number }>> {
  return Object.fromEntries(retentionFields.flatMap(field => {
    const text = draft[field].trim();
    const value = Number(text);
    const { min, max } = retentionRanges[field];
    return !text || !Number.isInteger(value) || value < min || value > max ? [[field, { min, max }]] : [];
  }));
}

/// Lo que viaja en el PATCH: los ajustes cambiados y, si cambió alguno, los tres plazos juntos. Supone plazos válidos.
export function changesFrom(draft: SettingsDraft, baseline: SystemSettings): SettingsChanges {
  const changed = new Set(changedFields(draft, baseline));
  return {
    ...(changed.has("defaultCulture") ? { defaultCulture: draft.defaultCulture } : {}),
    ...(changed.has("defaultTimeZoneId") ? { defaultTimeZoneId: draft.defaultTimeZoneId } : {}),
    ...(changed.has("defaultPageSize") ? { defaultPageSize: draft.defaultPageSize } : {}),
    ...(changed.has("registrationMode") ? { registrationMode: draft.registrationMode } : {}),
    ...(retentionFields.some(field => changed.has(field)) ? { retention: {
      loginAuditMonths: Number(draft.loginAuditMonths.trim()), loginCodeDays: Number(draft.loginCodeDays.trim()), invitationDays: Number(draft.invitationDays.trim()),
    } } : {}),
  };
}

/// RC6-B: el nombre y el remitente como se editan. El logo y el ícono no son borrador: se guardan al subirlos (ME2b).
export interface BrandingDraft { appName: string; emailSenderName: string }
export type BrandingField = keyof BrandingDraft;
export const brandingFields: BrandingField[] = ["appName", "emailSenderName"];
/// Los mismos topes que valida el servidor: el nombre viaja como parámetro de la plantilla de WhatsApp.
export const brandingLimits = { name: 60 } as const;

export const brandingDraftFrom = (branding: SystemBranding): BrandingDraft =>
  ({ appName: branding.appName, emailSenderName: branding.emailSenderName });

/// Lo que se guarda: los nombres sin espacios en los bordes.
export const brandingFrom = (draft: BrandingDraft): SystemBrandingChanges =>
  ({ appName: draft.appName.trim(), emailSenderName: draft.emailSenderName.trim() });

export function brandingChanged(draft: BrandingDraft, saved: SystemBranding): boolean {
  const next = brandingFrom(draft);
  return next.appName !== saved.appName || next.emailSenderName !== saved.emailSenderName;
}

// Un nombre va en una línea: sin saltos ni otros caracteres de control (los mismos que rechaza char.IsControl del servidor).
const hasControlCharacters = (text: string) => [...text].some(character => {
  const code = character.charCodeAt(0);
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
});

export type BrandingIssue = "required" | "tooLong" | "singleLine";

export function brandingIssues(draft: BrandingDraft): Partial<Record<BrandingField, BrandingIssue>> {
  const name = (text: string): BrandingIssue | null => !text.trim() ? "required" : text.trim().length > brandingLimits.name ? "tooLong"
    : hasControlCharacters(text) ? "singleLine" : null;
  return Object.fromEntries([
    ["appName", name(draft.appName)], ["emailSenderName", name(draft.emailSenderName)],
  ].filter(([, issue]) => issue !== null));
}

/// ME2: el tope del archivo que pide el servidor. La forma (apaisado o cuadrado) la revisa él, con los bytes.
export const brandImageMaxBytes = 1024 * 1024;
export const brandImageTypes: Record<BrandImageKind, readonly string[]> = { logo: ["image/png", "image/jpeg"], icon: ["image/png"] };

/// Lo que el navegador puede decir antes de mandar: un tipo que no es el de esa imagen o un archivo de más de 1 MB.
export const brandImageFileIssue = (kind: BrandImageKind, file: File) =>
  !brandImageTypes[kind].includes(file.type) || file.size === 0 || file.size > brandImageMaxBytes;
