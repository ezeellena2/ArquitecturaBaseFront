import { retentionFields, retentionRanges, settingFields, type RetentionField, type SettingField, type SettingsChanges, type SettingsDraft, type SystemBranding, type SystemSettings } from "./api/settings";

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

/// RC6-B: el nombre, el remitente y el logo como se editan: el logo vacío es «sin logo».
export interface BrandingDraft { appName: string; emailSenderName: string; emailLogoUrl: string }
export type BrandingField = keyof BrandingDraft;
export const brandingFields: BrandingField[] = ["appName", "emailSenderName", "emailLogoUrl"];
/// Los mismos topes que valida el servidor: el nombre viaja como parámetro de la plantilla de WhatsApp.
export const brandingLimits = { name: 60, logoUrl: 2048 } as const;

export const brandingDraftFrom = (branding: SystemBranding): BrandingDraft =>
  ({ appName: branding.appName, emailSenderName: branding.emailSenderName, emailLogoUrl: branding.emailLogoUrl ?? "" });

/// Lo que se guarda: los nombres sin espacios en los bordes y el logo vacío como ninguno.
export const brandingFrom = (draft: BrandingDraft): SystemBranding =>
  ({ appName: draft.appName.trim(), emailSenderName: draft.emailSenderName.trim(), emailLogoUrl: draft.emailLogoUrl.trim() || null });

export function brandingChanged(draft: BrandingDraft, saved: SystemBranding): boolean {
  const next = brandingFrom(draft);
  return next.appName !== saved.appName || next.emailSenderName !== saved.emailSenderName || next.emailLogoUrl !== saved.emailLogoUrl;
}

// Un nombre va en una línea: sin saltos ni otros caracteres de control (los mismos que rechaza char.IsControl del servidor).
const hasControlCharacters = (text: string) => [...text].some(character => {
  const code = character.charCodeAt(0);
  return code < 0x20 || (code >= 0x7f && code <= 0x9f);
});

/// Un logo vacío es ninguno; si no, una dirección https completa, sin espacios, como la pide el servidor.
export function isLogoUrl(text: string): boolean {
  const url = text.trim();
  if (!url) return true;
  if (url.length > brandingLimits.logoUrl || /\s/.test(url) || hasControlCharacters(url)) return false;
  try { const parsed = new URL(url); return parsed.protocol === "https:" && parsed.hostname.length > 0; } catch { return false; }
}

export type BrandingIssue = "required" | "tooLong" | "singleLine" | "logoUrl";

export function brandingIssues(draft: BrandingDraft): Partial<Record<BrandingField, BrandingIssue>> {
  const name = (text: string): BrandingIssue | null => !text.trim() ? "required" : text.trim().length > brandingLimits.name ? "tooLong"
    : hasControlCharacters(text) ? "singleLine" : null;
  return Object.fromEntries([
    ["appName", name(draft.appName)], ["emailSenderName", name(draft.emailSenderName)],
    ["emailLogoUrl", isLogoUrl(draft.emailLogoUrl) ? null : "logoUrl"],
  ].filter(([, issue]) => issue !== null));
}
