import { useTranslation } from "react-i18next";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import type { FormCulture } from "../model";

type Texts = Readonly<Record<"es" | "en", string>>;
export function CatalogMetadataFields({ name, description, culture, canManage, busy = false, origin = "Manual", errors = {}, onCultureChange, onChange }: {
  name: Texts; description: Texts; culture: FormCulture; canManage: boolean; busy?: boolean; origin?: "Manual" | "Filters";
  errors?: Readonly<Record<string, readonly string[]>>;
  onCultureChange: (culture: FormCulture) => void;
  onChange: (value: { name?: Texts; description?: Texts }) => void;
}) {
  const { t } = useTranslation("forms");
  const readOnly = !canManage || busy;
  return <>
    <Surface padded><div className="flex flex-col gap-3"><p className="text-sm font-medium">{t("contentLanguage")}</p>
      <div className="max-w-full overflow-x-auto"><SegmentedControl aria-label={t("contentLanguage")} options={(["es", "en"] as const).map(language => ({ key: language, label: t("cultures." + language), pressed: culture === language, onSelect: () => onCultureChange(language) }))} /></div>
      <p className="text-xs text-[var(--color-content-muted)]">{t("catalogs.metadata.languagesHint")}</p>
    </div></Surface>
    <Surface title={t("catalogs.metadata.title")} padded><div className="grid gap-4 sm:grid-cols-2">
      <FormField label={t("name")} required error={errors["name." + culture]?.join(" ")}>
        <Input readOnly={readOnly} maxLength={120} value={name[culture]} onChange={event => onChange({ name: { ...name, [culture]: event.target.value } })} />
      </FormField>
      <FormField label={t("catalogs.columns.origin")} hint={t("catalogs.origin.fixedHint")}><Input readOnly value={t(origin === "Manual" ? "catalogs.source.manual" : "catalogs.source.database")} /></FormField>
      <div className="sm:col-span-2"><FormField label={t("catalogs.metadata.description")} required hint={t("catalogs.metadata.descriptionHint")} error={errors["description." + culture]?.join(" ")}>
        <Textarea readOnly={readOnly} maxLength={1000} value={description[culture]} onChange={event => onChange({ description: { ...description, [culture]: event.target.value } })} />
      </FormField></div>
    </div></Surface>
  </>;
}
