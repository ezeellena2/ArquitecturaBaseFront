import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { formatDateInZone, formatTimeInZone } from "@/shared/lib/dateTime";

/// Fechas y horas en la zona horaria de la persona, como el resto del front.
export function useArcaFormat() {
  const { i18n } = useTranslation();
  const { data: user } = useCurrentUser();
  return {
    date: (valueUtc: string) => formatDateInZone(valueUtc, i18n.language, user?.timeZoneId),
    time: (valueUtc: string) => formatTimeInZone(valueUtc, i18n.language, user?.timeZoneId),
  };
}
