import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateTimeInZone, formatDateInZone, formatTimeInZone, calendarDateInZone, formatDateOnly, formatRelativeTime } from "./dateTime";

describe("formatDateTimeInZone", () => {
  it("shows a UTC instant in the profile's time zone", () => {
    // 12:00 UTC son las 9:00 en Buenos Aires (UTC-3). El texto es el que arma ICU para "es".
    expect(formatDateTimeInZone("2026-09-18T12:00:00Z", "es", "America/Argentina/Buenos_Aires")).toBe(
      "18 sept 2026, 9:00",
    );
  });

  it("uses the time zone even when it changes the day", () => {
    // Lo que se está probando: que la zona se aplique de verdad. En Madrid ese instante ya es del día siguiente.
    expect(formatDateTimeInZone("2026-09-19T23:30:00Z", "es", "Europe/Madrid")).toBe("20 sept 2026, 1:30");
  });
});

describe("calendar dates and message times", () => {
  it("formats the local time independently of the displayed date", () => {
    expect(formatTimeInZone("2026-10-02T12:00:00Z", "es", "America/Argentina/Buenos_Aires")).toBe("9:00");
  });
  it("keeps both repeated hours on the same day across the autumn clock change", () => {
    for (const utc of ["2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z"]) {
      expect(calendarDateInZone(utc, "America/New_York")).toBe("2026-11-01");
      expect(formatTimeInZone(utc, "en-US", "America/New_York")).toBe("1:30 AM");
    }
  });
});


describe("formatDateOnly", () => {
  it("offers a numeric calendar date without changing the default presentation", () => {
    expect(formatDateOnly("2026-10-08", "es", "numeric")).toBe("08/10/2026");
    expect(formatDateOnly("2026-10-08", "en", "numeric")).toBe("10/08/2026");
  });
  it("keeps a calendar day independent of the profile time zone", () => {
    expect(formatDateOnly("2026-10-08", "es")).toBe("8 oct 2026");
    expect(formatDateOnly("2026-10-08", "en")).toBe("Oct 8, 2026");
  });
  it("preserves valid leap days and early calendar years", () => {
    expect(formatDateOnly("2024-02-29", "es")).toBe("29 feb 2024");
    expect(formatDateOnly("0001-01-01", "en")).toBe("Jan 1, 1");
  });
  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-10-00", "2026-10-08T00:00:00Z", "2026-1-8", "", "0000-01-01"])("rejects an invalid calendar day %s", value => {
    expect(formatDateOnly(value, "es")).toBeNull();
  });
});

// Building an Intl formatter costs about a hundred times more than using one, and a chat history formats several
// dates per message on every render.
describe("formatter reuse", () => {
  afterEach(() => { vi.restoreAllMocks(); });
  const formatAll = (valueUtc: string) => [
    formatDateTimeInZone(valueUtc, "pt-BR", "Asia/Tokyo"), formatDateInZone(valueUtc, "pt-BR", "Asia/Tokyo"),
    formatTimeInZone(valueUtc, "pt-BR", "Asia/Tokyo"), calendarDateInZone(valueUtc, "Asia/Tokyo"),
    formatDateOnly("2026-10-08", "pt-BR"), formatDateOnly("2026-10-08", "pt-BR", "numeric"),
    formatRelativeTime(valueUtc, "pt-BR", Date.parse("2026-10-16T12:00:00Z")),
  ];

  it("builds no new formatter for a language, zone and style already used", () => {
    formatAll("2026-10-02T12:00:00Z");
    const dates = vi.spyOn(Intl, "DateTimeFormat");
    const relative = vi.spyOn(Intl, "RelativeTimeFormat");
    formatAll("2026-10-03T12:00:00Z");
    formatAll("2026-10-04T23:30:00Z");
    expect(dates).not.toHaveBeenCalled();
    expect(relative).not.toHaveBeenCalled();
  });

  it("keeps each language and zone with its own formatter", () => {
    const instant = "2026-10-02T23:30:00Z";
    expect(formatDateTimeInZone(instant, "es", "America/Argentina/Buenos_Aires")).toBe("2 oct 2026, 20:30");
    expect(formatDateTimeInZone(instant, "es", "Europe/Madrid")).toBe("3 oct 2026, 1:30");
    expect(formatDateTimeInZone(instant, "en-US", "America/Argentina/Buenos_Aires")).toBe("Oct 2, 2026, 8:30 PM");
    expect(formatDateInZone(instant, "es", "Europe/Madrid")).toBe("3 oct 2026");
    expect(formatTimeInZone(instant, "es", "Europe/Madrid")).toBe("1:30");
    expect(calendarDateInZone(instant, "America/Argentina/Buenos_Aires")).toBe("2026-10-02");
    expect(calendarDateInZone(instant, "Europe/Madrid")).toBe("2026-10-03");
  });
});
