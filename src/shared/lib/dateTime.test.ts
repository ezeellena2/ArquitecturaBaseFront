import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDateTimeInZone, formatDateInZone, formatTimeInZone, calendarDateInZone, formatDateOnly, formatRelativeTime } from "./dateTime";

describe("formatDateTimeInZone", () => {
  it("shows a UTC instant in the profile's time zone", () => {
    // 12:00 UTC son las 9:00 en Buenos Aires (UTC-3). El texto es el que arma ICU para "es".
    expect(formatDateTimeInZone("2026-09-18T12:00:00Z", "es", "America/Argentina/Buenos_Aires")).toBe(
      "18/09/2026, 9:00",
    );
  });

  it("uses the time zone even when it changes the day", () => {
    // Lo que se está probando: que la zona se aplique de verdad. En Madrid ese instante ya es del día siguiente.
    expect(formatDateTimeInZone("2026-09-19T23:30:00Z", "es", "Europe/Madrid")).toBe("20/09/2026, 1:30");
  });

  it("never writes the month as a word, in any language", () => {
    const instant = "2026-11-03T21:00:00Z";
    for (const language of ["es", "en", "pt-BR"]) {
      expect(formatDateTimeInZone(instant, language, "America/Argentina/Buenos_Aires")).toMatch(/^\d{2}\/\d{2}\/2026, /);
      expect(formatDateInZone(instant, language, "America/Argentina/Buenos_Aires")).toMatch(/^\d{2}\/\d{2}\/2026$/);
      expect(formatDateOnly("2026-11-03", language)).toMatch(/^\d{2}\/\d{2}\/2026$/);
    }
  });
});

describe("formatDateInZone", () => {
  it("writes day, month and year with two digits for the day and the month", () => {
    expect(formatDateInZone("2026-11-03T21:00:00Z", "es", "America/Argentina/Buenos_Aires")).toBe("03/11/2026");
    expect(formatDateInZone("2026-11-03T21:00:00Z", "en", "America/Argentina/Buenos_Aires")).toBe("11/03/2026");
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
  it("writes a calendar date with numbers only", () => {
    expect(formatDateOnly("2026-10-08", "es")).toBe("08/10/2026");
    expect(formatDateOnly("2026-10-08", "en")).toBe("10/08/2026");
  });
  it("keeps a calendar day independent of the profile time zone", () => {
    // Un día de calendario no tiene zona: UTC es solo el ancla de Intl, así que nunca corre el día.
    expect(formatDateOnly("2026-10-08", "es")).toBe("08/10/2026");
    expect(formatDateOnly("2026-01-01", "es")).toBe("01/01/2026");
    expect(formatDateOnly("2026-12-31", "es")).toBe("31/12/2026");
  });
  it("preserves valid leap days and early calendar years", () => {
    expect(formatDateOnly("2024-02-29", "es")).toBe("29/02/2024");
    expect(formatDateOnly("0001-01-01", "en")).toBe("01/01/1");
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
    formatDateOnly("2026-10-08", "pt-BR"),
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
    expect(formatDateTimeInZone(instant, "es", "America/Argentina/Buenos_Aires")).toBe("02/10/2026, 20:30");
    expect(formatDateTimeInZone(instant, "es", "Europe/Madrid")).toBe("03/10/2026, 1:30");
    expect(formatDateTimeInZone(instant, "en-US", "America/Argentina/Buenos_Aires")).toBe("10/02/2026, 8:30 PM");
    expect(formatDateInZone(instant, "es", "Europe/Madrid")).toBe("03/10/2026");
    expect(formatTimeInZone(instant, "es", "Europe/Madrid")).toBe("1:30");
    expect(calendarDateInZone(instant, "America/Argentina/Buenos_Aires")).toBe("2026-10-02");
    expect(calendarDateInZone(instant, "Europe/Madrid")).toBe("2026-10-03");
  });
});
