import { z } from "zod";
import { api } from "@/shared/api/httpClient";

// Configuración › WhatsApp (RC3-A): the time to answer a form, the countries that receive codes and the retention of the messages, saved
// whole with the revision read. A closed contract: an unknown key or value is a generic error.
const settings = z.strictObject({
  revision: z.number().int().min(0),
  flowSessionLifetimeHours: z.number().int(),
  allowedCountries: z.array(z.string().regex(/^[A-Z]{2}$/)),
  messageRetentionDays: z.number().int(),
});

export type WhatsAppSettings = z.infer<typeof settings>;

/** The three values, with the revision read (0 before the first save). */
export interface WhatsAppSettingsSaveRequest {
  expectedRevision: number;
  flowSessionLifetimeHours: number;
  allowedCountries: string[];
  messageRetentionDays: number;
}

/** The same limits as the server (`WhatsAppSettings`). */
export const whatsAppSettingsLimits = {
  minFlowSessionLifetimeHours: 1, maxFlowSessionLifetimeHours: 168, maxAllowedCountries: 250, minMessageRetentionDays: 1, maxMessageRetentionDays: 3650,
} as const;

/** The fields a 400 names, in the order of the screen. */
export const whatsAppSettingFields = ["flowSessionLifetimeHours", "allowedCountries", "messageRetentionDays"] as const;
export type WhatsAppSettingField = (typeof whatsAppSettingFields)[number];

export const whatsAppSettingsKey = ["whatsapp-settings"] as const;
const base = "/api/whatsapp/settings";

function parse(value: unknown): WhatsAppSettings {
  const result = settings.safeParse(value);
  if (!result.success) throw new Error("Unsupported WhatsApp settings response.");
  return result.data;
}

export async function fetchWhatsAppSettings(signal?: AbortSignal): Promise<WhatsAppSettings> {
  return parse(await api.get<unknown>(base, { signal, cache: "no-store" }));
}

/** 200 brings the settings as saved, with the same body as the read; 409 if another save came first. */
export async function saveWhatsAppSettings(request: WhatsAppSettingsSaveRequest, signal?: AbortSignal): Promise<WhatsAppSettings> {
  return parse(await api.put<unknown>(base, request, { signal }));
}
