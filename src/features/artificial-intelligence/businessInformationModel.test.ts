import { describe, expect, it } from "vitest";
import { businessDraftFrom, businessValidation, mergeBusinessReview } from "./businessInformationModel";
import type { BusinessInformation } from "./api/businessInformation";
import { emptyBusinessDetails } from "./businessDetailsModel";
const initial: BusinessInformation = { name: "Shop", description: "Repairs", hours: "9–18", location: "Local", services: "", policies: "", faq: "", revision: 1 };
describe("business information draft", () => {
  it("merges untouched structured groups while keeping location and link together", () => {
    const details = emptyBusinessDetails("UTC");
    const baseline = { ...initial, details };
    const draft = { ...businessDraftFrom(baseline), details: { ...details, location: { ...details.location, mode: "local" as const, address: "Mine" } } };
    const hours = { ...details.openingHours, days: details.openingHours.days.map(day => day.weekday === 0 ? { ...day, status: "closed" as const } : day) };
    const current = { ...baseline, details: { ...details, openingHours: hours }, revision: 2 };
    const merged = mergeBusinessReview(draft, baseline, current);
    expect(merged.details?.location.address).toBe("Mine"); expect(merged.details?.openingHours).toEqual(hours);
    expect(merged.hours).toBe(initial.hours); expect(merged.location).toBe(initial.location);
  });
  it("merges only locally edited fields after reviewing a newer revision", () => {
    const draft = { ...businessDraftFrom(initial), services: "Bikes" };
    const current = { ...initial, hours: "10–17", revision: 2 };
    expect(mergeBusinessReview(draft, initial, current)).toEqual({ ...businessDraftFrom(current), services: "Bikes" });
  });
  it("requires a name and at least one business fact without inventing content", () => {
    expect(businessValidation({ name: "", description: " ", hours: "", location: "", services: "", policies: "", faq: "" })).toEqual({ name: "nameRequired", description: "contentRequired" });
    expect(businessValidation({ name: "Shop", description: "", hours: "9–18", location: "", services: "", policies: "", faq: "" })).toEqual({});
  });
});
