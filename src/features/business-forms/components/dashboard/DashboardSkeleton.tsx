import { useTranslation } from "react-i18next";
import { StatCard } from "@/shared/ui/charts/StatCard";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { dashboardCardGrid, dashboardStatGrid } from "./dashboardLayout";

/** While the dashboard arrives (ES1–ES3), its place: four numbers, a period card across the row and two more cards. */
export function DashboardSkeleton() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("states.loading")} className="@container flex flex-col gap-4">
      <div className={dashboardStatGrid}>{[0, 1, 2, 3].map(index => <StatCard key={index} label="" loading />)}</div>
      <div className={dashboardCardGrid}>{[0, 1, 2].map(index => <div key={index} className={index === 0 ? "col-span-full" : undefined}>
        <Surface padded>
          <Skeleton aria-hidden="true" className="h-4 w-2/5" />
          <Skeleton aria-hidden="true" className={index === 0 ? "h-44" : "h-32"} />
        </Surface>
      </div>)}</div>
    </div>
  );
}
