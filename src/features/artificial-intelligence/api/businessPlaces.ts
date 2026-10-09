import { api } from "@/shared/api/httpClient";
export interface BusinessPlace { placeId: string; label: string }
export const searchBusinessPlaces = (input: string, signal: AbortSignal) =>
  api.post<{ places: BusinessPlace[] }>("/api/ai/business-information/places/search", { input }, { signal });
