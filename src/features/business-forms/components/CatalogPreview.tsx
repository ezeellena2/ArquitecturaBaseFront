import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { PhonePreview } from "@/shared/ui/PhonePreview";
import { RadioGroupField } from "@/shared/ui/RadioGroupField";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { administrativeName } from "../editorModel";
import type { CatalogManualItemValue } from "../catalogItemEdits";
import type { FormCulture } from "../model";
import type { CatalogFieldDraft } from "../catalogFields";
import type { CatalogPresentation } from "../api/catalogResponse";
import type { CatalogValueType } from "../catalogValues";
import { catalogOptionPresentation } from "../catalogPresentation";

export function CatalogPreview({ items, name, culture, fields = [], presentation = null, valueType = "Text", inputCulture = culture, pendingTexts }: { items: readonly CatalogManualItemValue[]; name: string; culture: FormCulture; fields?: readonly CatalogFieldDraft[]; presentation?: CatalogPresentation | null; valueType?: CatalogValueType; inputCulture?: FormCulture; pendingTexts?: Readonly<Record<string, Readonly<Record<string, string>>>> }) {
  const { t } = useTranslation("forms"), { t: content } = useTranslation("forms", { lng: culture });
  const [mode, setMode] = useState<"one" | "many">("one"), [open, setOpen] = useState(false), [selected, setSelected] = useState(""), [many, setMany] = useState<string[]>([]);
  const options = items.filter(item => item.isActive && administrativeName(item.label, culture).trim());
  const shown = (item: CatalogManualItemValue) => catalogOptionPresentation(item, presentation, fields, valueType, culture, { yes: content("catalogs.presentation.yes"), no: content("catalogs.presentation.no") }, inputCulture, pendingTexts?.[item.localId]);
  const label = (item: CatalogManualItemValue) => shown(item).title;
  const chosen = options.find(item => item.localId === selected);
  return <section aria-label={t("catalogs.preview.title")} className="flex min-w-0 flex-col gap-3">
    <h2 className="text-xs font-semibold uppercase tracking-wide">{t("catalogs.preview.title")}</h2>
    <SegmentedControl aria-label={t("catalogs.preview.mode")} options={(["one", "many"] as const).map(key => ({ key, label: t("catalogs.preview." + key), pressed: mode === key, onSelect: () => { setMode(key); setOpen(false); } }))}/>
    <p className="text-xs text-[var(--color-content-muted)]">{t("catalogs.preview.questionDecides")}</p>
    <PhonePreview title={name}>{mode === "many" ? <><p className="text-sm">{content("catalogs.preview.upTo", { count: 3 })}</p>{options.map(item => <CheckboxField key={item.localId} label={label(item)} description={shown(item).description || undefined} checked={many.includes(item.localId)} disabled={!many.includes(item.localId) && many.filter(id => options.some(option => option.localId === id)).length >= 3} onCheckedChange={checked => setMany(values => checked ? [...values, item.localId] : values.filter(id => id !== item.localId))}/>)}</>
      : open ? <><RadioGroupField label={name} value={chosen?.localId} onValueChange={value => { setSelected(value); setOpen(false); }} options={options.map(item => ({ value: item.localId, label: label(item), description: shown(item).description || undefined }))}/><Button type="button" variant="outline" onClick={() => setOpen(false)}>{content("catalogs.preview.back")}</Button></>
      : <Button type="button" variant="outline" onClick={() => setOpen(true)} aria-expanded={open}>{chosen ? label(chosen) : content("catalogs.preview.choose")}</Button>}
      <div className="mt-auto"><Button className="w-full" disabled>{content("submitLabel")}</Button><p className="mt-2 text-center text-xs text-[var(--color-content-muted)]">{content("previewOnly")}</p></div>
    </PhonePreview>
    <p className="text-xs text-[var(--color-content-muted)]">{t(mode === "many" ? "catalogs.preview.limitMany" : "catalogs.preview.limit")}</p>
  </section>;
}
