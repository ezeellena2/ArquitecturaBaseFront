import type { BusinessDraft, BusinessInformation } from "./api/businessInformation";
import { detailsEqual, emptyBusinessDetails, hasBusinessFacts, normalizeDetails, validateBusinessDetails } from "./businessDetailsModel";
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
