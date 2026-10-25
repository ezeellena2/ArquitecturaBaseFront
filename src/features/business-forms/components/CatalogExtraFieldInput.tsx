import { useEffect, useId, useState, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Autocomplete } from "@/shared/ui/Autocomplete";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Input } from "@/shared/ui/input";
import { unconvertedFieldValue, type CatalogFieldDraft } from "../catalogFields";
import type { FormCulture } from "../model";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail, useCatalogItems } from "../hooks/useCatalogQueries";
import { administrativeName } from "../editorModel";

interface Props {
  field: CatalogFieldDraft; value: string | null | undefined; texts?: Readonly<Record<string, string | null>>;
  culture: FormCulture; label: string; readOnly: boolean; error?: string; scope?: CatalogReadScope;
  id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string;
  onChange: (value: string | null, texts?: Readonly<Record<string, string>>) => void;
  /** Leaving the control, which the page counts as having touched it. */
  onBlur?: () => void;
}

function SourceOptionInput({ field, value, texts, culture, label, readOnly, error: _error, scope, onChange, onBlur, ...aria }: Props) {
  const { t } = useTranslation("forms");
  const [search, setSearch] = useState<string | null>(null), [settled, setSettled] = useState("");
  useEffect(() => { const timer = setTimeout(() => setSettled(search ?? ""), 300); return () => clearTimeout(timer); }, [search]);
  const owner = scope ?? { actorId: null, culture, permissions: [] };
  const detail = useCatalogDetail(owner, readOnly ? "" : field.sourceCatalogId ?? "", "global");
  const items = useCatalogItems(owner, readOnly ? "" : field.sourceCatalogId ?? "", detail.data?.revision ?? null, { page: 1, pageSize: 20, search: settled, isActive: true, sort: "text" }, "global");
  const sourceActive = detail.data?.kind === "Manual" && detail.data.isActive && !detail.data.unavailableReasonCode;
  // A cleared value shows no option, even while the caller still holds the texts of the previous one.
  const currentText = !value ? "" : texts ? administrativeName(texts, culture) : administrativeName(items.data?.items.find(item => item.id === value)?.text, culture) || (unconvertedFieldValue("catalog", value) ?? "");
  const options = sourceActive ? (items.data?.items ?? []).filter(item => item.isActive).map(item => ({ id: item.id, label: administrativeName(item.text, culture) })) : [];
  return <div className="min-w-32"><Autocomplete {...aria} aria-label={label} disabled={readOnly || !sourceActive} value={search ?? currentText} options={options} onValueChange={next => { setSearch(next); if (!next) onChange(null); }} onBlur={() => { setSearch(null); onBlur?.(); }} onSelect={id => { const option = items.data?.items.find(item => item.id === id); if (option) { onChange(id, Object.fromEntries(Object.entries(option.text).filter((entry): entry is [string, string] => typeof entry[1] === "string"))); setSearch(null); } }} footer={items.data?.hasNext ? t("catalogQuestion.search") : undefined} />{detail.isError || items.isError ? <Button type="button" variant="link" onClick={() => { void detail.refetch(); void items.refetch(); }}>{t("common:actions.retry")}</Button> : null}</div>;
}

export function CatalogExtraFieldInput(props: Props) {
  const { field, value, texts, culture, label, readOnly, error, onChange, scope: _scope, ...aria } = props;
  const { t } = useTranslation("forms");
  const generatedId = useId(), id = aria.id ?? generatedId, messageId = id + "-message";
  const saved = field.id !== null;
  const attributes = { ...aria, id, "aria-invalid": error ? true : aria["aria-invalid"], "aria-describedby": error ? messageId : aria["aria-describedby"] };
  const disabled = readOnly || !saved;
  // A field that is not saved yet cannot take values: its disabled control says why as a tooltip and its description,
  // without a text under the cell.
  const control = (element: JSX.Element, className?: string) => <DisabledReason reason={saved ? null : t("catalogs.fields.savedFirst")} className={className}>{element}</DisabledReason>;
  // A loaded value the draft type cannot hold yet (a type change pending save) shows as it is until it is edited.
  const unconverted = unconvertedFieldValue(field.type, value);
  const clear = <Button type="button" variant="ghost" size="inline" aria-label={t("catalogs.fields.clearValue", { name: label })} onClick={() => onChange(null)}>{t("catalogs.fields.clear")}</Button>;
  return <div className="min-w-32">{field.type === "catalog" && saved && !readOnly ? <SourceOptionInput {...props} {...attributes} /> : unconverted && field.type !== "catalog" ? <div className="flex items-center gap-2">{control(<Input {...attributes} aria-label={label} disabled={!saved} readOnly value={unconverted} />, "flex w-full")}{disabled ? null : clear}</div> : field.type === "boolean" ? <div className="flex items-center gap-2">{control(<Checkbox {...attributes} aria-label={label} disabled={disabled} checked={value === null || value === undefined ? "indeterminate" : value === "true"} onCheckedChange={checked => onChange(checked === true ? "true" : "false")} />)}{!field.required && value !== null && value !== undefined && !disabled ? clear : null}</div> : control(<Input {...attributes} aria-label={label} disabled={!saved} readOnly={readOnly} type={field.type === "date" ? "date" : "text"} inputMode={field.type === "integer" ? "numeric" : field.type === "decimal" ? "decimal" : undefined} maxLength={field.type === "text" ? field.maxLength ?? 300 : 64} value={field.type === "catalog" ? value && texts ? administrativeName(texts, culture) : unconverted ?? "" : value ?? ""} onChange={event => onChange(event.target.value || null)} />, "flex w-full")}{error ? <p id={messageId} role="alert" className="whitespace-normal text-xs text-[var(--color-danger)]">{error}</p> : null}</div>;
}
