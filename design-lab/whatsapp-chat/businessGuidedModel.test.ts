import { describe, expect, it } from "vitest";
import { confirmedFaq, mapLink, timeOptions, validateHours, type OpeningDay } from "./businessGuidedModel";

const day = (periods: OpeningDay["periods"], weekday = 0): OpeningDay => ({ weekday, status: "open", periods });
describe("guided business information mockup", () => {
  it("offers quarter-hour options in 24-hour notation", () => {
    expect(timeOptions).toContain("09:15");
    expect(timeOptions.at(-1)).toBe("23:45");
  });
  it("creates a shareable location link without a provider key", () => {
    const link = new URL(mapLink({ latitude: -34.6037, longitude: -58.3816 }));
    expect(link.origin).toBe("https://www.google.com");
    expect(link.pathname).toBe("/maps/search/");
    expect(link.searchParams.get("api")).toBe("1");
    expect(link.searchParams.get("query")).toBe("-34.6037,-58.3816");
    expect(link.searchParams.has("key")).toBe(false);
  });
  it("accepts split opening hours without overlapping periods", () => {
    expect(validateHours([day([{ start: "09:00", end: "13:00", nextDay: false }, { start: "16:00", end: "19:00", nextDay: false }])])).toBeUndefined();
  });
  it("requires both times for an open day", () => {
    expect(validateHours([day([{ start: "09:00", end: "", nextDay: false }])])).toBe("incomplete");
  });
  it("rejects closing before opening unless the next day is explicit", () => {
    expect(validateHours([day([{ start: "20:00", end: "02:00", nextDay: false }])])).toBe("order");
    expect(validateHours([day([{ start: "20:00", end: "02:00", nextDay: true }])])).toBeUndefined();
  });
  it("rejects overlapping periods", () => {
    expect(validateHours([day([{ start: "09:00", end: "13:00", nextDay: false }, { start: "12:00", end: "16:00", nextDay: false }])])).toBe("overlap");
  });
  it("allows touching periods", () => {
    expect(validateHours([day([{ start: "09:00", end: "13:00", nextDay: false }, { start: "13:00", end: "16:00", nextDay: false }])])).toBeUndefined();
  });
  it("does not turn undefined days into closed days", () => {
    expect(validateHours([{ weekday: 0, status: "unknown", periods: [] }, { weekday: 1, status: "closed", periods: [] }])).toBeUndefined();
  });
  it("rejects a period longer than a day", () => {
    expect(validateHours([day([{ start: "09:00", end: "18:00", nextDay: true }])])).toBe("order");
  });
  it("detects overnight overlap into the next week", () => {
    expect(validateHours([day([{ start: "00:00", end: "03:00", nextDay: false }]), day([{ start: "20:00", end: "02:00", nextDay: true }], 6)])).toBe("overlap");
  });
  it("detects overlap with a day open for 24 hours", () => {
    expect(validateHours([day([{ start: "20:00", end: "02:00", nextDay: true }]), { weekday: 1, status: "allDay", periods: [] }])).toBe("overlap");
  });
  it("does not include unanswered FAQ presets as confirmed information", () => {
    expect(confirmedFaq([{ id: "a", question: "Do you deliver?", answer: "" }, { id: "b", question: "  Do I need to book? ", answer: " Yes. " }, { id: "c", question: "", answer: "Incomplete" }])).toEqual([{ id: "b", question: "Do I need to book?", answer: "Yes." }]);
  });
});
