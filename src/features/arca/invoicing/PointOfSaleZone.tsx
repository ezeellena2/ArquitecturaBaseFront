import { ApiError } from "@/shared/api/ApiError";
import { useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { FormField } from "@/shared/ui/FormField";
import { Picker } from "@/shared/ui/Picker";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { arcaQueryKey } from "../connection/api";
import { ArcaZone } from "../connection/ArcaZone";
import type { ArcaFamilyActiveProps, ArcaFamilySetupProps } from "../connection/families";
import { robotPointOfSaleStep, useArcaRobotRun } from "../connection/robot";
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
  // H30: why ARCA did not give them (the detail of an «Arca.*» code); anything else, the general text.
  if (query.isError) return <div className="flex flex-wrap items-center gap-2"><p className="text-sm">{query.error instanceof ApiError
    && query.error.code?.startsWith("Arca.") && query.error.detail ? query.error.detail : t("invoicing.loadError")}</p>{search}</div>;
  if (query.data.length === 0) return <div className="flex flex-wrap items-center gap-2"><p className="text-sm">{t("invoicing.none")}</p>{search}</div>;
  // The points of sale go in the shared piece for choosing (DS1-A, 2026-11-22); a blocked one is off, with its reason after it.
  return <div className="w-full sm:w-80"><FormField label={t("invoicing.pointOfSale")}>
    <Picker label={t("invoicing.pointOfSale")} disabled={!canManage} value={value === null ? null : String(value)} placeholder={t("invoicing.choose")}
      onChange={next => { if (Number(next) !== value) onChange(Number(next)); }}
      options={query.data.map(point => ({
        id: String(point.number),
        label: point.blocked ? formatPointOfSale(point.number) : t("invoicing.option", { number: formatPointOfSale(point.number), type: point.emissionType }),
        disabledReason: point.blocked ? t("invoicing.blockedReason") : null,
      }))} />
  </FormField></div>;
}

/// La configuración de Facturación no se pudo leer: sin lo guardado a la vista no se ofrece cargar ni cambiar, sólo volver a
/// leer.
export function InvoicingSettingsError({ settings }: { settings: UseQueryResult<unknown> }) {
  const { t } = useTranslation(["arca", "common"]);
  return <div className="flex flex-wrap items-center gap-2"><p className="text-sm">{t("invoicing.settingsLoadError")}</p>
    <Button variant="outline" pending={settings.isFetching} disabled={settings.isFetching} onClick={() => void settings.refetch()}>{t("common:actions.retry")}</Button>
  </div>;
}

/// La zona de Facturación en el alta: el punto de venta que completa la familia. «Activar la conexión» lo guarda con la
/// revisión de la configuración que se leyó.
export function PointOfSaleZone({ step, connection, canManage, open, onReady }: ArcaFamilySetupProps) {
  const { t } = useTranslation("arca");
  // En la delegación automática, el punto de venta que dio de alta el robot llega elegido (RB2-A); se puede cambiar.
  const robot = useArcaRobotRun(connection.mode === "PlatformDelegationAutomated");
  const settings = useQuery({ queryKey: arcaInvoicingSettingsQueryKey, queryFn: ({ signal }) => fetchArcaInvoicingSettings(signal), enabled: open, retry: false });
  const suggested = Number(robot.data?.company?.outputs[robotPointOfSaleStep]) || null;
  const [selected, setSelected] = useState<number | null>(null);
  const value = selected ?? suggested;
  const revision = settings.data?.revision;
  useEffect(() => {
    onReady(value === null || revision === undefined ? null : async () => { await chooseArcaPointOfSale(value, revision); });
  }, [value, revision, onReady]);
  return <ArcaZone step={step} title={t("invoicing.title")} state={open ? "open" : "off"} help={t("invoicing.help")}>
    {settings.isError ? <InvoicingSettingsError settings={settings} />
      : <PointOfSaleChoice enabled={open} canManage={canManage} value={value} onChange={setSelected} />}
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
    if (selected === null || !settings.data) return;
    const revision = settings.data.revision;
    const result = await action.run("save", () => chooseArcaPointOfSale(selected, revision));
    if (!result) return;
    setChanging(false);
    await queryClient.invalidateQueries({ queryKey: arcaQueryKey });
  }
  // Sin lo guardado a la vista (leyendo o con error), no se ofrece cambiar.
  return <Surface title={t("invoicing.title")} help={t("invoicing.help")} padded actions={canManage && settings.data ? changing ? <>
    <Button variant="outline" disabled={action.pending !== null} onClick={() => setChanging(false)}>{t("invoicing.cancel")}</Button>
    <Button pending={action.pending === "save"} disabled={action.pending !== null || selected === null || selected === current} onClick={() => void save()}>
      {t(action.pending === "save" ? "invoicing.saving" : "invoicing.save")}</Button>
  </> : <Button variant="outline" onClick={() => { setSelected(current); setChanging(true); }}>{t("invoicing.change")}</Button> : undefined}>
    {changing ? <PointOfSaleChoice enabled canManage={canManage} value={selected} onChange={setSelected} />
      : settings.isError && !settings.data ? <InvoicingSettingsError settings={settings} />
      : settings.isPending ? <Skeleton className="h-8" />
      : <DataList items={[{ key: "number", label: t("invoicing.number"), value: current === null ? t("invoicing.notChosen") : formatPointOfSale(current) }]} />}
  </Surface>;
}
