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

export function CatalogItemFields({ item, culture, readOnly, errors, onChange, onDone }: {
  item: CatalogManualItemValue; culture: FormCulture; readOnly: boolean;
  errors?: Readonly<Record<string, readonly string[]>>;
  onChange: (item: CatalogManualItemValue) => void; onDone: () => void;
}) {
  const { t } = useTranslation("forms");
  const textRef = useRef<HTMLInputElement>(null);
  useEffect(() => { textRef.current?.focus(); }, []);
  return <Surface padded>
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label={t("catalogs.items.text")} required={culture === "es"} error={errors?.["text." + culture]?.join(" ")} hint={culture === "en" ? t("catalogs.items.englishHint") : undefined}>
        <Input ref={textRef} maxLength={30} readOnly={readOnly} value={item.label[culture] ?? ""} onChange={event => onChange({ ...item, label: { ...item.label, [culture]: event.target.value } })} />
      </FormField>
      <FormField label={t("catalogs.items.code")} required error={errors?.code?.join(" ")} hint={t("catalogs.items.codeHint")}>
        <Input maxLength={80} readOnly={readOnly} value={item.code} onChange={event => onChange({ ...item, code: event.target.value })} />
      </FormField>
      <FormField label={t("catalogs.items.detail")} error={errors?.["detail." + culture]?.join(" ")} hint={t("optional")}>
        <Textarea maxLength={300} readOnly={readOnly} value={item.detail[culture] ?? ""} onChange={event => onChange({ ...item, detail: { ...item.detail, [culture]: event.target.value || null } })} />
      </FormField>
      <CheckboxField label={t("catalogs.items.active")} description={t("catalogs.items.activeHint")} checked={item.isActive} disabled={readOnly} onCheckedChange={isActive => onChange({ ...item, isActive })} />
    </div>
    <div className="flex justify-end"><Button type="button" variant="outline" onClick={onDone}>{t("done")}</Button></div>
  </Surface>;
}
