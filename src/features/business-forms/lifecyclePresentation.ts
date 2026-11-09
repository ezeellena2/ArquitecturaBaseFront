import type { TFunction } from "i18next";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import type { FormLifecycle } from "./api/response";

export function deprecationMessage(lifecycle: Pick<FormLifecycle, "deprecationState" | "deprecatedAtUtc" | "lastOpenSessionExpiresAtUtc">, t: TFunction<"forms">, culture: string, timeZoneId?: string): string | null {
 switch(lifecycle.deprecationState) {
  case "Pending": return lifecycle.lastOpenSessionExpiresAtUtc
   ? t("lifecycle.deprecation.pendingOpen", { date: formatDateTimeInZone(lifecycle.lastOpenSessionExpiresAtUtc, culture, timeZoneId) })
   : t("lifecycle.deprecation.pending");
  case "Uncertain": return t("lifecycle.deprecation.uncertain");
  case "NeedsAttention": return t("lifecycle.deprecation.needsAttention");
  case "Deprecated": return lifecycle.deprecatedAtUtc
   ? t("lifecycle.deprecation.deprecatedOn", { date: formatDateTimeInZone(lifecycle.deprecatedAtUtc, culture, timeZoneId) })
   : t("lifecycle.deprecation.deprecated");
  default: return null;
 }
}

type DeprecationFacts = Pick<FormLifecycle, "deprecationState" | "deprecatedAtUtc" | "lastOpenSessionExpiresAtUtc" | "unavailableReason">;

/// The deactivated list says how the withdrawal goes in WhatsApp in one column and its date in another (UD2, 2026-11-09).
export function deprecationStateKey(lifecycle: Pick<DeprecationFacts, "deprecationState" | "unavailableReason">): string | null {
 if (lifecycle.unavailableReason === "PublicationInProgress") return "lifecycle.deprecationStates.Reactivating";
 return lifecycle.deprecationState ? "lifecycle.deprecationStates." + lifecycle.deprecationState : null;
}

/// When it was deprecated or, while it waits for the open sends, when the last one expires; nothing while it reactivates.
export function deprecationDateUtc(lifecycle: DeprecationFacts): string | null {
 if (lifecycle.unavailableReason === "PublicationInProgress") return null;
 return lifecycle.deprecationState === "Deprecated" ? lifecycle.deprecatedAtUtc
  : lifecycle.deprecationState === "Pending" ? lifecycle.lastOpenSessionExpiresAtUtc : null;
}
