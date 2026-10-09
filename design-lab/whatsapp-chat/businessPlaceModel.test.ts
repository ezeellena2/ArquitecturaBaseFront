import { describe, expect, it } from "vitest";
import { googleMapsSearchUrl, googleMapsPlaceLink } from "./businessPlaceModel";

describe("business place prototype links", () => {
  it("opens a name search without treating it as a selected place", () => {
    const url = new URL(googleMapsSearchUrl("  Sanatorio Plaza, mi ciudad  ")!);
    expect(url.origin).toBe("https://www.google.com");
    expect(url.pathname).toBe("/maps/search/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("query")).toBe("Sanatorio Plaza, mi ciudad");
    expect(googleMapsSearchUrl("   ")).toBeNull();
  });

  it.each([
    "https://maps.app.goo.gl/example",
    "https://goo.gl/maps/example",
    "https://www.google.com/maps/place/Sanatorio+Plaza/",
    "https://www.google.com.ar/maps/place/Sanatorio+Plaza/",
    "https://maps.google.com/?cid=1234",
  ])("accepts a copied Maps link without fetching or deriving coordinates: %s", (value) => {
    expect(googleMapsPlaceLink(`  ${value}  `)).toBe(new URL(value).href);
  });

  it.each([
    "javascript:alert(1)", "http://maps.app.goo.gl/example", "https://maps.app.goo.gl.evil.example/example",
    "https://example.com/maps", "https://www.google.com/url?q=https://example.com",
    "https://user:password@www.google.com/maps/place/Example", "https://www.google.com:1234/maps/place/Example",
    "https://www.google.com/maps/place/Ex\nample", "https://goo.gl/example", "https://maps.app.goo.gl/", "",
  ])("rejects an unsupported or unsafe link: %s", (value) => {
    expect(googleMapsPlaceLink(value)).toBeNull();
  });
});
