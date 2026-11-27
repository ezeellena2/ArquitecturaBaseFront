import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { usePermissions } from "@/auth/usePermissions";
import { useSystemPresentation } from "@/shared/api/presentation";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { formatMonth } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { PageLoading } from "@/shared/ui/PageLoading";
import { Picker } from "@/shared/ui/Picker";
import { aiUsageKey, fetchAiUsage, fetchWhatsAppUsage, whatsAppUsageKey } from "../api/usage";
import { AiUsageZone } from "../components/AiUsageZone";
import { UsageSummary } from "../components/UsageSummary";
import { WhatsAppUsageZone } from "../components/WhatsAppUsageZone";
import { chosenMonth, currentMonth, recentMonths } from "../usageModel";
import { isForbidden } from "../zoneState";

/**
 * Administración › Configuración › Consumo (CO1-B, 2026-11-27): what the AI and WhatsApp spent in a month of the business, to work out
 * what each installation costs. The month goes in the address (`mes`, the current one by default) and the list offers the last
 * twelve. The zone of the AI asks for `ai.read` with its module, and the one of WhatsApp for `settings.manage` with its module (PR15):
 * with one, only that zone; with none, «No tenés permiso».
 */
export function UsagePage() {
  const { t, i18n } = useTranslation("usage");
  const { has } = usePermissions();
  const presentation = useSystemPresentation();
  const [params] = useSearchParams();
  const update = useQueryUpdate();
  const client = useQueryClient();
  const monthLabelId = useId();
  const features = presentation.data?.installedFeatures ?? [];
  const canReadAi = has("ai.read") && features.includes("assistant");
  const canReadWhatsApp = has("settings.manage") && features.includes("whatsapp");
  // The month of the business (PR16), in the time zone of the general settings, like the server counts it.
  const months = presentation.data ? recentMonths(currentMonth(new Date(), presentation.data.defaultTimeZoneId)) : [];
  const month = months.length ? chosenMonth(params.get("mes"), months) : "";
  const ai = useQuery({ queryKey: aiUsageKey(month), queryFn: ({ signal }) => fetchAiUsage(month, signal), enabled: canReadAi && month !== "" });
  const whatsapp = useQuery({ queryKey: whatsAppUsageKey(month), queryFn: ({ signal }) => fetchWhatsAppUsage(month, signal),
    enabled: canReadWhatsApp && month !== "", staleTime: 0, meta: { errorOwner: "local" } });
  const aiForbidden = isForbidden(ai.error);
  const whatsappForbidden = isForbidden(whatsapp.error);
  // SP1-B: a zone whose permission was taken away leaves, and the permissions are read again for the menu.
  useEffect(() => { if (aiForbidden || whatsappForbidden) void client.invalidateQueries({ queryKey: currentUserQueryKey }); }, [aiForbidden, whatsappForbidden, client]);

  if (presentation.isPending) return <PageLoading />;
  if (!presentation.data) return <Page title={t("title")}><EmptyState title={t("common:states.loadFailed")}
    action={<Button type="button" variant="outline" onClick={() => void presentation.refetch()}>{t("common:actions.retry")}</Button>} /></Page>;
  const aiShown = canReadAi && !aiForbidden;
  const whatsappShown = canReadWhatsApp && !whatsappForbidden;
  if (!aiShown && !whatsappShown) return <ForbiddenPage title={t("title")} />;

  const monthLabel = formatMonth(month, i18n.language) ?? month;
  return (
    <Page title={t("title")} actions={
      <span className="flex items-center gap-2">
        <span id={monthLabelId} className="text-sm text-[var(--color-content-muted)]">{t("month")}</span>
        <Picker className="w-32" label={t("month")} labelledBy={monthLabelId} value={month}
          options={months.map(option => ({ id: option, label: formatMonth(option, i18n.language) ?? option }))}
          // The current month is the default and does not go in the address.
          onChange={value => update({ mes: value === months[0] ? undefined : value })} />
      </span>
    }>
      <div className="flex flex-col gap-4">
        <UsageSummary monthLabel={monthLabel} ai={aiShown ? ai : undefined} whatsapp={whatsappShown ? whatsapp : undefined} />
        {aiShown ? <AiUsageZone query={ai} month={month} monthLabel={monthLabel} canManagePrices={has("ai.manage")} /> : null}
        {whatsappShown ? <WhatsAppUsageZone query={whatsapp} monthLabel={monthLabel} /> : null}
      </div>
    </Page>
  );
}
