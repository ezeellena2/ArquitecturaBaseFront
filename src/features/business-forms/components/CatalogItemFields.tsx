import type { CatalogValueType } from "../catalogValues";
import { catalogItemColumns } from "../catalogColumns";
import { Fragment, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import { withCatalogFieldValue, type CatalogManualItemValue } from "../catalogItemEdits";
import type { FormCulture } from "../model";
import { catalogFieldInputHint, type CatalogFieldDraft } from "../catalogFields";
import { catalogItemFieldRule } from "../catalogDraft";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { localizedValue } from "../editorModel";
import { CatalogExtraFieldInput } from "./CatalogExtraFieldInput";

export function CatalogItemFields({ item, culture, valueType, fields = [], scope, readOnly, errors, warning, onGenerateCode, onChange, onFieldBlur, onDone }: {
  item: CatalogManualItemValue; culture: FormCulture; valueType: CatalogValueType; readOnly: boolean;
  errors?: Readonly<Record<string, readonly string[]>>; warning?: string; onGenerateCode?: () => void;
  onChange: (item: CatalogManualItemValue) => void; onDone: () => void;
  /** Leaving a control, by its error path: the page then marks it if it is empty. */
  onFieldBlur?: (path: string) => void;
  fields?: readonly CatalogFieldDraft[]; scope?: CatalogReadScope;
}) {
  const { t } = useTranslation("forms");
  const textRef = useRef<HTMLInputElement>(null);
  // The editor puts the cursor in Texto when it opens; leaving it before typing is not touching it.
  const textAutoFocused = useRef(false);
  const columns = catalogItemColumns(valueType, culture, fields);
  // Typed values, and so their ranges, are read in the draft's culture, the one its editable text was written in.
  const valueCulture = scope?.culture ?? culture;
  useEffect(() => { if (textRef.current) { textAutoFocused.current = true; textRef.current.focus(); } }, []);
  return <Surface padded>
    <div className="grid gap-4 sm:grid-cols-2">
      {columns.map(column => {
        const error = errors?.[column.errorPath]?.join(" ");
        const blur = () => onFieldBlur?.(column.errorPath);
        if (column.field) {
          const field = catalogItemFieldRule(column.field, item), key = field.id ?? field.localId, label = localizedValue(field.name, culture, "es");
          // A field that cannot take values before it is saved says so instead.
          return <FormField key={column.id} label={label} required={field.required} error={error} hint={field.id ? catalogFieldInputHint(field, valueCulture, t) ?? undefined : undefined}><CatalogExtraFieldInput field={field} scope={scope} label={label} value={item.fields?.[key]} texts={item.fieldTexts?.[key]} culture={culture} readOnly={readOnly} onChange={(value, texts) => onChange(withCatalogFieldValue(item, key, value, texts))} onBlur={blur} /></FormField>;
        }
        switch (column.id) {
        case "text": return <FormField key={column.id} label={<span className="flex w-full justify-between gap-3"><span>{t(column.editorLabelKey)}</span><span aria-hidden="true" className="text-xs text-[var(--color-content-muted)]">{(item.label[culture] ?? "").length}/{column.maxLength}</span></span>} required={column.required} error={error} hint={warning ?? (culture === "en" ? t("catalogs.items.englishHint") : undefined)}>
        <Input ref={textRef} readOnly={readOnly} value={item.label[culture] ?? ""} onChange={event => { textAutoFocused.current = false; onChange({ ...item, label: { ...item.label, [culture]: event.target.value } }); }} onBlur={() => { if (textAutoFocused.current) textAutoFocused.current = false; else blur(); }} />
      </FormField>;
        case "code": return <FormField key={column.id} label={t(column.editorLabelKey)} required={column.required} error={error} hint={t("catalogs.items.codeHint")}>
          <Input maxLength={column.maxLength} readOnly={readOnly} value={item.code} onChange={event => onChange({ ...item, code: event.target.value })} onBlur={blur} />
        </FormField>;
        case "value": return <FormField key={column.id} label={t(column.editorLabelKey, { type: t("catalogs.valueTypes." + valueType) })} required={column.required} error={error} hint={t("catalogs.valueType.inputHint." + valueType)}><Input type={column.inputType} inputMode={column.inputMode} maxLength={column.maxLength} readOnly={readOnly} value={item.value ?? ""} onChange={event => onChange({ ...item, value: event.target.value || null })} onBlur={blur} /></FormField>;
        case "detail": return <FormField key={column.id} label={t(column.editorLabelKey)} error={error} hint={t("optional")}>
          <Textarea maxLength={column.maxLength} readOnly={readOnly} value={item.detail[culture] ?? ""} onChange={event => onChange({ ...item, detail: { ...item.detail, [culture]: event.target.value || null } })} />
        </FormField>;
        case "isActive": return <Fragment key={column.id}>{onGenerateCode && !item.code.trim() && !readOnly ? <Button type="button" variant="outline" onClick={onGenerateCode}>{t("catalogs.items.generateCode")}</Button> : null}<CheckboxField label={t(column.editorLabelKey)} description={t("catalogs.items.activeHint")} checked={item.isActive} disabled={readOnly} onCheckedChange={isActive => onChange({ ...item, isActive })} /></Fragment>;
        }
      })}
    </div>
    <div className="flex justify-end"><Button type="button" variant="outline" onClick={onDone}>{t("done")}</Button></div>
  </Surface>;
}
