import { numberFormat, numberLocale } from "./numberFormat";

// The canonical value is text: neither its integer nor its fraction passes through Number. It is written with the one number
// format (numberFormat.ts): «1.210,5» in Spanish and «1,210.5» in English.
export function formatExactDecimal(value: string, language: string): string | null {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  const [integer, fraction] = value.split(".");
  const formatter = numberFormat(language);
  const decimal = decimalSign(language);
  const whole = integer === "-0"
    ? formatter.formatToParts(-1n).map(part => part.type === "integer" ? "0" : part.value).join("")
    : formatter.format(BigInt(integer));
  if (fraction === undefined) return whole;
  return whole + decimal + fraction;
}

// A catalog table formats every numeric cell on every render: the formatters are shared (numberFormat.ts) and each region keeps
// its decimal sign.
const decimalSigns = new Map<string, string>();

function decimalSign(language: string): string {
  const locale = numberLocale(language);
  let sign = decimalSigns.get(locale);
  if (sign === undefined) decimalSigns.set(locale, sign = numberFormat(locale, { minimumFractionDigits: 1 }).formatToParts(0n).find(part => part.type === "decimal")!.value);
  return sign;
}
