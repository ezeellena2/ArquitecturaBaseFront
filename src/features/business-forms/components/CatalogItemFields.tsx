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
import { administrativeName, contentReference, contentRequired } from "../editorModel";
import { localizedIssue, localizedIssueMessage } from "../validationPaths";
import { CatalogExtraFieldInput } from "./CatalogExtraFieldInput";

export function CatalogItemFields({ item, culture, original, valueType, fields = [], scope, readOnly, errors, warning, pendingTexts, onGenerateCode, onChange, onFieldBlur, onDone }: {
  item: CatalogManualItemValue; valueType: CatalogValueType; readOnly: boolean;
  /** The texts are edited in the menu language (`culture`); outside the catalog's original they are the optional translation. */
  culture: FormCulture; original: FormCulture;
  errors?: Readonly<Record<string, readonly string[]>>; warning?: string; onGenerateCode?: () => void;
  /** By field, what an unedited option or yes/no showed while a type change is pending (`pendingFieldTexts`). */
  pendingTexts?: Readonly<Record<string, string>>;
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
  // The original's text is a reference, never copied; an error of the other language shows under the same field.
  const reference = (text: CatalogManualItemValue["label"]) => { const value = contentReference(text, culture, original); return value ? t("originalText", { language: t("cultures." + original), text: value }) : undefined; };
  return <Surface padded>
    {/* The page looks for the option's first marked control here after a failed Save. */}
    <div data-catalog-option={item.localId} className="grid gap-4 sm:grid-cols-2">
      {columns.map(column => {
        const error = column.id === "text" || column.id === "detail" ? localizedIssueMessage(localizedIssue(errors, column.id, culture), culture, t) : errors?.[column.errorPath]?.join(" ");
        const blur = () => onFieldBlur?.(column.errorPath);
        if (column.field) {
          const field = catalogItemFieldRule(column.field, item), key = field.id ?? field.localId, label = administrativeName(field.name, culture);
          // A field that cannot take values before it is saved says so instead.
          return <FormField key={column.id} label={label} required={field.required} error={error} hint={field.id ? catalogFieldInputHint(field, valueCulture, t) ?? undefined : undefined}><CatalogExtraFieldInput field={field} scope={scope} label={label} value={item.fields?.[key]} texts={item.fieldTexts?.[key]} pendingText={pendingTexts?.[key]} culture={culture} readOnly={readOnly} onChange={(value, texts) => onChange(withCatalogFieldValue(item, key, value, texts))} onBlur={blur} /></FormField>;
        }
        switch (column.id) {
        case "text": return <FormField key={column.id} label={<span className="flex w-full justify-between gap-3"><span>{t(column.editorLabelKey)}</span><span aria-hidden="true" className="text-xs text-[var(--color-content-muted)]">{(item.label[culture] ?? "").length}/{column.maxLength}</span></span>} required={column.required && contentRequired(item.label, culture, original)} error={error} hint={warning ?? reference(item.label)}>
        <Input ref={textRef} readOnly={readOnly} placeholder={culture !== original ? t("missingText") : undefined} value={item.label[culture] ?? ""} onChange={event => { textAutoFocused.current = false; onChange({ ...item, label: { ...item.label, [culture]: event.target.value } }); }} onBlur={() => { if (textAutoFocused.current) textAutoFocused.current = false; else blur(); }} />
      </FormField>;
        case "code": return <FormField key={column.id} label={t(column.editorLabelKey)} required={column.required} error={error} hint={t("catalogs.items.codeHint")}>
          <Input maxLength={column.maxLength} readOnly={readOnly} value={item.code} onChange={event => onChange({ ...item, code: event.target.value })} onBlur={blur} />
        </FormField>;
        case "value": return <FormField key={column.id} label={t(column.editorLabelKey, { type: t("catalogs.valueTypes." + valueType) })} required={column.required} error={error} hint={t("catalogs.valueType.inputHint." + valueType)}><Input type={column.inputType} inputMode={column.inputMode} maxLength={column.maxLength} readOnly={readOnly} value={item.value ?? ""} onChange={event => onChange({ ...item, value: event.target.value || null })} onBlur={blur} /></FormField>;
        case "detail": return <FormField key={column.id} label={t(column.editorLabelKey)} error={error} hint={reference(item.detail) ?? t("optional")}>
          <Textarea maxLength={column.maxLength} readOnly={readOnly} placeholder={reference(item.detail) ? t("missingText") : undefined} value={item.detail[culture] ?? ""} onChange={event => onChange({ ...item, detail: { ...item.detail, [culture]: event.target.value || null } })} />
        </FormField>;
        // Generating the code follows the permission (`onGenerateCode` comes only with Manage): it does not appear or
        // disappear while typing, saving or reviewing a conflict. With a code, or while the option is read-only, it is disabled.
        case "isActive": return <Fragment key={column.id}>{onGenerateCode ? <Button type="button" variant="outline" disabled={readOnly || !!item.code.trim()} onClick={onGenerateCode}>{t("catalogs.items.generateCode")}</Button> : null}<CheckboxField label={t(column.editorLabelKey)} description={t("catalogs.items.activeHint")} checked={item.isActive} disabled={readOnly} onCheckedChange={isActive => onChange({ ...item, isActive })} /></Fragment>;
        }
      })}
    </div>
    <div className="flex justify-end"><Button type="button" variant="outline" onClick={onDone}>{t("done")}</Button></div>
  </Surface>;
}
