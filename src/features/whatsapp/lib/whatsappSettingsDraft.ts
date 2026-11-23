import { whatsAppSettingFields, whatsAppSettingsLimits as limits, type WhatsAppSettingField, type WhatsAppSettings, type WhatsAppSettingsSaveRequest } from "../api/whatsappSettings";

// Configuración › WhatsApp (RC3-A): the draft of the screen, what Guardar sends, what changed, what is wrong and where, and how a
// conflict keeps what was edited. Pure: the translations come by key.

/** The numbers stay as typed until they are saved; the countries, by their code. */
export interface WhatsAppSettingsDraft { flowSessionLifetimeHours: string; allowedCountries: string[]; messageRetentionDays: string }

/** A problem to show at its field: the key of its text in «whatsapp» (`settings.validation.*`). */
export interface WhatsAppSettingsIssue { key: string; values?: Record<string, number> }
export type WhatsAppSettingsIssues = Partial<Record<WhatsAppSettingField, WhatsAppSettingsIssue>>;

const sorted = (countries: readonly string[]) => [...new Set(countries)].sort();

export function draftFromSettings(settings: WhatsAppSettings): WhatsAppSettingsDraft {
  return { flowSessionLifetimeHours: String(settings.flowSessionLifetimeHours), allowedCountries: sorted(settings.allowedCountries),
    messageRetentionDays: String(settings.messageRetentionDays) };
}

/** What Guardar sends: the three values, with the revision that was read. */
export function saveRequest(draft: WhatsAppSettingsDraft, baseline: WhatsAppSettings): WhatsAppSettingsSaveRequest {
  return { expectedRevision: baseline.revision, flowSessionLifetimeHours: Number(draft.flowSessionLifetimeHours.trim()),
    allowedCountries: sorted(draft.allowedCountries), messageRetentionDays: Number(draft.messageRetentionDays.trim()) };
}

// The comparable form of each field: the numbers as typed and the countries in order.
const parts = (draft: WhatsAppSettingsDraft): Record<WhatsAppSettingField, string> => ({
  flowSessionLifetimeHours: draft.flowSessionLifetimeHours.trim(), allowedCountries: sorted(draft.allowedCountries).join(","),
  messageRetentionDays: draft.messageRetentionDays.trim(),
});

/** The fields that differ between two versions, in the order of the screen. */
export function changedFields(left: WhatsAppSettingsDraft, right: WhatsAppSettingsDraft): WhatsAppSettingField[] {
  const [l, r] = [parts(left), parts(right)];
  return whatsAppSettingFields.filter(field => l[field] !== r[field]);
}

/** A conflict that keeps what was edited: what I changed stays and the rest takes what the other person saved. */
export function mergeDrafts(mine: WhatsAppSettingsDraft, base: WhatsAppSettingsDraft, theirs: WhatsAppSettingsDraft): WhatsAppSettingsDraft {
  const changed = new Set(changedFields(mine, base));
  const from = (field: WhatsAppSettingField) => changed.has(field) ? mine : theirs;
  return { flowSessionLifetimeHours: from("flowSessionLifetimeHours").flowSessionLifetimeHours, allowedCountries: [...from("allowedCountries").allowedCountries],
    messageRetentionDays: from("messageRetentionDays").messageRetentionDays };
}

function integer(value: string, min: number, max: number): WhatsAppSettingsIssue | undefined {
  const number = Number(value.trim());
  return !value.trim() || !Number.isInteger(number) || number < min || number > max ? { key: "settings.validation.range", values: { min, max } } : undefined;
}

/** Everything Guardar checks before sending, at the server's paths. */
export function validateDraft(draft: WhatsAppSettingsDraft): WhatsAppSettingsIssues {
  const issues: WhatsAppSettingsIssues = {};
  const lifetime = integer(draft.flowSessionLifetimeHours, limits.minFlowSessionLifetimeHours, limits.maxFlowSessionLifetimeHours);
  if (lifetime) issues.flowSessionLifetimeHours = lifetime;
  if (!draft.allowedCountries.length) issues.allowedCountries = { key: "settings.validation.countriesRequired" };
  const retention = integer(draft.messageRetentionDays, limits.minMessageRetentionDays, limits.maxMessageRetentionDays);
  if (retention) issues.messageRetentionDays = retention;
  return issues;
}

/** The countries just chosen that are not saved yet: each code to one of them is paid with that country's rate. */
export function newCountries(next: readonly string[], previous: readonly string[], saved: readonly string[]): string[] {
  return next.filter(country => !previous.includes(country) && !saved.includes(country));
}
