export interface OpeningPeriod { start: string; end: string; nextDay: boolean }
export interface OpeningDay { weekday: number; status: "unknown" | "open" | "closed" | "allDay"; periods: OpeningPeriod[] }
export interface FaqEntry { id: string; question: string; answer: string }
export interface LocationPoint { latitude: number; longitude: number }
export function mapLink(point: LocationPoint): string {
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", `${point.latitude},${point.longitude}`);
  return url.toString();
}
export const emptyPeriod = (): OpeningPeriod => ({ start: "", end: "", nextDay: false });
export const timeOptions = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, "0")}:${String(index % 4 * 15).padStart(2, "0")}`);
export function validateHours(days: OpeningDay[]): "incomplete" | "order" | "overlap" | undefined {
  const intervals: { start: number; end: number }[] = [];
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  for (const day of days) {
    const offset = day.weekday * 1440;
    if (day.status === "allDay") intervals.push({ start: offset, end: offset + 1440 });
    if (day.status !== "open") continue;
    if (!day.periods.length) return "incomplete";
    for (const period of day.periods) {
      if (![period.start, period.end].every(value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value))) return "incomplete";
      const start = offset + minutes(period.start);
      const end = offset + minutes(period.end) + (period.nextDay ? 1440 : 0);
      if (end <= start || end - start > 1440) return "order";
      intervals.push({ start, end });
    }
  }
  // Repeat the week to catch a Sunday period overlapping Monday.
  const sorted = intervals.concat(intervals.map(period => ({ start: period.start + 10080, end: period.end + 10080 }))).sort((a, b) => a.start - b.start);
  if (sorted.some((period, index) => index > 0 && period.start < sorted[index - 1].end)) return "overlap";
  return undefined;
}
export function confirmedFaq(entries: FaqEntry[]): FaqEntry[] {
  return entries.map(entry => ({ ...entry, question: entry.question.trim(), answer: entry.answer.trim() })).filter(entry => entry.question && entry.answer);
}
