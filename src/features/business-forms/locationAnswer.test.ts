import { describe, expect, it, vi } from "vitest";
import {
  canRequestLocation, formatAccuracy, formatCoordinates, isLowAccuracy, locationAnswer, locationFromPosition, mapUrl, parseLocationAnswer,
  requestLocation, toLocationPoint,
} from "./locationAnswer";

const point = { latitude: -34.603722, longitude: -58.381592, accuracyMeters: 15 };

describe("locationAnswer", () => {
  it("sends the point as the text the server reads and reads it back", () => {
    expect(locationAnswer(point)).toBe('{"latitude":-34.603722,"longitude":-58.381592,"accuracyMeters":15}');
    expect(locationAnswer({ latitude: 1, longitude: 2 })).toBe('{"latitude":1,"longitude":2}');
    expect(locationAnswer(null)).toBe("");
    expect(parseLocationAnswer(locationAnswer(point))).toEqual(point);
    expect(parseLocationAnswer('{"latitude":1,"longitude":2}')).toEqual({ latitude: 1, longitude: 2 });
  });

  it("does not take what is not a point", () => {
    for (const value of ["", "{", "null", "[1,2]", '{"latitude":"1","longitude":2}', '{"latitude":1}', '{"latitude":1,"longitude":2,"accuracyMeters":"5"}'])
      expect(parseLocationAnswer(value)).toBeNull();
    expect(toLocationPoint({ latitude: 1, longitude: Number.NaN })).toBeNull();
    expect(toLocationPoint(point)).toEqual(point);
  });

  it("keeps six decimals and whole meters from the browser, and a farther accuracy than the server takes is no point", () => {
    expect(locationFromPosition({ latitude: -34.60372249, longitude: -58.38159151, accuracy: 14.5 }))
      .toEqual({ latitude: -34.603722, longitude: -58.381592, accuracyMeters: 15 });
    expect(locationFromPosition({ latitude: 0, longitude: 0, accuracy: 100_000 })?.accuracyMeters).toBe(100_000);
    expect(locationFromPosition({ latitude: 0, longitude: 0, accuracy: 100_001 })).toBeNull();
  });

  it("writes the point the same in every language and the accuracy in the language of the screen", () => {
    expect(formatCoordinates(point)).toBe("-34.603722, -58.381592");
    expect(formatCoordinates({ latitude: 90, longitude: -180 })).toBe("90.000000, -180.000000");
    expect(formatAccuracy(15, "es")).toBe("± 15 m");
    expect(formatAccuracy(2400, "es")).toBe("± 2.400 m");
    expect(formatAccuracy(2400, "en")).toBe("± 2,400 m");
    expect(mapUrl(point)).toBe("https://www.google.com/maps?q=-34.603722,-58.381592");
  });

  it("calls an accuracy above 100 m low", () => {
    expect(isLowAccuracy(point)).toBe(false);
    expect(isLowAccuracy({ ...point, accuracyMeters: 100 })).toBe(false);
    expect(isLowAccuracy({ ...point, accuracyMeters: 101 })).toBe(true);
    expect(isLowAccuracy({ latitude: 1, longitude: 2 })).toBe(false);
  });
});

describe("requestLocation", () => {
  const geolocation = (outcome: (success: PositionCallback, failure: PositionErrorCallback) => void) =>
    ({ getCurrentPosition: vi.fn((success: PositionCallback, failure: PositionErrorCallback) => outcome(success, failure)) }) as unknown as Geolocation;

  it("asks once with high accuracy, without a saved position and up to 20 seconds", async () => {
    const browser = geolocation(success => success({ coords: { latitude: -34.6037224, longitude: -58.3815916, accuracy: 15.2 } } as GeolocationPosition));

    await expect(requestLocation(browser)).resolves.toEqual({ point });
    expect(browser.getCurrentPosition).toHaveBeenCalledTimes(1);
    expect(vi.mocked(browser.getCurrentPosition).mock.calls[0]![2]).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
  });

  it("says why it did not get the point", async () => {
    await expect(requestLocation(geolocation((_, failure) => failure({ code: 1 } as GeolocationPositionError)))).resolves.toEqual({ problem: "denied" });
    await expect(requestLocation(geolocation((_, failure) => failure({ code: 2 } as GeolocationPositionError)))).resolves.toEqual({ problem: "unavailable" });
    await expect(requestLocation(geolocation((_, failure) => failure({ code: 3 } as GeolocationPositionError)))).resolves.toEqual({ problem: "unavailable" });
    await expect(requestLocation(geolocation(success => success({ coords: { latitude: 0, longitude: 0, accuracy: 150_000 } } as GeolocationPosition))))
      .resolves.toEqual({ problem: "unavailable" });
    await expect(requestLocation(undefined)).resolves.toEqual({ problem: "unsupported" });
  });

  it("knows a browser without the function or an insecure page cannot give it", () => {
    expect(canRequestLocation(undefined, true)).toBe(false);
    expect(canRequestLocation({} as Geolocation, false)).toBe(false);
    expect(canRequestLocation({} as Geolocation, true)).toBe(true);
  });
});
