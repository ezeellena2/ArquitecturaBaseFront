// Design-lab placeholder for the API contract proposed in the design document.
// No network, redirect resolution, geocoding or inference of a place's facts.
export function googleMapsSearchUrl(query: string): string | null {
  const value = query.trim();
  if (!value) return null;
  const url = new URL("https://www.google.com/maps/search/");
  url.searchParams.set("api", "1");
  url.searchParams.set("query", value);
  return url.href;
}

export function googleMapsPlaceLink(value: string): string | null {
  const text = value.trim();
  if (!text || text.length > 4096 || [...text].some(character => character.charCodeAt(0) <= 32)) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const mapsPath = url.pathname === "/maps" || url.pathname.startsWith("/maps/");
    const allowed = (url.hostname === "maps.app.goo.gl" && url.pathname.length > 1)
      || (url.hostname === "goo.gl" && url.pathname.startsWith("/maps/") && url.pathname.length > 6)
      || (["google.com", "www.google.com", "google.com.ar", "www.google.com.ar"].includes(url.hostname) && mapsPath)
      || url.hostname === "maps.google.com";
    return allowed ? url.href : null;
  } catch {
    return null;
  }
}
