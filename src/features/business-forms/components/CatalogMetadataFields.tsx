import type { CatalogValueType } from "../catalogValues";
import { useTranslation } from "react-i18next";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Surface } from "@/shared/ui/Surface";
import { Textarea } from "@/shared/ui/textarea";
import { contentReference, contentRequired } from "../editorModel";
import type { FormCulture } from "../model";
import { localizedIssue, localizedIssueMessage } from "../validationPaths";

type Texts = Readonly<Record<"es" | "en", string>>;
// No language selector: name and description are edited in the menu language (`culture`). Outside the catalog's original
// they are the optional translation, with the original as a reference; an error of the other language shows under the field.
export function CatalogMetadataFields({ name, description, culture, original, canManage, busy = false, origin = "Manual", valueType, errors = {}, onChange }: {
  valueType: CatalogValueType; name: Texts; description: Texts; culture: FormCulture; original: FormCulture; canManage: boolean; busy?: boolean; origin?: "Manual" | "Filters";
  errors?: Readonly<Record<string, readonly string[]>>;
  onChange: (value: { name?: Texts; description?: Texts }) => void;
}) {
  const { t } = useTranslation("forms");
  const readOnly = !canManage || busy;
  const reference = (text: Texts) => { const value = contentReference(text, culture, original); return value ? t("originalText", { language: t("cultures." + original), text: value }) : undefined; };
  const textError = (path: "name" | "description") => localizedIssueMessage(localizedIssue(errors, path, culture), culture, t);
  return <Surface title={t("catalogs.metadata.title")} padded><div className="grid w-full max-w-2xl grid-cols-1 gap-4">
    <p className="text-sm text-[var(--color-content-muted)]">{[t(origin === "Manual" ? "catalogs.source.manual" : "catalogs.source.database"), t("catalogs.valueTypes." + valueType)].join(" · ")}</p>
    <FormField label={t("name")} required={contentRequired(name, culture, original)} hint={reference(name)} error={textError("name")}>
      <Input readOnly={readOnly} maxLength={120} placeholder={culture !== original ? t("missingText") : undefined} value={name[culture]} onChange={event => onChange({ name: { ...name, [culture]: event.target.value } })} />
    </FormField>
    <FormField label={t("catalogs.metadata.description")} hint={reference(description) ?? t("catalogs.metadata.descriptionHint")} error={textError("description")}>
      <Textarea readOnly={readOnly} maxLength={1000} placeholder={culture !== original && description[original].trim() ? t("missingText") : undefined} value={description[culture]} onChange={event => onChange({ description: { ...description, [culture]: event.target.value } })} />
    </FormField>
  </div></Surface>;
}
