// The canonical value is text: neither its integer nor its fraction passes through Number.
export function formatExactDecimal(value: string, language: string): string | null {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  const [integer, fraction] = value.split(".");
  const { formatter, decimal } = numberFormat(language);
  const whole = integer === "-0"
    ? formatter.formatToParts(-1n).map(part => part.type === "integer" ? "0" : part.value).join("")
    : formatter.format(BigInt(integer));
  if (fraction === undefined) return whole;
  return whole + decimal + fraction;
}

// A catalog table formats every numeric cell on every render, and building a formatter costs about a hundred times
// more than using one: each language keeps its formatter and its decimal separator.
const numberFormats = new Map<string, { formatter: Intl.NumberFormat; decimal: string }>();

function numberFormat(language: string): { formatter: Intl.NumberFormat; decimal: string } {
  let format = numberFormats.get(language);
  if (!format) numberFormats.set(language, format = {
    formatter: new Intl.NumberFormat(language),
    decimal: new Intl.NumberFormat(language, { minimumFractionDigits: 1 }).formatToParts(0n).find(part => part.type === "decimal")!.value,
  });
  return format;
}
