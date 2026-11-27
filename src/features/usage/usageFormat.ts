import { formatNumber } from "@/shared/lib/numberFormat";

/** An amount with two decimals and the thousands of the language («4,76», «1.234,50»); the currency goes in the text. */
export function amountText(value: number, language: string): string {
  return formatNumber(value, language, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** The audio of a model in minutes with one decimal («96,5»). */
export function minutesText(seconds: number, language: string): string {
  return formatNumber(seconds / 60, language, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
