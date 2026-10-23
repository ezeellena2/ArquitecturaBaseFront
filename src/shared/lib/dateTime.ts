/// El backend manda las fechas en UTC con `Z` (sección 6.3 del spec maestro) y la pantalla las muestra en la
/// zona horaria del perfil, nunca la cadena cruda. Es el único formateador de fecha y hora del front: si
/// aparece otro, las mismas fechas se van a ver distinto en dos pantallas.
///
/// `timeZone: undefined` deja la del navegador, que es lo correcto mientras el perfil todavía no llegó.
export function formatDateTimeInZone(valueUtc: string, language: string, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    new Date(valueUtc),
  );
}

/// Fecha sola, para las columnas de un listado: "20 sept 2026". La hora no aporta a la hora de barrer una
/// tabla con la vista, y ocupa el doble. Vive en este archivo a propósito: un formateador suelto en una
/// pantalla es lo que hace que las mismas fechas se vean distinto en dos lugares.
export function formatDateInZone(valueUtc: string, language: string, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone }).format(new Date(valueUtc));
}

export function formatTimeInZone(valueUtc: string, language: string, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat(language, { timeStyle: "short", timeZone }).format(new Date(valueUtc));
}

// Stable calendar identity for grouping instants; display labels still use the person's language.
export function calendarDateInZone(valueUtc: string, timeZone: string | undefined): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(valueUtc));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

// A calendar day has no profile time zone. UTC is only the stable anchor used by Intl.
export function formatDateOnly(value: string, language: string, style: "medium" | "numeric" = "medium"): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return null;
  const day = new Date(value + "T00:00:00.000Z");
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value) return null;
  return new Intl.DateTimeFormat(language, style === "numeric" ? { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" } : { dateStyle: "medium", timeZone: "UTC" }).format(day);
}

export function formatRelativeTime(valueUtc: string, language: string, now = Date.now()): string {
  const seconds = Math.min(0, Math.round((Date.parse(valueUtc) - now) / 1000));
  const [unit, scale]: [Intl.RelativeTimeFormatUnit, number] = Math.abs(seconds) >= 86400 ? ["day",86400] : Math.abs(seconds) >= 3600 ? ["hour",3600] : Math.abs(seconds) >= 60 ? ["minute",60] : ["second",1];
  return new Intl.RelativeTimeFormat(language, { numeric: "always" }).format(Math.round(seconds / scale), unit);
}
