import type { CatalogValueType } from "../catalogValues";
import { catalogItemColumns } from "../catalogColumns";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Textarea } from "@/shared/ui/textarea";
import { withCatalogFieldValue, type CatalogManualItemValue } from "../catalogItemEdits";
import type { FormCulture } from "../model";
import { catalogFieldInputHint, type CatalogFieldDraft } from "../catalogFields";
import { catalogItemFieldRule } from "../catalogDraft";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { administrativeName, contentReference, contentRequired } from "../editorModel";
import { localizedIssue, localizedIssueMessage } from "../validationPaths";
import { CatalogExtraFieldInput } from "./CatalogExtraFieldInput";
import { CatalogRow, CatalogRowHelp, CatalogRowMessage } from "./CatalogRow";

// One option in the options modal (B, 2026-10-31): a row per control with a line between rows, like a field in «Campos de…».
// It edits the draft as it is typed; the modal decides what «Listo» and «Cancelar» keep.
export function CatalogItemFields({ item, culture, original, valueType, fields = [], scope, readOnly, errors, warning, pendingTexts, onGenerateCode, onChange, onFieldBlur }: {
  item: CatalogManualItemValue; valueType: CatalogValueType; readOnly: boolean;
  /** The texts are edited in the menu language (`culture`); outside the catalog's original they are the optional translation. */
  culture: FormCulture; original: FormCulture;
  errors?: Readonly<Record<string, readonly string[]>>; warning?: string; onGenerateCode?: () => void;
  /** By field, what an unedited option or yes/no showed while a type change is pending (`pendingFieldTexts`). */
  pendingTexts?: Readonly<Record<string, string>>;
  onChange: (item: CatalogManualItemValue) => void;
  /** Leaving a control, by its error path: the page then marks it if it is empty. */
  onFieldBlur?: (path: string) => void;
  fields?: readonly CatalogFieldDraft[]; scope?: CatalogReadScope;
}) {
  const { t } = useTranslation("forms");
  const id = useId();
  const root = useRef<HTMLDivElement>(null), textRef = useRef<HTMLInputElement>(null);
  // The option opens with the cursor in its first marked control (a failed Save opens it so) or else in Texto; leaving Texto
  // before typing is not touching it. The modal mounts it per option.
  const textAutoFocused = useRef(false);
  const columns = catalogItemColumns(valueType, culture, fields);
  // Typed values, and so their ranges, are read in the draft's culture, the one its editable text was written in.
  const valueCulture = scope?.culture ?? culture;
  useEffect(() => {
    const marked = root.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (marked) marked.focus();
    else if (textRef.current) { textAutoFocused.current = true; textRef.current.focus(); }
  }, []);
  // The original's text is a reference, never copied; an error of the other language shows under the same field.
  const reference = (text: CatalogManualItemValue["label"]) => { const value = contentReference(text, culture, original); return value ? t("originalText", { language: t("cultures." + original), text: value }) : undefined; };
  // A control points to its message: its error or, without one, its hint.
  const described = (key: string, error?: string, hint?: string) => ({ id: id + key, "aria-invalid": error ? true : undefined, "aria-describedby": error || hint ? id + key + "-message" : undefined });
  const message = (key: string, error?: string, hint?: string, polite = false) => error || hint ? <CatalogRowMessage id={id + key + "-message"} error={!!error} polite={polite}>{error ?? hint}</CatalogRowMessage> : null;
  const label = (key: string, text: ReactNode, required: boolean, help?: readonly [string, string]) => <>
    <Label htmlFor={id + key}>{text}{required ? <span aria-hidden="true"> *</span> : null}</Label>{help ? <CatalogRowHelp label={help[0]} text={help[1]} /> : null}
  </>;
  return <div ref={root} className="flex flex-col divide-y divide-[var(--color-border)] [&>*]:px-4 [&>*]:py-3">
    {columns.map(column => {
      const error = column.id === "text" || column.id === "detail" ? localizedIssueMessage(localizedIssue(errors, column.id, culture), culture, t) : errors?.[column.errorPath]?.join(" ");
      const blur = () => onFieldBlur?.(column.errorPath);
      if (column.field) {
        const field = catalogItemFieldRule(column.field, item), key = field.id ?? field.localId, name = administrativeName(field.name, culture);
        // A field that cannot take values before it is saved says so instead. Its error quotes the value and changes with
        // each keystroke, so it is a polite status, not an alert that interrupts the typing.
        const hint = field.id ? catalogFieldInputHint(field, valueCulture, t) ?? undefined : undefined;
        return <CatalogRow key={column.id} label={label(column.id, name, field.required)}>
          <CatalogExtraFieldInput field={field} scope={scope} label={name} value={item.fields?.[key]} texts={item.fieldTexts?.[key]} pendingText={pendingTexts?.[key]} culture={culture} readOnly={readOnly} {...described(column.id, error, hint)} onChange={(value, texts) => onChange(withCatalogFieldValue(item, key, value, texts))} onBlur={blur} />
          {message(column.id, error, hint, true)}
        </CatalogRow>;
      }
      switch (column.id) {
      case "text": {
        const hint = warning ?? reference(item.label);
        return <CatalogRow key={column.id} label={label(column.id, t(column.editorLabelKey), column.required && contentRequired(item.label, culture, original), [t("catalogs.items.textHelp"), t("catalogs.items.textHint")])}>
          <div className="flex items-center gap-2">
            <Input ref={textRef} {...described(column.id, error, hint)} readOnly={readOnly} placeholder={culture !== original ? t("missingText") : undefined} value={item.label[culture] ?? ""} onChange={event => { textAutoFocused.current = false; onChange({ ...item, label: { ...item.label, [culture]: event.target.value } }); }} onBlur={() => { if (textAutoFocused.current) textAutoFocused.current = false; else blur(); }} />
            <span aria-hidden="true" className="shrink-0 text-xs text-[var(--color-content-muted)]">{(item.label[culture] ?? "").length}/{column.maxLength}</span>
          </div>
          {message(column.id, error, hint)}
        </CatalogRow>;
      }
      // Generating the code follows the permission (`onGenerateCode` comes only with Manage): it does not appear or
      // disappear while typing, saving or reviewing a conflict. With a code, or while the option is read-only, it is disabled.
      case "code": return <CatalogRow key={column.id} label={label(column.id, t(column.editorLabelKey), column.required, [t("catalogs.items.codeHelp"), t("catalogs.items.codeHint")])}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input className="min-w-0 sm:flex-1" {...described(column.id, error)} maxLength={column.maxLength} readOnly={readOnly} value={item.code} onChange={event => onChange({ ...item, code: event.target.value })} onBlur={blur} />
          {onGenerateCode ? <Button type="button" variant="outline" disabled={readOnly || !!item.code.trim()} onClick={onGenerateCode}>{t("catalogs.items.generateCode")}</Button> : null}
        </div>
        {message(column.id, error)}
      </CatalogRow>;
      case "value": {
        const hint = t("catalogs.valueType.inputHint." + valueType);
        return <CatalogRow key={column.id} label={label(column.id, t(column.editorLabelKey, { type: t("catalogs.valueTypes." + valueType) }), column.required)}>
          <Input {...described(column.id, error, hint)} type={column.inputType} inputMode={column.inputMode} maxLength={column.maxLength} readOnly={readOnly} value={item.value ?? ""} onChange={event => onChange({ ...item, value: event.target.value || null })} onBlur={blur} />
          {message(column.id, error, hint)}
        </CatalogRow>;
      }
      case "detail": {
        const hint = reference(item.detail);
        return <CatalogRow key={column.id} label={label(column.id, t(column.editorLabelKey), false, [t("catalogs.items.detailHelp"), t("catalogs.items.detailHint")])}>
          <Textarea {...described(column.id, error, hint)} maxLength={column.maxLength} readOnly={readOnly} placeholder={hint ? t("missingText") : undefined} value={item.detail[culture] ?? ""} onChange={event => onChange({ ...item, detail: { ...item.detail, [culture]: event.target.value || null } })} />
          {message(column.id, error, hint)}
        </CatalogRow>;
      }
      // A new option is born active; a saved one chooses its state here, with what a deactivation means in the (i).
      case "isActive": return item.itemId === null ? null : <CatalogRow key={column.id} label={<><Label>{t("catalogs.columns.state")}</Label><CatalogRowHelp label={t("catalogs.items.stateHelp")} text={t("catalogs.items.activeHint")} /></>}>
        <div className="sm:self-start"><SegmentedControl fullWidth aria-label={t("catalogs.columns.state")} options={([true, false] as const).map(isActive => ({ key: String(isActive), label: t(isActive ? "catalogs.items.active" : "catalogs.items.inactive"), pressed: item.isActive === isActive, onSelect: () => { if (!readOnly) onChange({ ...item, isActive }); } }))} /></div>
      </CatalogRow>;
      }
    })}
  </div>;
}
