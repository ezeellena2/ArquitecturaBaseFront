import { useTranslation } from "react-i18next";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Banner } from "@/shared/ui/Banner";
import { deprecationMessage } from "../lifecyclePresentation";
import type { FormLifecycle } from "../api/response";
export function FormLifecycleNotice({ lifecycle, timeZoneId }: { lifecycle: FormLifecycle; timeZoneId?: string }) {
 const { t, i18n } = useTranslation("forms");
 if (!lifecycle.deactivatedAtUtc) return null;
 const channel = deprecationMessage(lifecycle, t, i18n.language, timeZoneId);
 const warning = lifecycle.deprecationState === "Uncertain" || lifecycle.deprecationState === "NeedsAttention";
 return <><Banner tone="info"><span>{t("lifecycle.deactivatedBy", { author: lifecycle.deactivatedBy?.displayName ?? t("responses.unknownPerson"), date: formatDateTimeInZone(lifecycle.deactivatedAtUtc, i18n.language, timeZoneId) })}<span className="block">{t("lifecycle.notOffered")}</span><span className="block">{t("lifecycle.keepsWorkflow")}</span>{channel && !warning ? <span className="mt-1 block text-xs text-[var(--color-content-muted)]">{channel}</span> : null}</span></Banner>{channel && warning ? <Banner tone="warning">{channel}</Banner> : null}</>;
}
