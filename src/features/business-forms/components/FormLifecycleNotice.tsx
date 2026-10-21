import { useTranslation } from "react-i18next";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Banner } from "@/shared/ui/Banner";
import type { FormLifecycle } from "../api/response";
export function FormLifecycleNotice({ lifecycle, timeZoneId }: { lifecycle: FormLifecycle; timeZoneId?: string }) {
 const { t, i18n } = useTranslation("forms");
 if (!lifecycle.deactivatedAtUtc) return null;
 return <Banner tone="info"><span>{t("lifecycle.deactivatedBy", { author: lifecycle.deactivatedBy?.displayName ?? t("responses.unknownPerson"), date: formatDateTimeInZone(lifecycle.deactivatedAtUtc, i18n.language, timeZoneId) })}<span className="block">{t("lifecycle.notOffered")}</span><span className="block">{t("lifecycle.keepsWorkflow")}</span></span></Banner>;
}
