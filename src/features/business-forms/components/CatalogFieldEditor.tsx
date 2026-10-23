import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { catalogFieldTypes } from "../api/catalogResponse";
import type { CatalogFieldDraft } from "../catalogFields";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { CatalogQuestionSelector } from "./CatalogQuestionSelector";

export function CatalogFieldEditor({ field, scope, errors = {}, uses, readOnly, onChange, onDone }: { field: CatalogFieldDraft; scope: CatalogReadScope; errors?: Readonly<Record<string, readonly string[]>>; uses?: ReactNode; readOnly: boolean; onChange: (field: CatalogFieldDraft) => void; onDone: () => void }) {
  const { t } = useTranslation("forms");
  const nameRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const errorStamp = JSON.stringify(errors);
  useEffect(() => { (rootRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? nameRef.current)?.focus(); }, [field.localId, errorStamp]);
  const error = (path: string) => errors[path]?.join(" ");
  const range = ["integer", "decimal", "date"].includes(field.type);
  return <div ref={rootRef} className="space-y-4 bg-[var(--color-surface-muted)] p-4">
    {uses}
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label={t("name")} required error={error("name.es") ?? error("name")}><Input ref={nameRef} maxLength={120} readOnly={readOnly} value={field.name.es} onChange={event => onChange({ ...field, name: { ...field.name, es: event.target.value } })} /></FormField>
      <FormField label={t("catalogs.fields.englishName")} error={error("name.en")}><Input maxLength={120} readOnly={readOnly} value={field.name.en ?? ""} onChange={event => onChange({ ...field, name: { ...field.name, en: event.target.value } })} /></FormField>
      <FormField label={t("catalogs.fields.key")} required error={error("key")} hint={t("catalogs.fields.keyHint")}><Input maxLength={40} readOnly={readOnly || field.id !== null} value={field.key} onChange={event => onChange({ ...field, key: event.target.value })} /></FormField>
      <FormField label={t("catalogs.fields.type")} required error={error("type")} hint={field.hasValues ? t("catalogs.fields.typeReview") : undefined}><NativeSelect disabled={readOnly} value={field.type} onChange={event => { const type = event.target.value as CatalogFieldDraft["type"]; onChange({ ...field, type, sourceCatalogId: type === "catalog" ? field.sourceCatalogId : null, min: ["integer", "decimal", "date"].includes(type) ? field.min : null, max: ["integer", "decimal", "date"].includes(type) ? field.max : null, maxLength: type === "text" ? field.maxLength : null }); }}>{catalogFieldTypes.map(type => <option key={type} value={type}>{t("catalogs.fields.types." + type)}</option>)}</NativeSelect></FormField>
      {field.type === "catalog" ? <CatalogQuestionSelector scope={scope} value={field.sourceCatalogId ?? ""} readOnly={readOnly} manualOnly error={error("sourceCatalogId")} onChange={sourceCatalogId => onChange({ ...field, sourceCatalogId })} /> : null}
      <div className="space-y-2"><p className="text-sm font-medium">{t("catalogs.fields.rules")}</p><CheckboxField label={t("catalogs.fields.requiredLabel")} disabled={readOnly || field.id === null} checked={field.required} error={error("required")} description={!field.id ? t("catalogs.fields.optionalFirst") : undefined} onCheckedChange={required => onChange({ ...field, required })} /><CheckboxField label={t("catalogs.fields.unique")} disabled={readOnly} checked={field.unique} error={error("unique")} onCheckedChange={unique => onChange({ ...field, unique })} /></div>
      <div className="space-y-2"><p className="text-sm font-medium">{t("catalogs.fields.role")}</p><RadioGroupField label={t("catalogs.fields.role")} variant="cards" value={field.role} onValueChange={role => { if (!readOnly && (role === "filter" || role === "data")) onChange({ ...field, role }); }} error={error("role")} options={(["filter", "data"] as const).map(role => ({ value: role, label: t("catalogs.fields.roles." + role), description: t("catalogs.fields.roleHint." + role), disabled: readOnly }))} /></div>
      {range ? <>{(["min", "max"] as const).map(key => <FormField key={key} label={t("catalogs.fields." + key)} error={error(key)}><Input type={field.type === "date" ? "date" : "text"} inputMode={field.type === "integer" ? "numeric" : field.type === "decimal" ? "decimal" : undefined} readOnly={readOnly} value={field[key] ?? ""} onChange={event => onChange({ ...field, [key]: event.target.value || null })} /></FormField>)}</> : null}
      {field.type === "text" ? <FormField label={t("maxLength")} error={error("maxLength")}><Input type="number" min={1} max={300} readOnly={readOnly} value={field.maxLength ?? ""} onChange={event => onChange({ ...field, maxLength: event.target.value ? Number(event.target.value) : null })} /></FormField> : null}
    </div>
    <div className="flex justify-end"><Button type="button" variant="outline" onClick={onDone}>{t("done")}</Button></div>
  </div>;
}
