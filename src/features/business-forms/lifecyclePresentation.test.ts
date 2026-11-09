import { describe, expect, it } from "vitest";
import { deprecationDateUtc, deprecationStateKey } from "./lifecyclePresentation";

const facts = { deprecationState: null, deprecatedAtUtc: null, lastOpenSessionExpiresAtUtc: null, unavailableReason: null } as const;

describe("how the withdrawal goes in WhatsApp, in two columns (UD2)", () => {
  it("names the state and leaves the date apart", () => {
    expect(deprecationStateKey({ ...facts, deprecationState: "Deprecated" })).toBe("lifecycle.deprecationStates.Deprecated");
    expect(deprecationDateUtc({ ...facts, deprecationState: "Deprecated", deprecatedAtUtc: "2026-10-21T18:00:00Z" })).toBe("2026-10-21T18:00:00Z");
  });

  it("dates a pending withdrawal by the last open send, and the other states without a date", () => {
    expect(deprecationStateKey({ ...facts, deprecationState: "Pending" })).toBe("lifecycle.deprecationStates.Pending");
    expect(deprecationDateUtc({ ...facts, deprecationState: "Pending", lastOpenSessionExpiresAtUtc: "2026-10-22T18:00:00Z" })).toBe("2026-10-22T18:00:00Z");
    for (const state of ["Uncertain", "NeedsAttention"] as const) {
      expect(deprecationStateKey({ ...facts, deprecationState: state })).toBe("lifecycle.deprecationStates." + state);
      expect(deprecationDateUtc({ ...facts, deprecationState: state, lastOpenSessionExpiresAtUtc: "2026-10-22T18:00:00Z" })).toBeNull();
    }
  });

  it("says Reactivating, without a date, while a new version publishes", () => {
    const reactivating = { ...facts, deprecationState: "Deprecated", deprecatedAtUtc: "2026-10-21T18:00:00Z", unavailableReason: "PublicationInProgress" } as const;
    expect(deprecationStateKey(reactivating)).toBe("lifecycle.deprecationStates.Reactivating");
    expect(deprecationDateUtc(reactivating)).toBeNull();
  });

  it("says nothing for a form that never reached WhatsApp", () => {
    expect(deprecationStateKey(facts)).toBeNull();
    expect(deprecationDateUtc(facts)).toBeNull();
  });
});
