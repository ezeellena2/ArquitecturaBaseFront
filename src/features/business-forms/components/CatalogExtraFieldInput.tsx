import { useId, useRef, type JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Input } from "@/shared/ui/input";
import { Picker } from "@/shared/ui/Picker";
import type { CatalogItem } from "../api/catalogResponse";
import { unconvertedFieldValue, type CatalogFieldDraft } from "../catalogFields";
import type { FormCulture } from "../model";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail, useCatalogItems } from "../hooks/useCatalogQueries";
import { administrativeName } from "../editorModel";
import { usePickerPages } from "../hooks/usePickerPages";

interface Props {
  field: CatalogFieldDraft; value: string | null | undefined; texts?: Readonly<Record<string, string | null>>;
  culture: FormCulture; label: string; readOnly: boolean; error?: string; scope?: CatalogReadScope;
  id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string;
  onChange: (value: string | null, texts?: Readonly<Record<string, string>>) => void;
  /** Leaving the control, which the page counts as having touched it. */
  onBlur?: () => void;
  /** While a type change is pending, what an unedited option or yes/no showed (`pendingFieldTexts`): it shows like a value
   *  that does not convert, until it is cleared. */
  pendingText?: string;
}

// A field that picks from a catalog, with the only piece to choose (DS1-A): the active options of its source, searched in the
// server twenty at a time with «Mostrar N más»; an optional one starts with «Sin valor», which clears it. The wait of the source and
// of a search, its failure with «Reintentar» and a search that matches nothing are said inside the list. Leaving it, list closed,
// is touching it for the page.
function SourceOptionInput({ field, value, texts, culture, label, readOnly, error: _error, scope, onChange, onBlur, pendingText, ...aria }: Props) {
  const { t } = useTranslation("forms");
  const pages = usePickerPages<CatalogItem>();
  const owner = scope ?? { actorId: null, culture, permissions: [] };
  const detail = useCatalogDetail(owner, readOnly ? "" : field.sourceCatalogId ?? "", "global");
  const items = useCatalogItems(owner, readOnly ? "" : field.sourceCatalogId ?? "", detail.data?.revision ?? null, { page: pages.page, pageSize: 20, search: pages.settled, isActive: true, sort: "text" }, "global");
  // A source offers its own options when it is Manual or External (kept by a module, such as the condition frente al IVA).
  const sourceActive = (detail.data?.kind === "Manual" || detail.data?.kind === "External") && detail.data.isActive && !detail.data.unavailableReasonCode;
  const list = pages.list(items);
  const failed = (detail.isError && !detail.isFetching) || (sourceActive && list.failed);
  const loading = !failed && ((detail.isFetching && !detail.data) || (sourceActive && list.loading));
  // A cleared value shows no option, even while the caller still holds the texts of the previous one.
  const currentText = !value ? "" : pendingText ?? (texts ? administrativeName(texts, culture) : administrativeName(items.data?.items.find(item => item.id === value)?.text, culture) || (unconvertedFieldValue("catalog", value) ?? ""));
  const open = useRef(false);
  return <div className="min-w-32" onBlur={event => { if (!open.current && !event.currentTarget.contains(event.relatedTarget)) onBlur?.(); }}>
    <Picker {...aria} label={label} value={value || (field.required ? null : "")} disabled={readOnly || (!loading && !failed && !sourceActive)}
      first={field.required ? undefined : { id: "", label: t("catalogs.fields.noValue") }} placeholder={field.required ? t("select") : undefined}
      options={sourceActive ? list.options.filter(item => item.isActive).map(item => ({ id: item.id, label: administrativeName(item.text, culture) })) : []}
      selectedOptions={value ? [{ id: value, label: currentText || "…" }] : undefined}
      search={pages.search} onSearchChange={pages.onSearchChange} total={list.total} loading={loading} failed={failed}
      onRetry={() => { void detail.refetch(); if (sourceActive) void items.refetch(); }} onLoadMore={list.onLoadMore} loadingMore={list.loadingMore} pageSize={list.pageSize}
      onOpenChange={next => { open.current = next; }}
      onChange={id => {
        if (!id) { onChange(null); return; }
        const option = list.options.find(item => item.id === id);
        if (option) onChange(id, Object.fromEntries(Object.entries(option.text).filter((entry): entry is [string, string] => typeof entry[1] === "string")));
      }} />
  </div>;
}

export function CatalogExtraFieldInput(props: Props) {
  const { field, value, texts, culture, label, readOnly, error, onChange, scope: _scope, pendingText, ...aria } = props;
  const { t } = useTranslation("forms");
  const generatedId = useId(), id = aria.id ?? generatedId, messageId = id + "-message";
  const saved = field.id !== null;
  const attributes = { ...aria, id, "aria-invalid": error ? true : aria["aria-invalid"], "aria-describedby": error ? messageId : aria["aria-describedby"] };
  const disabled = readOnly || !saved;
  // A field that is not saved yet cannot take values: its disabled control says why as a tooltip and its description,
  // without a text under the cell.
  const control = (element: JSX.Element, className?: string) => <DisabledReason reason={saved ? null : t("catalogs.fields.savedFirst")} className={className}>{element}</DisabledReason>;
  // A loaded value the draft type cannot hold yet (a type change pending save) shows as it is until it is edited; an option
  // or a yes/no, as it showed.
  const unconverted = pendingText ?? unconvertedFieldValue(field.type, value);
  const clear = <Button type="button" variant="ghost" size="inline" aria-label={t("catalogs.fields.clearValue", { name: label })} onClick={() => onChange(null)}>{t("catalogs.fields.clear")}</Button>;
  return <div className="min-w-32">{field.type === "catalog" && saved && !readOnly ? <SourceOptionInput {...props} {...attributes} /> : unconverted && field.type !== "catalog" ? <div className="flex items-center gap-2">{control(<Input {...attributes} aria-label={label} disabled={!saved} readOnly value={unconverted} />, "flex w-full")}{disabled ? null : clear}</div> : field.type === "boolean" ? <div className="flex items-center gap-2">{control(<Checkbox {...attributes} aria-label={label} disabled={disabled} checked={value === null || value === undefined ? "indeterminate" : value === "true"} onCheckedChange={checked => onChange(checked === true ? "true" : "false")} />)}{!field.required && value !== null && value !== undefined && !disabled ? clear : null}</div> : control(<Input {...attributes} aria-label={label} disabled={!saved} readOnly={readOnly} type={field.type === "date" ? "date" : "text"} inputMode={field.type === "integer" ? "numeric" : field.type === "decimal" ? "decimal" : undefined} maxLength={field.type === "text" ? field.maxLength ?? 300 : 64} value={field.type === "catalog" ? value && texts ? administrativeName(texts, culture) : unconverted ?? "" : value ?? ""} onChange={event => onChange(event.target.value || null)} />, "flex w-full")}{error ? <p id={messageId} role="alert" className="whitespace-normal text-xs text-[var(--color-danger)]">{error}</p> : null}</div>;
}
