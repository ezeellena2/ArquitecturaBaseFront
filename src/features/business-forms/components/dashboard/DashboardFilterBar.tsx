import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useMediaQuery } from "@/shared/hooks/useMediaQuery";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { Picker } from "@/shared/ui/Picker";
import type { ResponseSheet } from "../../api/responses";
import { dashboardPeriod, dashboardPeriods } from "../../dashboardPeriod";
import { useResponseScope } from "../../hooks/useResponseQueries";
import type { useResponseRouteQuery } from "../../hooks/useResponseRouteQuery";
import { ResponseFilterBar } from "../ResponseFilterBar";
import { DashboardAddMenu } from "./DashboardAddMenu";

/**
 * The bar of «Tablero» (DOC7-A): the sheet's filters, the period of the whole dashboard, as the address asks it, and
 * «Agregar gráfico» (`add`). It stays out of the dashboard's chunk, and out of its contract and its model: the page draws
 * it, with the skeleton, while the charts arrive, so nothing jumps when they do. Without `add`, «Agregar gráfico» keeps its place, off: there is nothing to add yet.
 * On the phone the filters go behind «Filtros».
 */
export function DashboardFilterBar({ formId, route, sheet, add }: {
  formId: string;
  route: ReturnType<typeof useResponseRouteQuery>;
  sheet: ResponseSheet | undefined;
  add?: ReactNode;
}) {
  const { t } = useTranslation("forms");
  const scope = useResponseScope();
  const update = useQueryUpdate();
  const phone = useMediaQuery("(width < 640px)");
  const period = dashboardPeriod(route.params.get("period"));
  const trailing = <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
    {/* The period is the only piece to choose with the button of the bar (DS1-A, also the filters since 2026-11-22). */}
    <Picker trigger="button" label={t("dashboard.period")} options={dashboardPeriods.map(value => ({ id: value, label: t(`dashboard.periods.${value}`) }))}
      value={period} onChange={value => { if (value !== period) update({ period: value === "day" ? undefined : value }); }} />
    {add ?? <DashboardAddMenu />}
  </div>;
  return <ResponseFilterBar formId={formId} route={route} columns={sheet?.columns ?? []} loaded={!!sheet} versions={sheet?.versions}
    hasApproval={!!sheet?.hasApproval} zone={scope.user?.timeZoneId ?? "UTC"} quick={phone} trailing={trailing} />;
}
