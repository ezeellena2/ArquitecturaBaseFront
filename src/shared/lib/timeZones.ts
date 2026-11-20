/** A time zone to choose (board DS1-A, figure 5): the city, and in grey the time of its country and its offset
 * («Montevideo · hora de Uruguay · GMT-3»). The value that travels is still the IANA identifier, which the search also finds. */
export interface TimeZoneOption {
  id: string;
  label: string;
  description: string | null;
  keywords: string;
}

// Naming the 418 zones takes some 200 ms: once per language and day, since the offset changes with the summer time.
const lists = new Map<string, readonly TimeZoneOption[]>();

/** The city of an IANA identifier, with spaces: «America/Argentina/Buenos_Aires» is «Buenos Aires». */
export function timeZoneCity(zone: string): string {
  return (zone.split("/").at(-1) ?? zone).replaceAll("_", " ");
}

function part(zone: string, language: string, now: Date, style: "longGeneric" | "shortOffset"): string | null {
  try {
    return new Intl.DateTimeFormat(language, { timeZone: zone, timeZoneName: style }).formatToParts(now).find(item => item.type === "timeZoneName")?.value ?? null;
  } catch {
    return null;
  }
}

function option(zone: string, language: string, now: Date): TimeZoneOption {
  const name = part(zone, language, now, "longGeneric"), offset = part(zone, language, now, "shortOffset");
  // UTC has no name of its own: the name would repeat the offset («GMT+00:00»).
  const named = name && !/^(GMT|UTC)/.test(name) ? name : null;
  return { id: zone, label: timeZoneCity(zone), description: [named, offset].filter(Boolean).join(" · ") || null, keywords: zone.replaceAll("_", " ") };
}

function canonical(zone: string): string {
  try {
    return new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return zone;
  }
}

/**
 * The only list of time zones, for Mi perfil, Configuración and the business hours: every zone the browser knows, in the
 * alphabetical order of its city, plus the ones in `keep` (the saved one, a default) that it does not list, such as «UTC».
 * The backend may keep an alias, such as «America/Argentina/Buenos_Aires», that the browser calls «America/Buenos_Aires»:
 * the first kept one takes the place of its zone, so the field starts with it chosen and saving does not change it.
 */
export function timeZoneOptions(language: string, keep: readonly (string | null | undefined)[] = [], now = new Date()): TimeZoneOption[] {
  const key = `${language}|${now.toISOString().slice(0, 10)}`;
  let base = lists.get(key);
  if (!base) {
    base = Intl.supportedValuesOf("timeZone").map(zone => option(zone, language, now)).sort((a, b) => a.label.localeCompare(b.label, language));
    lists.set(key, base);
  }
  const result = [...base], kept = new Set<string>();
  let added = false;
  for (const zone of keep) {
    if (!zone) continue;
    const same = canonical(zone);
    const index = result.findIndex(item => item.id === zone || item.id === same);
    if (index >= 0 && kept.has(result[index].id)) continue;
    const entry = option(zone, language, now);
    if (index >= 0) result[index] = entry;
    else { result.push(entry); added = true; }
    kept.add(zone);
  }
  return added ? result.sort((a, b) => a.label.localeCompare(b.label, language)) : result;
}
