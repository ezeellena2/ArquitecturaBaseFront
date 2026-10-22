import type { CatalogValueType } from "../catalogValues";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import type { FormCulture } from "../model";

export function CatalogItemFields({ item, culture, valueType, readOnly, errors, warning, onGenerateCode, onChange, onDone }: {
  item: CatalogManualItemValue; culture: FormCulture; valueType: CatalogValueType; readOnly: boolean;
  errors?: Readonly<Record<string, readonly string[]>>; warning?: string; onGenerateCode?: () => void;
  onChange: (item: CatalogManualItemValue) => void; onDone: () => void;
}) {
  const { t } = useTranslation("forms");
  const textRef = useRef<HTMLInputElement>(null);
  useEffect(() => { textRef.current?.focus(); }, []);
  return <Surface padded>
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label={<span className="flex w-full justify-between gap-3"><span>{t("catalogs.items.text")}</span><span aria-hidden="true" className="text-xs text-[var(--color-content-muted)]">{(item.label[culture] ?? "").length}/30</span></span>} required={culture === "es"} error={errors?.["text." + culture]?.join(" ")} hint={warning ?? (culture === "en" ? t("catalogs.items.englishHint") : undefined)}>
        <Input ref={textRef} readOnly={readOnly} value={item.label[culture] ?? ""} onChange={event => onChange({ ...item, label: { ...item.label, [culture]: event.target.value } })} />
      </FormField>
      <FormField label={t("catalogs.items.code")} required error={errors?.code?.join(" ")} hint={t("catalogs.items.codeHint")}>
        <Input maxLength={80} readOnly={readOnly} value={item.code} onChange={event => onChange({ ...item, code: event.target.value })} />
      </FormField>
      {valueType !== "Text" ? <FormField label={t("catalogs.valueType.valueLabel", { type: t("catalogs.valueTypes." + valueType) })} required error={errors?.value?.join(" ")} hint={t("catalogs.valueType.inputHint." + valueType)}><Input type={valueType === "Date" ? "date" : "text"} inputMode={valueType === "Integer" ? "numeric" : valueType === "Decimal" ? "decimal" : undefined} maxLength={64} readOnly={readOnly} value={item.value ?? ""} onChange={event => onChange({ ...item, value: event.target.value || null })} /></FormField> : null}
      <FormField label={t("catalogs.items.detail")} error={errors?.["detail." + culture]?.join(" ")} hint={t("optional")}>
        <Textarea maxLength={300} readOnly={readOnly} value={item.detail[culture] ?? ""} onChange={event => onChange({ ...item, detail: { ...item.detail, [culture]: event.target.value || null } })} />
      </FormField>
      {onGenerateCode && !item.code.trim() && !readOnly ? <Button type="button" variant="outline" onClick={onGenerateCode}>{t("catalogs.items.generateCode")}</Button> : null}
      <CheckboxField label={t("catalogs.items.active")} description={t("catalogs.items.activeHint")} checked={item.isActive} disabled={readOnly} onCheckedChange={isActive => onChange({ ...item, isActive })} />
    </div>
    <div className="flex justify-end"><Button type="button" variant="outline" onClick={onDone}>{t("done")}</Button></div>
  </Surface>;
}
