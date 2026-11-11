import { describe, expect, it } from "vitest";
import { formatCoordinates, mapUrl } from "./mapPoint";

describe("a point on the map", () => {
  it("is written with six decimals and a point in any language, and opens the map at that point", () => {
    const point = { latitude: -34.6037224, longitude: -58.38 };

    expect(formatCoordinates(point)).toBe("-34.603722, -58.380000");
    expect(mapUrl(point)).toBe("https://www.google.com/maps?q=-34.603722,-58.380000");
  });
});
