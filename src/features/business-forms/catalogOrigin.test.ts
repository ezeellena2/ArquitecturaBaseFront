import { describe, expect, it } from "vitest";
import { catalogFeedFailure, catalogFeedUpdate, catalogOriginKey } from "./catalogOrigin";

const now = Date.parse("2026-11-11T15:00:00Z");

describe("where the options of a catalog come from", () => {
  it("names each kind with its own text, External without naming its module", () => {
    expect(catalogOriginKey("Manual")).toBe("catalogs.source.manual");
    expect(catalogOriginKey("Filters")).toBe("catalogs.source.database");
    expect(catalogOriginKey("External")).toBe("catalogs.source.external");
  });
});

describe("an External catalog's last update", () => {
  it("says how long ago within a day, and the day before that", () => {
    expect(catalogFeedUpdate({ refreshedAtUtc: "2026-11-11T13:00:00Z", failedAtUtc: null, failureCode: null }, now)).toEqual({ at: "2026-11-11T13:00:00Z", recent: true });
    expect(catalogFeedUpdate({ refreshedAtUtc: "2026-11-10T15:00:00Z", failedAtUtc: null, failureCode: null }, now)).toEqual({ at: "2026-11-10T15:00:00Z", recent: false });
    expect(catalogFeedUpdate({ refreshedAtUtc: null, failedAtUtc: null, failureCode: null }, now)).toBeNull();
    expect(catalogFeedUpdate(undefined, now)).toBeNull();
  });
  it("reports a failure with the copy the forms keep and whether the source did not answer", () => {
    expect(catalogFeedFailure({ refreshedAtUtc: "2026-11-08T10:00:00Z", failedAtUtc: "2026-11-11T14:45:00Z", failureCode: "Arca.Connection.Unavailable" })).toEqual({ unavailable: true, copyAt: "2026-11-08T10:00:00Z" });
    expect(catalogFeedFailure({ refreshedAtUtc: "2026-11-08T10:00:00Z", failedAtUtc: "2026-11-11T14:45:00Z", failureCode: "Arca.Connection.NotConnected" })).toEqual({ unavailable: false, copyAt: "2026-11-08T10:00:00Z" });
    expect(catalogFeedFailure({ refreshedAtUtc: "2026-11-08T10:00:00Z", failedAtUtc: null, failureCode: null })).toBeNull();
    expect(catalogFeedFailure(undefined)).toBeNull();
  });
});
