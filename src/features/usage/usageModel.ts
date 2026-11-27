import { calendarDateInZone } from "@/shared/lib/dateTime";
import type { AiModelUsage, AiUsage, WhatsAppUsage } from "./api/usage";

/** How many months the month list offers, the current one first. */
export const offeredMonths = 12;

/** The month of the business now (PR16): it starts at midnight in the time zone of the general settings, not in UTC. */
export function currentMonth(now: Date, timeZone: string): string {
  return calendarDateInZone(now.toISOString(), timeZone).slice(0, 7);
}

/** The last months up to the current one, newest first (`2026-11`, `2026-10`…). */
export function recentMonths(current: string, count = offeredMonths): string[] {
  const [year, month] = current.split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, back) => {
    const index = year * 12 + month - 1 - back;
    return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`;
  });
}

/** The month of the address when the list offers it; any other value, or none, is the current month. */
export function chosenMonth(param: string | null, months: readonly string[]): string {
  return param !== null && months.includes(param) ? param : months[0]!;
}

export interface AiTotals {
  requests: number;
  /** Null when no model of the month reported it. */
  inputTokens: number | null;
  outputTokens: number | null;
  audioSeconds: number | null;
}

function sumKnown(values: readonly (number | null)[]): number | null {
  const known = values.filter((value): value is number => value !== null);
  return known.length ? known.reduce((total, value) => total + value, 0) : null;
}

/** The row «Total» of the AI: what every model reported, and unknown only when none did. */
export function aiTotals(models: readonly AiModelUsage[]): AiTotals {
  return {
    requests: models.reduce((total, model) => total + model.requests, 0),
    inputTokens: sumKnown(models.map(model => model.inputTokens)),
    outputTokens: sumKnown(models.map(model => model.outputTokens)),
    audioSeconds: sumKnown(models.map(model => model.audioSeconds)),
  };
}

/** The estimate of the month with the prices loaded (PR13); none when the month has models and none of them has a price. */
export function aiEstimatedCost(usage: AiUsage): number | null {
  return usage.models.length > 0 && usage.models.every(model => model.estimatedCostUsd === null) ? null : usage.totalEstimatedCostUsd;
}

/** «Total del mes»: only with both zones read, WhatsApp in dollars and an estimate of the AI; otherwise it is not shown. */
export function monthTotal(ai: AiUsage | undefined, whatsapp: WhatsAppUsage | undefined): number | null {
  if (!ai || !whatsapp || !whatsapp.configured || whatsapp.currency !== "USD") return null;
  const estimate = aiEstimatedCost(ai);
  return estimate === null ? null : estimate + whatsapp.totalCost;
}

const categories = new Map<string, string>([
  ["MARKETING", "marketing"], ["MARKETING_LITE", "marketingLite"], ["UTILITY", "utility"], ["AUTHENTICATION", "authentication"],
  ["AUTHENTICATION_INTERNATIONAL", "authenticationInternational"], ["SERVICE", "service"], ["REFERRAL_CONVERSION", "referralConversion"],
]);

/** The key of the name of a category of Meta (`whatsapp.categories.*`); null for one it does not know, shown as Meta sends it. */
export function categoryKey(category: string): string | null {
  return categories.get(category) ?? null;
}
