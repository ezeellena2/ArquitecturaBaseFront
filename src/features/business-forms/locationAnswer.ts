/**
 * The location question (UB1-A to UB4-A): a point the device reports when the form is loaded. It travels as the text of an
 * object, `{"latitude":…,"longitude":…,"accuracyMeters":…}`, and the server checks it again. It is what the device said: nothing
 * proves the person was there.
 */
export interface LocationPoint {
  latitude: number;
  longitude: number;
  /** How far the point may be, in whole meters; the browser always says it, an old answer may not have it. */
  accuracyMeters?: number;
}

/** More than this many meters is a low accuracy: amber, with its (i), and it can be sent all the same. */
export const lowAccuracyMeters = 100;
/** The server takes up to this many meters: a farther point is not a location worth keeping. */
export const maxAccuracyMeters = 100_000;

/** Why the browser did not give the point: no permission, no signal (or it took too long), or it cannot give it at all. */
export type LocationProblem = "denied" | "unavailable" | "unsupported";

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

/** The answer as the form sends it; an empty text when there is no point. */
export function locationAnswer(point: LocationPoint | null): string {
  if (!point) return "";
  return JSON.stringify(point.accuracyMeters === undefined
    ? { latitude: point.latitude, longitude: point.longitude }
    : { latitude: point.latitude, longitude: point.longitude, accuracyMeters: point.accuracyMeters });
}

/** The point of an answer: the text the form sends or keeps; null when it is empty or not a point. */
export function parseLocationAnswer(value: string | null | undefined): LocationPoint | null {
  if (!value) return null;
  try {
    return toLocationPoint(JSON.parse(value));
  } catch {
    return null;
  }
}

/** A point read from the server (the sheet, the detail); null when the value is not one. */
export function toLocationPoint(value: unknown): LocationPoint | null {
  if (typeof value !== "object" || value === null) return null;
  const { latitude, longitude, accuracyMeters } = value as Record<string, unknown>;
  if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (accuracyMeters !== undefined && (typeof accuracyMeters !== "number" || !Number.isFinite(accuracyMeters))) return null;
  return accuracyMeters === undefined ? { latitude, longitude } : { latitude, longitude, accuracyMeters };
}

/**
 * The browser's position as the form keeps it: six decimals and the accuracy in whole meters. Null when the accuracy is beyond
 * what the server takes: that point says nothing, so it counts as a location that could not be obtained.
 */
export function locationFromPosition(coords: Pick<GeolocationCoordinates, "latitude" | "longitude" | "accuracy">): LocationPoint | null {
  const accuracyMeters = Math.round(coords.accuracy);
  if (!Number.isFinite(accuracyMeters) || accuracyMeters < 0 || accuracyMeters > maxAccuracyMeters) return null;
  return { latitude: round6(coords.latitude), longitude: round6(coords.longitude), accuracyMeters };
}

/** «-34.603722, -58.381592»: a point and six decimals, the same in every language. */
export function formatCoordinates(point: LocationPoint): string {
  return point.latitude.toFixed(6) + ", " + point.longitude.toFixed(6);
}

/** «± 15 m», «± 2.400 m» in Spanish and «± 2,400 m» in English. */
export function formatAccuracy(meters: number, language: string): string {
  return "± " + meters.toLocaleString(language === "en" ? "en-US" : "es-AR", { maximumFractionDigits: 0 }) + " m";
}

export function isLowAccuracy(point: LocationPoint): boolean {
  return point.accuracyMeters !== undefined && point.accuracyMeters > lowAccuracyMeters;
}

/** The fixed destination of «Ver en el mapa»: Google Maps with the point, without asking any service. */
export function mapUrl(point: LocationPoint): string {
  return "https://www.google.com/maps?q=" + point.latitude.toFixed(6) + "," + point.longitude.toFixed(6);
}

/** Whether this browser can give the point at all: it needs the API and a secure page. */
export function canRequestLocation(geolocation: Geolocation | undefined = globalThis.navigator?.geolocation,
  secure: boolean = globalThis.isSecureContext ?? true): boolean {
  return geolocation !== undefined && secure;
}

/**
 * Asks the browser once (UB3-A): high accuracy, never a saved position, and up to 20 seconds; past that it is the case of no
 * signal. The first time the browser asks for permission with its own prompt.
 */
export function requestLocation(geolocation: Geolocation | undefined = globalThis.navigator?.geolocation):
  Promise<{ point: LocationPoint } | { problem: LocationProblem }> {
  if (!geolocation) return Promise.resolve({ problem: "unsupported" });
  return new Promise(resolve => geolocation.getCurrentPosition(
    position => {
      const point = locationFromPosition(position.coords);
      resolve(point ? { point } : { problem: "unavailable" });
    },
    error => resolve({ problem: error.code === 1 ? "denied" : "unavailable" }),
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }));
}
