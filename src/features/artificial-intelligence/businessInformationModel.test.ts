import { describe, expect, it } from "vitest";
import { businessDraftFrom, businessReviewGroups, businessValidation, mergeBusinessReview } from "./businessInformationModel";
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

// A conflict reads side by side (LR2-A, 2026-11-03): each changed fact once, with both versions; the keys stand for their texts.
describe("business information review", () => {
  const text = { t: (key: string) => key, date: (value: string) => `[${value}]` };
  const details = emptyBusinessDetails("America/Argentina/Buenos_Aires");
  const hours = (days: Record<number, { status: "open" | "closed"; periods?: { start: string; end: string }[] }>, exceptions: { date: string; status: "closed" }[] = []) => ({ ...details.openingHours, exceptions: exceptions.map(item => ({ ...item, periods: [] })),
    days: details.openingHours.days.map(day => days[day.weekday] ? { weekday: day.weekday, status: days[day.weekday]!.status, periods: (days[day.weekday]!.periods ?? []).map(period => ({ ...period, nextDay: false })) } : day) });
  it("lists only the days, dates and answers that changed, each named once, and a text field as one value", () => {
    const current: BusinessInformation = { ...initial, services: "Semillas.", details: { ...details,
      openingHours: hours({ 0: { status: "open", periods: [{ start: "09:00", end: "18:00" }] }, 1: { status: "open", periods: [{ start: "09:00", end: "18:00" }] }, 5: { status: "open", periods: [{ start: "09:00", end: "13:00" }] } }, [{ date: "2026-12-24", status: "closed" }]),
      faq: [{ id: "delivery", question: "¿Hacen envíos o entregas?", answer: "Sí, a todo el país." }, { id: "payment", question: "¿Qué medios de pago aceptan?", answer: "" }] } };
    const mine: BusinessInformation = { ...initial, services: "Semillas. Asesoramiento.", details: { ...details,
      openingHours: hours({ 0: { status: "open", periods: [{ start: "08:00", end: "17:00" }] }, 1: { status: "open", periods: [{ start: "09:00", end: "18:00" }] }, 5: { status: "closed" } }),
      faq: [{ id: "delivery", question: "¿Hacen envíos o entregas?", answer: "Sí, a todo el país, en 72 horas." }, { id: "payment", question: "¿Qué medios de pago aceptan?", answer: "Efectivo, débito y crédito." }] } };
    expect(businessReviewGroups(current, mine, text)).toEqual([
      { field: "services", lines: [{ key: "value", before: "Semillas.", after: "Semillas. Asesoramiento." }] },
      { field: "details.openingHours", lines: [
        { key: "day:0", label: "days.monday", before: "open 09:00–18:00", after: "open 08:00–17:00" },
        { key: "day:5", label: "days.saturday", before: "open 09:00–13:00", after: "closed" },
        { key: "date:2026-12-24", label: "[2026-12-24]", before: "closed", after: "" },
      ] },
      { field: "details.faq", lines: [
        { key: "faq:delivery:¿Hacen envíos o entregas?", label: "¿Hacen envíos o entregas?", before: "Sí, a todo el país.", after: "Sí, a todo el país, en 72 horas." },
        { key: "faq:payment:¿Qué medios de pago aceptan?", label: "¿Qué medios de pago aceptan?", before: "unanswered", after: "Efectivo, débito y crédito." },
      ] },
    ]);
  });
  it("names each part of the location that changed, and compares a version without details with an empty one", () => {
    const local = { ...details.location, mode: "local" as const, address: "Av. San Martín 1234", reference: "Portón verde" };
    expect(businessReviewGroups({ ...initial, details: { ...details, location: local } }, { ...initial, details: { ...details, location: { ...local, address: "Av. San Martín 1250" } } }, text)).toEqual([
      { field: "details.location", lines: [{ key: "address", label: "address", before: "Av. San Martín 1234", after: "Av. San Martín 1250" }] },
    ]);
    expect(businessReviewGroups({ ...initial, details: null }, { ...initial, details: { ...details, openingHours: hours({ 0: { status: "closed" } }) } }, text)).toEqual([
      { field: "details.openingHours", lines: [{ key: "day:0", label: "days.monday", before: "unknown", after: "closed" }] },
    ]);
  });
});
