import type { SettingsChanges, SettingsDraft, SystemSettings } from "./api/settings";

export function changesFrom(draft: SettingsDraft, baseline: SystemSettings): SettingsChanges {
  return {
    ...(draft.defaultCulture !== baseline.defaultCulture ? { defaultCulture: draft.defaultCulture } : {}),
    ...(draft.defaultTimeZoneId !== baseline.defaultTimeZoneId ? { defaultTimeZoneId: draft.defaultTimeZoneId } : {}),
    ...(draft.defaultPageSize !== baseline.defaultPageSize ? { defaultPageSize: draft.defaultPageSize } : {}),
    ...(draft.registrationMode !== baseline.registrationMode ? { registrationMode: draft.registrationMode } : {}),
  };
}

export function draftFrom(settings: SystemSettings): SettingsDraft {
  return {
    defaultCulture: settings.defaultCulture,
    defaultTimeZoneId: settings.defaultTimeZoneId,
    defaultPageSize: settings.defaultPageSize,
    registrationMode: settings.registrationMode,
  };
}
