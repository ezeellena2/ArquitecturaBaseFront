import { api } from "@/shared/api/httpClient";
export interface BusinessLocation { mode: "unknown" | "local" | "area" | "both"; address: string; reference: string; area: string; latitude: number | null; longitude: number | null; placeId?: string | null; link?: string | null }
export interface OpeningPeriod { start: string; end: string; nextDay: boolean }
export type OpeningStatus = "unknown" | "open" | "closed" | "allDay";
export interface OpeningDay { weekday: number; status: OpeningStatus; periods: OpeningPeriod[] }
export interface SpecialDate { date: string; status: OpeningStatus; periods: OpeningPeriod[] }
export interface BusinessFaq { id: string; question: string; answer: string }
export interface BusinessDetails { location: BusinessLocation; openingHours: { timeZoneId: string; days: OpeningDay[]; exceptions: SpecialDate[] }; faq: BusinessFaq[] }
export interface BusinessInformation { name: string; description: string; hours: string; location: string; services: string; policies: string; faq: string; revision: number; details?: BusinessDetails | null }
export type BusinessDraft = Omit<BusinessInformation, "revision">;
export type BusinessSaveRequest = BusinessDraft & { expectedRevision: number; requestId: string };
export interface BusinessChange { requestId: string; revision: number }
export const businessInformationQueryKey = ["ai-business-information"] as const;
export const fetchBusinessInformation = (signal?: AbortSignal) => api.get<BusinessInformation>("/api/ai/business-information", { signal });
export const saveBusinessInformation = (request: BusinessSaveRequest, signal: AbortSignal) => api.put<BusinessChange>("/api/ai/business-information", request, { signal });
export const fetchBusinessChange = (id: string, signal: AbortSignal) => api.get<BusinessChange>(`/api/ai/business-information/changes/${encodeURIComponent(id)}`, { signal });
