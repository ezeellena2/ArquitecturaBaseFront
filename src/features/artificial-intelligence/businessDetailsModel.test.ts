import { describe, expect, it } from "vitest";
import { emptyBusinessDetails, normalizeDetails, validateHours, validPoint, mapLink } from "./businessDetailsModel";
describe("guided business facts", () => {
  it("rejects a Sunday period that overlaps Monday but accepts touching boundaries", () => {
    const days = emptyBusinessDetails("UTC").openingHours.days;
    days[6] = { weekday: 6, status: "open", periods: [{ start: "22:00", end: "02:00", nextDay: true }] };
    days[0] = { weekday: 0, status: "open", periods: [{ start: "01:00", end: "09:00", nextDay: false }] };
    expect(validateHours(days)).toBe("overlap");
    days[0].periods[0].start = "02:00"; expect(validateHours(days)).toBeUndefined();
  });
  it("requires complete quarter-hour periods and explicit overnight closing", () => {
    const days = emptyBusinessDetails("UTC").openingHours.days;
    days[0] = { weekday: 0, status: "open", periods: [{ start: "18:00", end: "09:00", nextDay: false }] };
    expect(validateHours(days)).toBe("order");
    days[0].periods[0] = { start: "09:01", end: "18:00", nextDay: false };
    expect(validateHours(days)).toBe("incomplete");
  });
  it("normalizes facts without transmitting the derived URL or mutating the draft", () => {
    const value = emptyBusinessDetails("UTC");
    value.location = { mode: "local", address: " Address ", reference: "", area: "", latitude: -34.6037, longitude: -58.3816, link: "https://malicious.invalid/" };
    value.faq = [{ id: "00000000-0000-4000-8000-000000000001", question: " Question ", answer: " Answer " }];
    const normalized = normalizeDetails(value);
    expect(normalized.location).not.toHaveProperty("link");
    expect(normalized.location.address).toBe("Address"); expect(normalized.faq[0].answer).toBe("Answer");
    expect(value.faq[0].answer).toBe(" Answer ");
  });
  it("does not preload a location or opening hours and generates the link locally", () => {
    const value = emptyBusinessDetails("UTC"); expect(value.location.latitude).toBeNull();
    expect(value.openingHours.days.every(day => day.status === "unknown")).toBe(true); expect(value.faq).toEqual([]);
    expect(validPoint(null, 0)).toBe(false); expect(validPoint(Infinity, 0)).toBe(false); expect(validPoint(90, 180)).toBe(true);
    expect(mapLink({ latitude: -34.6037, longitude: -58.3816 })).toBe("https://www.google.com/maps/search/?api=1&query=-34.6037%2C-58.3816");
  });
  it("canonicalizes day, date and period order without changing the input", () => {
    const value = emptyBusinessDetails("UTC");
    value.openingHours.days.reverse();
    value.openingHours.days[6] = { weekday: 0, status: "open", periods: [{ start: "14:00", end: "18:00", nextDay: false }, { start: "09:00", end: "12:00", nextDay: false }] };
    value.openingHours.exceptions = [{ date: "2026-12-25", status: "closed", periods: [] }, { date: "2026-10-10", status: "closed", periods: [] }];
    const normalized = normalizeDetails(value);
    expect(normalized.openingHours.days[0].weekday).toBe(0);
    expect(normalized.openingHours.days[0].periods.map(x => x.start)).toEqual(["09:00", "14:00"]);
    expect(normalized.openingHours.exceptions[0].date).toBe("2026-10-10");
    expect(value.openingHours.days[0].weekday).toBe(6);
  });
});
