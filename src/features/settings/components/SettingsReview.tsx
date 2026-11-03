import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { settingFields, type SettingField, type SettingsDraft, type SystemSettings } from "../api/settings";
import { Button } from "@/shared/ui/button";
import { CellText } from "@/shared/ui/CellText";
import { ComparisonTable } from "@/shared/ui/ComparisonTable";
import { Surface } from "@/shared/ui/Surface";

export function SettingsReview({ current, draft, disabled, titleRef, onAccept }: {
  current: SystemSettings; draft: SettingsDraft; disabled: boolean; titleRef: Ref<HTMLHeadingElement>; onAccept: (keepDraft: boolean) => void;
}) {
  const { t } = useTranslation("settings");
  const display = (field: SettingField, value: string | number) => field === "defaultCulture"
    ? t(`common:language.${value}`) : field === "registrationMode" ? t(`registration.${value}Label`) : String(value).replaceAll("_", " ");
  // Las elecciones resuelven toda la comparación: van al borde derecho de su banda, a la altura del título. La comparación
  // lleva sólo los ajustes distintos, cada uno con lo guardado y tu borrador lado a lado (LR2-A, 2026-11-03).
  return <Surface title={t("review.title")} titleRef={titleRef} padded actions={<>
    <Button variant="outline" disabled={disabled} onClick={() => onAccept(false)}>{t("review.useCurrent")}</Button>
    <Button disabled={disabled} onClick={() => onAccept(true)}>{t("review.keepMine")}</Button>
  </>}>
    <ComparisonTable columns={{ identity: [{ key: "setting", header: t("review.setting") }], before: t("review.current"), after: t("review.mine") }}
      groups={settingFields.filter(field => current[field] !== draft[field]).map(field => ({ key: field, identity: [t(`fields.${field}`)],
        lines: [{ key: "value", before: <CellText text={display(field, current[field])} />, after: <CellText text={display(field, draft[field])} /> }] }))} />
  </Surface>;
}
