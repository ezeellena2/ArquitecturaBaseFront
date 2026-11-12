import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { ActionsMenu, type ActionsMenuEntry } from "@/shared/ui/ActionsMenu";
import { BarChart } from "@/shared/ui/charts/BarChart";
import { BarList } from "@/shared/ui/charts/BarList";
import { CloseIcon, EyeIcon } from "@/shared/ui/icons";
import { Surface } from "@/shared/ui/Surface";
import type { DashboardView } from "../../dashboard";

/**
 * A card of the dashboard (DOC7-A): its chart in a zone whose band names what it counts, and its ⋮ with «Contar» (the
 * responses or the total of one number by currency), «Ver como tabla» and «Quitar del tablero». What it shows comes written.
 */
export function DashboardCard({ title, view, table, measures, measure, onMeasure, onView, onRemove, menuRef, onMenuCloseAutoFocus }: {
  title: string;
  view: DashboardView;
  table: boolean;
  measures: readonly { value: string; label: string }[];
  measure: string;
  onMeasure: (value: string) => void;
  onView: (table: boolean) => void;
  onRemove: () => void;
  menuRef?: Ref<HTMLButtonElement>;
  onMenuCloseAutoFocus?: (event: Event) => void;
}) {
  const { t } = useTranslation("forms");
  const items: ActionsMenuEntry[] = [
    ...measures.length ? [{ choice: true, label: t("dashboard.menu.count"), value: measure, options: measures, onValueChange: onMeasure } as const, { separator: true } as const] : [],
    { label: t(table ? "dashboard.menu.chart" : "dashboard.menu.table"), icon: EyeIcon, onSelect: () => onView(!table) },
    { label: t("dashboard.menu.remove"), icon: CloseIcon, onSelect: onRemove },
  ];
  const empty = t("dashboard.noAnswers");
  return (
    <Surface title={title} actions={<ActionsMenu label={t("dashboard.menu.label", { title })} items={items} triggerRef={menuRef} onCloseAutoFocus={onMenuCloseAutoFocus} />}>
      {view.kind === "bars"
        ? <BarChart label={title} buckets={view.buckets} asTable={table} periodHeader={view.periodHeader} valueHeader={view.valueHeader} empty={empty} note={view.note} />
        : <BarList label={title} items={view.items} asTable={table} labelHeader={view.labelHeader} valueHeader={view.valueHeader} shareHeader={view.shareHeader} empty={empty} note={view.note} />}
    </Surface>
  );
}
