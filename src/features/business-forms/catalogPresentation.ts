import type { CatalogPresentation } from "./api/catalogResponse";
import type { CatalogFieldDraft } from "./catalogFields";
import type { CatalogValueType } from "./catalogValues";
import { parseCatalogValue } from "./catalogValues";
import { formatDateOnly } from "@/shared/lib/dateTime";
import { localizedValue } from "./editorModel";
import type { CatalogManualItemValue } from "./catalogItemEdits";
import type { FormCulture } from "./model";

export function catalogOptionPresentation(item: CatalogManualItemValue, presentation: CatalogPresentation | null, fields: readonly CatalogFieldDraft[], valueType: CatalogValueType, culture: FormCulture, booleanLabels?: { readonly yes: string; readonly no: string }, inputCulture: FormCulture = culture): { title: string; description: string } {
  const selected = presentation ?? { title: ["text"], description: ["detail"] };
  const scalar = (type: CatalogFieldDraft["type"], input: string | null | undefined): string => {
    if (!input) return "";
    if (type === "boolean") return input === "true" ? booleanLabels?.yes ?? input : input === "false" ? booleanLabels?.no ?? input : input;
    const numericType = type === "integer" ? "Integer" : type === "decimal" ? "Decimal" : type === "date" ? "Date" : null;
    if (!numericType) return input;
    const canonical = parseCatalogValue(numericType, input, inputCulture);
    if (!canonical.valid || canonical.value === null) return input;
    return type === "date" ? formatDateOnly(canonical.value, culture, "numeric") ?? input : type === "decimal" && culture === "es" ? canonical.value.replace(".", ",") : canonical.value;
  };
  const part = (key: string): string => {
    if (key === "text") return localizedValue(item.label, culture, "es");
    if (key === "code") return item.code;
    if (key === "detail") return localizedValue(item.detail, culture, "es");
    if (key === "value") return scalar(valueType === "Integer" ? "integer" : valueType === "Decimal" ? "decimal" : valueType === "Date" ? "date" : "text", item.value);
    const value = item.fields?.[key];
    const field = fields.find(field => field.id === key || field.localId === key);
    const sourceText = item.fieldTexts?.[key];
    if (!value) return "";
    if (sourceText && (!field || field.type === "catalog")) return localizedValue(sourceText, culture, "es");
    return field ? scalar(field.type, value) : value ?? "";
  };
  const join = (keys: readonly string[]) => keys.map(part).filter(text => !!text.trim()).join(" · ");
  return { title: join(selected.title), description: join(selected.description) };
}
