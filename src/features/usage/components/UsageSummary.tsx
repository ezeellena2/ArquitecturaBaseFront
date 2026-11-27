import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/utils";
import { StatCard } from "@/shared/ui/charts/StatCard";
import { Surface } from "@/shared/ui/Surface";
import type { AiUsage, WhatsAppUsage } from "../api/usage";
import { amountText } from "../usageFormat";
import { aiEstimatedCost, monthTotal } from "../usageModel";
import { zoneLoading } from "../zoneState";

const columns = ["", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3"];

/**
 * «Resumen de 11/2026» (CO1-B): a number per zone in sight and «Total del mes» only when both arrived and go in dollars. A zone
 * that loads keeps the place of its number; one that failed, or WhatsApp without a number, says «—».
 */
export function UsageSummary({ monthLabel, ai, whatsapp }: {
  monthLabel: string;
  /** Undefined when the zone is not in sight. */
  ai?: UseQueryResult<AiUsage>;
  whatsapp?: UseQueryResult<WhatsAppUsage>;
}) {
  const { t, i18n } = useTranslation("usage");
  const usd = (value: number) => t("usd", { amount: amountText(value, i18n.language) });
  const aiCost = ai?.data ? aiEstimatedCost(ai.data) : null;
  const whatsappData = whatsapp?.data;
  const total = monthTotal(ai?.data, whatsappData);
  const cells = [
    ...ai ? [<StatCard key="ai" flush label={t("summary.ai")} loading={zoneLoading(ai)} detail={t("summary.aiDetail")}
      value={ai.data ? aiCost === null ? t("ai.noPrice") : usd(aiCost) : "—"} />] : [],
    ...whatsapp ? [<StatCard key="whatsapp" flush label={t("summary.whatsapp")} loading={zoneLoading(whatsapp)}
      detail={t("summary.whatsappDetail")} value={whatsappData?.configured && whatsappData.currency
        ? t("money", { currency: whatsappData.currency, amount: amountText(whatsappData.totalCost, i18n.language) }) : "—"} />] : [],
    ...total === null ? [] : [<StatCard key="total" flush label={t("summary.total")} value={usd(total)} detail={t("summary.totalDetail")} />],
  ];

  return (
    <Surface title={t("summary.title", { month: monthLabel })}>
      <div className={cn("grid divide-y divide-[var(--color-border)] sm:divide-x sm:divide-y-0", columns[cells.length])}>{cells}</div>
    </Surface>
  );
}
