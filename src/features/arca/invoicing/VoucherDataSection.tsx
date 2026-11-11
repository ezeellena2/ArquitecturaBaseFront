import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { formatDateOnly } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import type { ArcaFamilyActiveProps } from "../connection/families";
import { useArcaAction } from "../connection/useArcaAction";
import { arcaInvoicingSettingsQueryKey, fetchArcaInvoicingSettings, setArcaVoucherData, type ArcaInvoicingSettings } from "./api";
import { InvoicingSettingsError, PointOfSaleSection } from "./PointOfSaleZone";

const grossIncomeMaxLength = 30;

interface Draft { grossIncomeNumber: string; activityStartOn: string }
interface DraftErrors { grossIncomeNumber?: string; activityStartOn?: string }

/// Ingresos brutos e inicio de actividades (AC4): van en el PDF de cada factura y el padrón no los trae. Se guardan sin
/// llamar a ARCA y no cambian el estado de la conexión, con la revisión que se leyó. «Cargar» o «Cambiar» abre los dos
/// campos con lo guardado, y sólo se ofrece con lo guardado a la vista.
export function VoucherDataSection({ canManage, onConflict }: ArcaFamilyActiveProps) {
  const { t, i18n } = useTranslation("arca");
  const queryClient = useQueryClient();
  const action = useArcaAction(onConflict);
  const settings = useQuery({ queryKey: arcaInvoicingSettingsQueryKey, queryFn: ({ signal }) => fetchArcaInvoicingSettings(signal), retry: false });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const saved = settings.data;
  const grossIncome = saved?.grossIncomeNumber ?? null;
  const activityStart = saved?.activityStartOn ?? null;
  const changed = draft !== null && (draft.grossIncomeNumber.trim() !== (grossIncome ?? "") || draft.activityStartOn !== (activityStart ?? ""));

  function edit() {
    setDraft({ grossIncomeNumber: grossIncome ?? "", activityStartOn: activityStart ?? "" });
    setErrors({});
  }

  function update(next: Partial<Draft>) {
    setDraft(current => current === null ? current : { ...current, ...next });
    setErrors(current => ({ ...current, ...Object.fromEntries(Object.keys(next).map(key => [key, undefined])) }));
  }

  async function save() {
    if (draft === null || !saved) return;
    const value = { grossIncomeNumber: draft.grossIncomeNumber.trim(), activityStartOn: draft.activityStartOn, expectedRevision: saved.revision };
    const invalid: DraftErrors = {
      grossIncomeNumber: value.grossIncomeNumber.length === 0 || value.grossIncomeNumber.length > grossIncomeMaxLength ? t("voucher.grossIncomeInvalid") : undefined,
      activityStartOn: formatDateOnly(value.activityStartOn, i18n.language) === null ? t("voucher.activityStartInvalid") : undefined,
    };
    if (invalid.grossIncomeNumber || invalid.activityStartOn) {
      setErrors(invalid);
      document.getElementById(invalid.grossIncomeNumber ? "arca-gross-income" : "arca-activity-start")?.focus();
      return;
    }
    // Lo que rechaza el servidor va debajo de su campo, con su texto.
    const result = await action.run("voucher", () => setArcaVoucherData(value), error => {
      const fields: DraftErrors = error instanceof ApiError
        ? { grossIncomeNumber: error.errors?.grossIncomeNumber?.[0], activityStartOn: error.errors?.activityStartOn?.[0] } : {};
      if (!fields.grossIncomeNumber && !fields.activityStartOn) return false;
      setErrors(fields);
      document.getElementById(fields.grossIncomeNumber ? "arca-gross-income" : "arca-activity-start")?.focus();
      return true;
    });
    if (!result) return;
    queryClient.setQueryData<ArcaInvoicingSettings>(arcaInvoicingSettingsQueryKey, result);
    setDraft(null);
  }

  const empty = t("voucher.notLoaded");
  const actions = !canManage || !saved ? undefined : draft !== null ? <>
    <Button variant="outline" disabled={action.pending !== null} onClick={() => setDraft(null)}>{t("invoicing.cancel")}</Button>
    <Button pending={action.pending === "voucher"} disabled={action.pending !== null || !changed} onClick={() => void save()}>
      {t(action.pending === "voucher" ? "invoicing.saving" : "invoicing.save")}</Button>
  </> : <Button variant="outline" onClick={edit}>{t(grossIncome === null && activityStart === null ? "voucher.load" : "invoicing.change")}</Button>;

  return <Surface title={t("voucher.title")} help={t("voucher.help")} padded actions={actions}>
    {draft !== null ? <div className="flex flex-col gap-4 sm:max-w-[22rem]">
      <FormField label={t("voucher.grossIncome")} htmlFor="arca-gross-income" error={errors.grossIncomeNumber}>
        <Input id="arca-gross-income" value={draft.grossIncomeNumber} maxLength={grossIncomeMaxLength} autoComplete="off"
          onChange={event => update({ grossIncomeNumber: event.target.value })} />
      </FormField>
      <FormField label={t("voucher.activityStart")} htmlFor="arca-activity-start" error={errors.activityStartOn}>
        <Input id="arca-activity-start" type="date" min="1900-01-01" max="9998-12-31" value={draft.activityStartOn}
          onChange={event => update({ activityStartOn: event.target.value })} />
      </FormField>
    </div>
      : settings.isError && !saved ? <InvoicingSettingsError settings={settings} />
      : settings.isPending ? <Skeleton className="h-16" />
      : <DataList items={[
        { key: "grossIncome", label: t("voucher.grossIncome"), value: grossIncome ?? empty },
        { key: "activityStart", label: t("voucher.activityStart"), value: activityStart === null ? empty : formatDateOnly(activityStart, i18n.language) ?? activityStart },
      ]} />}
  </Surface>;
}

/// Las dos zonas de Facturación con la conexión activa: el punto de venta y, debajo, los datos del comprobante.
export function InvoicingSections(props: ArcaFamilyActiveProps) {
  return <>
    <PointOfSaleSection {...props} />
    <VoucherDataSection {...props} />
  </>;
}
