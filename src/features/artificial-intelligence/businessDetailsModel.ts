import type { BusinessDetails, BusinessLocation, OpeningDay, OpeningPeriod } from "./api/businessInformation";
export const emptyPeriod = (): OpeningPeriod => ({ start: "", end: "", nextDay: false });
export const emptyBusinessDetails = (timeZoneId: string): BusinessDetails => ({
  location: { mode: "unknown", address: "", reference: "", area: "", latitude: null, longitude: null },
  openingHours: { timeZoneId, days: Array.from({ length: 7 }, (_, weekday) => ({ weekday, status: "unknown", periods: [] })), exceptions: [] }, faq: [],
});
export const timeOptions = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, "0")}:${String(index % 4 * 15).padStart(2, "0")}`);
export function mapLink(point: { latitude: number; longitude: number }): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1"); url.searchParams.set("query", `${point.latitude},${point.longitude}`); return url.toString();
}
export function validPoint(latitude: number | null, longitude: number | null): boolean {
  return latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}
export function businessLocationLink(location: BusinessLocation): string {
  if (location.placeId) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address.trim() || "Place")}&query_place_id=${encodeURIComponent(location.placeId)}`;
  return validPoint(location.latitude, location.longitude) ? mapLink({ latitude: location.latitude!, longitude: location.longitude! }) : "";
}
export function validateHours(days: OpeningDay[], repeatWeek = true): "incomplete" | "order" | "overlap" | undefined {
  const intervals: { start: number; end: number }[] = [];
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  for (const day of days) {
    const offset = day.weekday * 1440;
    if (day.status === "allDay") intervals.push({ start: offset, end: offset + 1440 });
    if (day.status !== "open") continue;
    if (!day.periods.length || day.periods.length > 4) return "incomplete";
    for (const period of day.periods) {
      if (![period.start, period.end].every(value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value) && minutes(value) % 15 === 0)) return "incomplete";
      const start = offset + minutes(period.start), end = offset + minutes(period.end) + (period.nextDay ? 1440 : 0);
      if (end <= start || end - start > 1440) return "order";
      intervals.push({ start, end });
    }
  }
  const sorted = (repeatWeek ? intervals.concat(intervals.map(period => ({ start: period.start + 10080, end: period.end + 10080 }))) : intervals).sort((a, b) => a.start - b.start);
  return sorted.some((period, index) => index > 0 && period.start < sorted[index - 1].end) ? "overlap" : undefined;
}
export function validateBusinessDetails(value: BusinessDetails): Record<string, string> {
  const errors: Record<string, string> = {};
  const location = value.location;
  if (location.placeId != null && (!/^[!-~]{1,1024}$/.test(location.placeId.trim()) || location.latitude !== null || location.longitude !== null || location.mode === "unknown" || location.mode === "area")) errors["details.location"] = "locationInvalid";
  if ((location.latitude !== null || location.longitude !== null) && !validPoint(location.latitude, location.longitude)) errors["details.location"] = "coordinatesInvalid";
  if ([location.address, location.reference, location.area].some(text => text.length > 500)) errors["details.location"] = "locationInvalid";
  let hoursError: string | undefined = validateHours(value.openingHours.days);
  try { new Intl.DateTimeFormat("en", { timeZone: value.openingHours.timeZoneId }); } catch { hoursError = "timeZoneInvalid"; }
  const exceptions = value.openingHours.exceptions;
  if (exceptions.length > 32 || new Set(exceptions.map(x => x.date)).size !== exceptions.length) hoursError = "datesInvalid";
  for (const special of exceptions) {
    const date = new Date(`${special.date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(special.date) || !Number.isFinite(date.valueOf()) || date.toISOString().slice(0, 10) !== special.date || Number(special.date.slice(0, 4)) < 1900 || Number(special.date.slice(0, 4)) > 9998) { hoursError = "datesInvalid"; continue; }
    const adjacent = [-1, 0, 1].map((offset): OpeningDay => {
      const day = new Date(date.valueOf() + offset * 86400000);
      const override = exceptions.find(x => x.date === day.toISOString().slice(0, 10));
      return { ...(override ?? value.openingHours.days[(day.getUTCDay() + 6) % 7]), weekday: offset + 1 };
    });
    hoursError ??= validateHours(adjacent, false);
  }
  if (hoursError) errors["details.openingHours"] = `hourErrors.${hoursError}`;
  if (value.faq.length > 20 || value.faq.some(entry => !entry.question.trim() || entry.question.length > 200 || entry.answer.length > 1000)) errors["details.faq"] = "faqInvalid";
  return errors;
}
export const normalizeDetails = (value: BusinessDetails): BusinessDetails => ({
  location: { mode: value.location.mode, address: value.location.address.trim(), reference: value.location.reference.trim(), area: value.location.area.trim(), latitude: value.location.latitude === null ? null : Number(value.location.latitude.toFixed(6)), longitude: value.location.longitude === null ? null : Number(value.location.longitude.toFixed(6)), ...(value.location.placeId != null ? { placeId: value.location.placeId.trim() } : {}) },
  openingHours: { timeZoneId: value.openingHours.timeZoneId, days: value.openingHours.days.map(day => ({ ...day, periods: day.periods.map(period => ({ ...period })).sort((a, b) => a.start.localeCompare(b.start)) })).sort((a, b) => a.weekday - b.weekday), exceptions: value.openingHours.exceptions.map(day => ({ ...day, periods: day.periods.map(period => ({ ...period })).sort((a, b) => a.start.localeCompare(b.start)) })).sort((a, b) => a.date.localeCompare(b.date)) },
  faq: value.faq.map(entry => ({ ...entry, question: entry.question.trim(), answer: entry.answer.trim() })),
});
export const hasBusinessFacts = (value: BusinessDetails): boolean => !!(value.location.address.trim() || value.location.area.trim() || value.location.placeId || validPoint(value.location.latitude, value.location.longitude)
  || value.openingHours.days.some(day => day.status !== "unknown") || value.openingHours.exceptions.length || value.faq.some(entry => entry.question.trim() && entry.answer.trim()));
export const detailsEqual = (left: unknown, right: unknown): boolean => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
