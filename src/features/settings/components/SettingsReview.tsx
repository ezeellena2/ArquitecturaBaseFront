import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { retentionFields, type RetentionField, type SettingField, type SettingsDraft, type SystemSettings } from "../api/settings";
import { changedFields, draftFrom } from "../model";
import { formatNumber } from "@/shared/lib/numberFormat";
import { timeZoneCity } from "@/shared/lib/timeZones";
import { Button } from "@/shared/ui/button";
import { CellText } from "@/shared/ui/CellText";
import { ComparisonTable } from "@/shared/ui/ComparisonTable";
import { Surface } from "@/shared/ui/Surface";

export function SettingsReview({ current, draft, disabled, titleRef, onAccept }: {
  current: SystemSettings; draft: SettingsDraft; disabled: boolean; titleRef: Ref<HTMLHeadingElement>; onAccept: (keepDraft: boolean) => void;
}) {
  const { t, i18n } = useTranslation("settings");
  const saved = draftFrom(current);
  // Un plazo se lee con su unidad («12 meses», «3.650 días»); lo que todavía no es un número, como se escribió.
  const period = (field: RetentionField, text: string) => {
    const count = Number(text.trim());
    return text.trim() && Number.isInteger(count)
      ? t(field === "loginAuditMonths" ? "retention.months" : "retention.days", { count, value: formatNumber(count, i18n.language) }) : text;
  };
  // The time zone by its city, as its list names it; the identifier is what travels.
  const display = (field: SettingField, value: string | number) => field === "defaultCulture"
    ? t(`common:language.${value}`) : field === "registrationMode" ? t(`registration.${value}Label`)
      : field === "defaultTimeZoneId" ? timeZoneCity(String(value))
        : retentionFields.includes(field as RetentionField) ? period(field as RetentionField, String(value)) : String(value);
  // Las elecciones resuelven toda la comparación: van al borde derecho de su banda, a la altura del título. La comparación
  // lleva sólo los ajustes distintos, cada uno con lo guardado y tu borrador lado a lado (LR2-A, 2026-11-03).
  return <Surface title={t("review.title")} titleRef={titleRef} padded actions={<>
    <Button variant="outline" disabled={disabled} onClick={() => onAccept(false)}>{t("review.useCurrent")}</Button>
    <Button disabled={disabled} onClick={() => onAccept(true)}>{t("review.keepMine")}</Button>
  </>}>
    <ComparisonTable columns={{ identity: [{ key: "setting", header: t("review.setting") }], before: t("review.current"), after: t("review.mine") }}
      groups={changedFields(draft, current).map(field => ({ key: field, identity: [t(`fields.${field}`)],
        lines: [{ key: "value", before: <CellText text={display(field, saved[field])} />, after: <CellText text={display(field, draft[field])} /> }] }))} />
  </Surface>;
}
