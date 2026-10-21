import type { TFunction } from "i18next";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import type { FormLifecycle } from "./api/response";

export function deprecationMessage(lifecycle: Pick<FormLifecycle, "deprecationState" | "deprecatedAtUtc" | "lastOpenSessionExpiresAtUtc">, t: TFunction<"forms">, culture: string, timeZoneId?: string): string | null {
 switch(lifecycle.deprecationState) {
  case "Pending": return lifecycle.lastOpenSessionExpiresAtUtc
   ? t("lifecycle.deprecation.pendingOpen", { date: formatDateTimeInZone(lifecycle.lastOpenSessionExpiresAtUtc, culture, timeZoneId) })
   : t("lifecycle.deprecation.pending");
  case "Uncertain": return t("lifecycle.deprecation.uncertain");
  case "Deprecated": return lifecycle.deprecatedAtUtc
   ? t("lifecycle.deprecation.deprecatedOn", { date: formatDateTimeInZone(lifecycle.deprecatedAtUtc, culture, timeZoneId) })
   : t("lifecycle.deprecation.deprecated");
  default: return null;
 }
}
