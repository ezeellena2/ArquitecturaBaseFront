import { describe, expect, it } from "vitest";
import { formatDateTimeInZone, formatTimeInZone, calendarDateInZone } from "./dateTime";

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
