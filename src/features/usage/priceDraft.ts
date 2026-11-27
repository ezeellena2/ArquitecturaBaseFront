import { formatNumber } from "@/shared/lib/numberFormat";
import { priceLimits, type AiModelPrice } from "./api/usage";

/** The three fields of the dialog «Precios», as they are written. */
export const priceFields = ["input", "output", "audio"] as const;
export type PriceField = (typeof priceFields)[number];
export type PriceDraft = Record<PriceField, string>;
/** The prices as numbers; null is «no price», which is valid. */
export type PriceValues = Record<PriceField, number | null>;

const maximum: Record<PriceField, number> = {
  input: priceLimits.maxUsdPerMillionTokens, output: priceLimits.maxUsdPerMillionTokens, audio: priceLimits.maxUsdPerMinute,
};

export function valuesOf(price: AiModelPrice | null): PriceValues {
  return { input: price?.inputUsdPerMillion ?? null, output: price?.outputUsdPerMillion ?? null, audio: price?.audioUsdPerMinute ?? null };
}

/** A price as the field shows it: the decimal sign of the language, at least two decimals and no thousands separator, so that
 * it reads back the same. */
function priceText(value: number | null, language: string): string {
  return value === null ? "" : formatNumber(value, language, { minimumFractionDigits: 2, maximumFractionDigits: priceLimits.maxDecimals, useGrouping: false });
}

export function draftFromPrice(price: AiModelPrice | null, language: string): PriceDraft {
  const values = valuesOf(price);
  return { input: priceText(values.input, language), output: priceText(values.output, language), audio: priceText(values.audio, language) };
}

/** Undefined when the text is not a price: a number of the range of its field with up to six decimals, with a comma in Spanish
 * (a point is also taken) and a point in English. Empty is no price. */
function parsePrice(text: string, field: PriceField, language: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const english = language.toLowerCase().startsWith("en");
  if (!(english ? /^\d+(?:\.\d+)?$/ : /^\d+(?:[,.]\d+)?$/).test(trimmed)) return undefined;
  const canonical = trimmed.replace(",", ".");
  const decimals = canonical.split(".")[1]?.length ?? 0;
  const value = Number(canonical);
  return decimals <= priceLimits.maxDecimals && value <= maximum[field] ? value : undefined;
}

/** The prices to send, or the fields that are not a price of their range. */
export function priceValues(draft: PriceDraft, language: string): { values: PriceValues } | { errors: Partial<Record<PriceField, "invalid">> } {
  const parsed = priceFields.map(field => [field, parsePrice(draft[field], field, language)] as const);
  const errors = Object.fromEntries(parsed.filter(([, value]) => value === undefined).map(([field]) => [field, "invalid" as const]));
  return Object.keys(errors).length ? { errors } : { values: Object.fromEntries(parsed) as PriceValues };
}

export function changedPriceFields(first: PriceValues, second: PriceValues): PriceField[] {
  return priceFields.filter(field => first[field] !== second[field]);
}

/** Guardar is on when a field differs from what was saved; a text that is not a price counts as a change. */
export function isPriceDraftDirty(draft: PriceDraft, base: PriceValues, language: string): boolean {
  return priceFields.some(field => parsePrice(draft[field], field, language) !== base[field]);
}

/** «Conservar mis cambios» after a conflict (N2): what the draft changed stays, and the rest takes what is saved now. */
export function keepPriceDraftChanges(draft: PriceDraft, base: PriceValues, current: AiModelPrice | null, language: string): PriceDraft {
  const saved = draftFromPrice(current, language);
  return Object.fromEntries(priceFields.map(field => [field, parsePrice(draft[field], field, language) === base[field] ? saved[field] : draft[field]])) as PriceDraft;
}
