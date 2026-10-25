import type { CatalogPresentation } from "./api/catalogResponse";
import type { CatalogFieldDraft } from "./catalogFields";
import type { CatalogValueType } from "./catalogValues";
import { catalogScalarText } from "./catalogValues";
import { administrativeName } from "./editorModel";
import type { CatalogManualItemValue } from "./catalogItemEdits";
import type { FormCulture } from "./model";

const fixedParts = ["text", "code", "detail", "value"];

/** Names the parts of a presentation in order: fixed ones with their label, extra fields by name; null is the usual text and detail. */
export function presentationPartNames(presentation: CatalogPresentation | null, fields: readonly { readonly id: string | null; readonly localId?: string; readonly name: Parameters<typeof administrativeName>[0] }[], culture: FormCulture, fixedName: (key: string) => string, unavailable: string): { title: string[]; description: string[] } {
  const selected = presentation ?? { title: ["text"], description: ["detail"] };
  const name = (key: string) => {
    if (fixedParts.includes(key)) return fixedName(key);
    const field = fields.find(field => field.id === key || field.localId === key);
    return (field ? administrativeName(field.name, culture) : "") || unavailable;
  };
  return { title: selected.title.map(name), description: selected.description.map(name) };
}

/** A removed field leaves the presentation; an empty title falls back to the option text, the default. */
export function withoutPresentationFields(presentation: CatalogPresentation | null, keys: readonly string[]): CatalogPresentation | null {
  if (!presentation) return null;
  const kept = (part: readonly string[]) => part.filter(key => !keys.includes(key));
  const title = kept(presentation.title);
  return { title: title.length ? title : ["text"], description: kept(presentation.description) };
}

/** `pendingTexts`: by field, what an unedited option or yes/no showed while a type change is pending (`pendingFieldTexts`). */
export function catalogOptionPresentation(item: CatalogManualItemValue, presentation: CatalogPresentation | null, fields: readonly CatalogFieldDraft[], valueType: CatalogValueType, culture: FormCulture, booleanLabels?: { readonly yes: string; readonly no: string }, inputCulture: FormCulture = culture, pendingTexts: Readonly<Record<string, string>> = {}): { title: string; description: string } {
  const selected = presentation ?? { title: ["text"], description: ["detail"] };
  const scalar = (type: CatalogFieldDraft["type"], input: string | null | undefined): string =>
    input ? (type === "text" || type === "catalog" ? input : catalogScalarText(type, input, culture, booleanLabels, inputCulture)) : "";
  const part = (key: string): string => {
    if (key === "text") return administrativeName(item.label, culture);
    if (key === "code") return item.code;
    if (key === "detail") return administrativeName(item.detail, culture);
    if (key === "value") return scalar(valueType === "Integer" ? "integer" : valueType === "Decimal" ? "decimal" : valueType === "Date" ? "date" : "text", item.value);
    const value = item.fields?.[key];
    const field = fields.find(field => field.id === key || field.localId === key);
    const sourceText = item.fieldTexts?.[key];
    if (!value) return "";
    if (pendingTexts[key]) return pendingTexts[key];
    if (sourceText && (!field || field.type === "catalog")) return administrativeName(sourceText, culture);
    return field ? scalar(field.type, value) : value ?? "";
  };
  const join = (keys: readonly string[]) => keys.map(part).filter(text => !!text.trim()).join(" · ");
  return { title: join(selected.title), description: join(selected.description) };
}
