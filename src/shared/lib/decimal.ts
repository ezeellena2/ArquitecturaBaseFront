// The canonical value is text: neither its integer nor its fraction passes through Number.
export function formatExactDecimal(value: string, language: string): string | null {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
  const [integer, fraction] = value.split(".");
  const formatter = new Intl.NumberFormat(language);
  const whole = integer === "-0"
    ? formatter.formatToParts(-1n).map(part => part.type === "integer" ? "0" : part.value).join("")
    : formatter.format(BigInt(integer));
  if (fraction === undefined) return whole;
  const decimal = new Intl.NumberFormat(language, { minimumFractionDigits: 1 }).formatToParts(0n)
    .find(part => part.type === "decimal")!.value;
  return whole + decimal + fraction;
}
