import { describe, expect, it } from "vitest";
import { timeZoneCity, timeZoneOptions } from "./timeZones";

const now = new Date("2026-11-20T12:00:00Z");

describe("timeZoneOptions", () => {
  it("names each zone by its city and, in grey, the time of its country and its offset", () => {
    const montevideo = timeZoneOptions("es", [], now).find(option => option.id === "America/Montevideo");

    expect(montevideo?.label).toBe("Montevideo");
    expect(montevideo?.description).toMatch(/Uruguay · GMT-3$/);
    expect(montevideo?.keywords).toContain("America/Montevideo");
  });

  it("orders the zones by their city", () => {
    const labels = timeZoneOptions("es", [], now).map(option => option.label);

    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "es")));
  });

  it("keeps a saved alias in the place of its zone, so the field starts with it chosen", () => {
    const options = timeZoneOptions("es", ["America/Argentina/Buenos_Aires"], now);

    expect(options.filter(option => option.label === "Buenos Aires").map(option => option.id)).toEqual(["America/Argentina/Buenos_Aires"]);
  });

  it("lets the first kept zone stand for its zone and leaves out another alias of it", () => {
    const options = timeZoneOptions("es", ["America/Buenos_Aires", "America/Argentina/Buenos_Aires"], now);

    expect(options.filter(option => option.label === "Buenos Aires").map(option => option.id)).toEqual(["America/Buenos_Aires"]);
  });

  it("adds a kept zone the browser does not list, with only its offset when it has no name", () => {
    const utc = timeZoneOptions("es", ["UTC"], now).find(option => option.id === "UTC");

    expect(utc).toEqual(expect.objectContaining({ label: "UTC", description: "GMT+0" }));
  });

  it("speaks the language of the menu", () => {
    expect(timeZoneOptions("en", [], now).find(option => option.id === "America/Montevideo")?.description).toMatch(/Uruguay .*Time · GMT-3$/);
  });
});

describe("timeZoneCity", () => {
  it("is the last part of the identifier, with spaces", () => {
    expect(timeZoneCity("America/Argentina/Buenos_Aires")).toBe("Buenos Aires");
    expect(timeZoneCity("UTC")).toBe("UTC");
  });
});
