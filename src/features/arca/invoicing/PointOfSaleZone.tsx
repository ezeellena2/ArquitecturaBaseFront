import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { arcaQueryKey } from "../connection/api";
import { ArcaZone } from "../connection/ArcaZone";
import type { ArcaFamilyActiveProps, ArcaFamilySetupProps } from "../connection/families";
import { useArcaAction } from "../connection/useArcaAction";
import {
  arcaInvoicingSettingsQueryKey, arcaPointsOfSaleQueryKey, chooseArcaPointOfSale, fetchArcaInvoicingSettings, fetchArcaPointsOfSale, formatPointOfSale,
} from "./api";

/// Los puntos de venta que ARCA devuelve en este momento, para elegir uno. Sin ninguno, se crea en ARCA y se vuelve a buscar.
function PointOfSaleChoice({ enabled, canManage, value, onChange }: { enabled: boolean; canManage: boolean; value: number | null; onChange: (value: number) => void }) {
  const { t } = useTranslation("arca");
  const query = useQuery({ queryKey: arcaPointsOfSaleQueryKey, queryFn: ({ signal }) => fetchArcaPointsOfSale(signal), enabled: enabled && canManage, retry: false });
  const search = <Button variant="outline" pending={query.isFetching} disabled={query.isFetching} onClick={() => void query.refetch()}>
    {t(query.isFetching ? "invoicing.searching" : "invoicing.search")}</Button>;
  if (query.isPending) return <Skeleton className="h-16" />;
  if (query.isError) return <div className="flex flex-wrap items-center gap-2"><p className="text-sm">{t("invoicing.loadError")}</p>{search}</div>;
  if (query.data.length === 0) return <div className="flex flex-wrap items-center gap-2"><p className="text-sm">{t("invoicing.none")}</p>{search}</div>;
  return <RadioGroupField label={t("invoicing.pointOfSale")} value={value === null ? undefined : String(value)} onValueChange={next => onChange(Number(next))}
    options={query.data.map(point => ({
      value: String(point.number),
      label: point.blocked ? t("invoicing.blocked", { number: formatPointOfSale(point.number) })
        : t("invoicing.option", { number: formatPointOfSale(point.number), type: point.emissionType }),
      disabled: point.blocked || !canManage,
    }))} />;
}

/// La zona de Facturación en el alta: el punto de venta que completa la familia. «Activar la conexión» lo guarda.
export function PointOfSaleZone({ step, canManage, open, onReady }: ArcaFamilySetupProps) {
  const { t } = useTranslation("arca");
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    onReady(selected === null ? null : async () => { await chooseArcaPointOfSale(selected); });
  }, [selected, onReady]);
  return <ArcaZone step={step} title={t("invoicing.title")} state={open ? "open" : "off"} help={t("invoicing.help")}>
    <PointOfSaleChoice enabled={open} canManage={canManage} value={selected} onChange={setSelected} />
  </ArcaZone>;
}

/// El punto de venta con la conexión activa, con «Cambiar».
export function PointOfSaleSection({ canManage, onConflict }: ArcaFamilyActiveProps) {
  const { t } = useTranslation("arca");
  const queryClient = useQueryClient();
  const action = useArcaAction(onConflict);
  const settings = useQuery({ queryKey: arcaInvoicingSettingsQueryKey, queryFn: ({ signal }) => fetchArcaInvoicingSettings(signal), retry: false });
  const [changing, setChanging] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const current = settings.data?.pointOfSale ?? null;
  async function save() {
    if (selected === null) return;
    const result = await action.run("save", () => chooseArcaPointOfSale(selected));
    if (!result) return;
    setChanging(false);
    await queryClient.invalidateQueries({ queryKey: arcaQueryKey });
  }
  return <Surface title={t("invoicing.title")} help={t("invoicing.help")} padded actions={canManage ? changing ? <>
    <Button variant="outline" disabled={action.pending !== null} onClick={() => setChanging(false)}>{t("invoicing.cancel")}</Button>
    <Button pending={action.pending === "save"} disabled={action.pending !== null || selected === null || selected === current} onClick={() => void save()}>
      {t(action.pending === "save" ? "invoicing.saving" : "invoicing.save")}</Button>
  </> : <Button variant="outline" onClick={() => { setSelected(current); setChanging(true); }}>{t("invoicing.change")}</Button> : undefined}>
    {changing ? <PointOfSaleChoice enabled canManage={canManage} value={selected} onChange={setSelected} />
      : settings.isPending ? <Skeleton className="h-8" />
      : <DataList items={[{ key: "number", label: t("invoicing.number"), value: current === null ? t("invoicing.notChosen") : formatPointOfSale(current) }]} />}
  </Surface>;
}
