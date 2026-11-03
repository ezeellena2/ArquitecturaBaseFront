import type { BusinessDetails, BusinessDraft, BusinessInformation, OpeningPeriod, OpeningStatus } from "./api/businessInformation";
import { detailsEqual, emptyBusinessDetails, hasBusinessFacts, mapLink, normalizeDetails, validPoint, validateBusinessDetails } from "./businessDetailsModel";
export const businessFields = ["name", "description", "hours", "location", "services", "policies", "faq"] as const;
export type BusinessField = typeof businessFields[number];
export const businessLimits: Record<BusinessField, number> = { name: 120, description: 1000, hours: 500, location: 500, services: 2000, policies: 2000, faq: 4000 };
export const businessDetailFields = ["details.location", "details.openingHours", "details.faq"] as const;
export const businessDraftFrom = (value: BusinessInformation): BusinessDraft => ({ ...Object.fromEntries(businessFields.map(field => [field, value[field]])), ...(value.details !== undefined ? { details: value.details ? normalizeDetails(value.details) : null } : {}) }) as BusinessDraft;
export function mergeBusinessReview(draft: BusinessDraft, baseline: BusinessInformation, current: BusinessInformation): BusinessDraft {
  const result = businessDraftFrom(current);
  for (const field of businessFields) result[field] = draft[field] !== baseline[field] ? draft[field] : current[field];
  const currentDetails = current.details ? normalizeDetails(current.details) : current.details;
  if (!draft.details || detailsEqual(draft.details, baseline.details ? normalizeDetails(baseline.details) : baseline.details)) return { ...result, ...(currentDetails !== undefined ? { details: currentDetails } : {}) };
  if (!currentDetails) return { ...result, details: normalizeDetails(draft.details) };
  const base = baseline.details ? normalizeDetails(baseline.details) : emptyBusinessDetails(draft.details.openingHours.timeZoneId);
  return { ...result, details: { location: detailsEqual(draft.details.location, base.location) ? currentDetails.location : draft.details.location,
    openingHours: detailsEqual(draft.details.openingHours, base.openingHours) ? currentDetails.openingHours : draft.details.openingHours,
    faq: detailsEqual(draft.details.faq, base.faq) ? currentDetails.faq : draft.details.faq } };
}
export function businessValidation(draft: BusinessDraft): Record<string, string> {
  const errors: Record<string, string> = draft.details ? validateBusinessDetails(draft.details) : {};
  if (!draft.name.trim()) errors.name = "nameRequired";
  if (businessFields.filter(field => field !== "name").every(field => !draft[field].trim()) && (!draft.details || !hasBusinessFacts(draft.details))) errors.description = "contentRequired";
  for (const field of businessFields) if (draft[field].length > businessLimits[field]) errors[field] = "tooLong";
  return errors;
}
export const normalizeBusinessDraft = (draft: BusinessDraft): BusinessDraft =>
  ({ ...Object.fromEntries(businessFields.map(field => [field, draft[field].trim()])), ...(draft.details !== undefined ? { details: draft.details ? normalizeDetails(draft.details) : null } : {}) }) as BusinessDraft;

// The review of a conflict reads side by side (board LR2-A, 2026-11-03): each changed fact once, the saved value and the
// draft's. A text field is one value; the location, the hours and the questions list only the parts that changed, by name.
// An empty value is "": the screen says it is missing.
export type BusinessReviewField = BusinessField | typeof businessDetailFields[number];
export interface BusinessReviewLine { readonly key: string; readonly label?: string; readonly before: string; readonly after: string }
export interface BusinessReviewGroup { readonly field: BusinessReviewField; readonly lines: readonly BusinessReviewLine[] }
const weekdays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export function businessReviewGroups(current: BusinessInformation, mine: BusinessInformation, { t, date }: { t: (key: string) => string; date: (value: string) => string }): BusinessReviewGroup[] {
  const timeZone = mine.details?.openingHours.timeZoneId ?? current.details?.openingHours.timeZoneId ?? "UTC";
  const sides = [current.details ?? emptyBusinessDetails(timeZone), mine.details ?? emptyBusinessDetails(timeZone)] as const;
  const opening = (status: OpeningStatus, periods: readonly OpeningPeriod[]) => `${t(status)} ${periods.map(period => `${period.start}–${period.end}${period.nextDay ? " (+1)" : ""}`).join(", ")}`.trim();
  const parts: Record<typeof businessDetailFields[number], (details: BusinessDetails) => { key: string; label: string; value: string }[]> = {
    "details.location": ({ location }) => [
      { key: "mode", label: t("locationType"), value: t(location.mode) }, { key: "address", label: t("address"), value: location.address },
      { key: "reference", label: t("reference"), value: location.reference }, { key: "area", label: t("serviceArea"), value: location.area },
      { key: "point", label: t("locationLink"), value: validPoint(location.latitude, location.longitude) ? mapLink({ latitude: location.latitude!, longitude: location.longitude! }) : "" }],
    "details.openingHours": ({ openingHours }) => [{ key: "timeZone", label: t("timeZoneLabel"), value: openingHours.timeZoneId },
      ...openingHours.days.map(day => ({ key: `day:${day.weekday}`, label: t(`days.${weekdays[day.weekday]}`), value: opening(day.status, day.periods) })),
      ...openingHours.exceptions.map(day => ({ key: `date:${day.date}`, label: date(day.date), value: opening(day.status, day.periods) }))],
    // A question renamed under the same identity reads as one that leaves and another that comes.
    "details.faq": ({ faq }) => faq.map(entry => ({ key: `faq:${entry.id}:${entry.question}`, label: entry.question, value: entry.answer || t("unanswered") })),
  };
  const groups: BusinessReviewGroup[] = businessFields.filter(field => current[field] !== mine[field]).map(field => ({ field, lines: [{ key: "value", before: current[field], after: mine[field] }] }));
  for (const field of businessDetailFields) {
    const [before, after] = sides.map(parts[field]);
    const keys = [...new Set([...before!, ...after!].map(part => part.key))];
    const lines = keys.flatMap(key => {
      const saved = before!.find(part => part.key === key), draft = after!.find(part => part.key === key);
      return saved?.value === draft?.value ? [] : [{ key, label: (draft ?? saved)!.label, before: saved?.value ?? "", after: draft?.value ?? "" }];
    });
    if (lines.length) groups.push({ field, lines });
  }
  return groups;
}
