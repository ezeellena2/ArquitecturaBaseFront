import { z } from "zod";
import { api } from "@/shared/api/httpClient";

/** RC4-A: the bounds of each number of Configuración › Formularios, the same as the server's (`BusinessFormsSettings`). */
export const formSettingRanges = {
  maxFileSizeMiB: { min: 1, max: 25 },
  dailyRereadsPerAsker: { min: 1, max: 100 },
  similarDocumentsToSuggest: { min: 2, max: 20 },
  proposedExpiryDays: { min: 1, max: 3650 },
  discardedRetentionDays: { min: 1, max: 3650 },
} as const;
export type FormSettingField = keyof typeof formSettingRanges;
export const formSettingFields = Object.keys(formSettingRanges) as FormSettingField[];

const number = z.number().int();
const settings = z.strictObject({ maxFileSizeMiB: number, dailyRereadsPerAsker: number, similarDocumentsToSuggest: number, proposedExpiryDays: number,
  discardedRetentionDays: number, revision: z.number().int().nonnegative() });
export type FormSettings = z.infer<typeof settings>;
export type FormSettingValues = Record<FormSettingField, number>;

export const formSettingsQueryKey = ["form-settings"] as const;

function read(body: unknown): FormSettings {
  const parsed = settings.safeParse(body);
  if (!parsed.success) throw new Error("Invalid form settings contract.");
  return parsed.data;
}

/** The settings as they are now: today's values at revision 0 while nobody saved them. */
export const fetchFormSettings = async (signal?: AbortSignal) => read(await api.get<unknown>("/api/forms/settings", { signal, cache: "no-store" }));

/** Saves every number with the revision read; a 409 `Forms.Settings.RevisionConflict` means someone saved first. */
export const updateFormSettings = async (values: FormSettingValues, expectedRevision: number) =>
  read(await api.put<unknown>("/api/forms/settings", { expectedRevision, ...values }));
