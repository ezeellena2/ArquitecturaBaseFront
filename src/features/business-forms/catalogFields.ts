import type { TFunction } from "i18next";
import type { CatalogField, CatalogFieldUsage } from "./api/catalogResponse";
import { catalogScalarText, formatCatalogValue, isCanonicalCatalogValue, parseCatalogValue, relocalizeCatalogValue, type CatalogValueType } from "./catalogValues";
import type { FormCulture } from "./model";
import { ownTexts } from "./editorModel";
import { formatYesNo, type YesNoLabels } from "@/shared/lib/typedValue";

export type CatalogFieldType = CatalogField["type"];
export interface CatalogFieldDraft extends Omit<CatalogField, "id"> { readonly id: string | null; readonly localId: string }
export type CatalogFieldBody = Omit<CatalogFieldDraft, "valuesCount" | "usedBy">;
/** What the server said about each field when saving, by `localId` and control path. */
export type CatalogFieldErrors = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
export const catalogFieldHasErrors = (errors: CatalogFieldErrors, field: Pick<CatalogFieldDraft, "localId">) => Object.values(errors[field.localId] ?? {}).some(messages => messages.length > 0);
export type CatalogFieldValueResult = { readonly valid: true; readonly value: string | null } | { readonly valid: false; readonly reason: "required" | "invalid" | "range" | "length" };
export type CatalogFieldProblemReason = Extract<CatalogFieldValueResult, { valid: false }>["reason"];
const textMaxLength = 300;
/** An option of the source catalog: a non-empty GUID. */
export const isCatalogOptionId = (text: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(text);
/** A loaded value the control of the draft type cannot hold (a type change pending save), shown as it is until edited. */
export function unconvertedFieldValue(type: CatalogFieldType, value: string | null | undefined): string | null {
  if (!value) return null;
  const fits = type === "catalog" ? isCatalogOptionId(value) : type === "boolean" ? value === "true" || value === "false" : type === "date" ? isCanonicalCatalogValue("Date", value) : true;
  return fits ? null : value;
}

export const newCatalogField = (localId: string, position: number): CatalogFieldDraft => ({ localId, id: null, key: "", name: {}, type: "text", sourceCatalogId: null, required: false, unique: false, min: null, max: null, maxLength: null, role: "data", position, isActive: true, valuesCount: 0, usedBy: [] });
export const openCatalogField = (field: CatalogField, culture: FormCulture = "es"): CatalogFieldDraft => ({ ...field, localId: field.id, name: { ...field.name }, min: field.min === null ? null : formatCatalogFieldValue(field, field.min, culture), max: field.max === null ? null : formatCatalogFieldValue(field, field.max, culture), usedBy: field.usedBy.map(use => ({ ...use })) });
/** A field value written in `from`, written in `to` with the same value: only integers and decimals change. */
export function relocalizeCatalogFieldValue(type: CatalogFieldType, input: string | null, from: FormCulture, to: FormCulture): string | null {
  const typed = valueType(type);
  return typed ? relocalizeCatalogValue(typed, input, from, to) : input;
}
/** The field's editable bounds written in `to`. */
export const relocalizeCatalogField = (field: CatalogFieldDraft, from: FormCulture, to: FormCulture): CatalogFieldDraft =>
  ({ ...field, min: relocalizeCatalogFieldValue(field.type, field.min, from, to), max: relocalizeCatalogFieldValue(field.type, field.max, from, to) });
function valueType(type: CatalogFieldType): CatalogValueType | null {
  return type === "integer" ? "Integer" : type === "decimal" ? "Decimal" : type === "date" ? "Date" : null;
}

export type CatalogFieldFormStage = Exclude<CatalogFieldUsage["stage"], "Catalog">;
export interface CatalogFieldQuestionUse extends Omit<CatalogFieldUsage, "stage"> { readonly stages: readonly CatalogFieldFormStage[] }
const formStages: readonly CatalogFieldFormStage[] = ["Active", "Draft"];
/**
 * One entry per question, in arrival order, with its stages once and in a fixed order (active version, then draft).
 * The catalog's own presentation use is not a form: it only sets `catalog`. A use without identity (a form the reader
 * cannot see) cannot be matched with another and stays on its own.
 */
export function groupCatalogFieldUses(uses: readonly CatalogFieldUsage[]): { readonly questions: readonly CatalogFieldQuestionUse[]; readonly catalog: boolean } {
  const groups = new Map<string, { readonly use: Omit<CatalogFieldUsage, "stage">; readonly stages: Set<CatalogFieldFormStage> }>();
  uses.forEach(({ stage, ...use }, index) => {
    if (stage === "Catalog") return;
    const key = use.definitionId && use.questionId ? use.definitionId + "/" + use.questionId : "hidden/" + index;
    const group = groups.get(key) ?? { use, stages: new Set<CatalogFieldFormStage>() };
    group.stages.add(stage);
    groups.set(key, group);
  });
  return { questions: [...groups.values()].map(({ use, stages }) => ({ ...use, stages: formStages.filter(stage => stages.has(stage)) })), catalog: uses.some(use => use.stage === "Catalog") };
}

function compareDecimal(left: string, right: string): number {
  const [wholeA, fractionA = ""] = left.split(".");
  const [wholeB, fractionB = ""] = right.split(".");
  const scale = Math.max(fractionA.length, fractionB.length);
  const a = BigInt(wholeA! + fractionA.padEnd(scale, "0"));
  const b = BigInt(wholeB! + fractionB.padEnd(scale, "0"));
  return a < b ? -1 : a > b ? 1 : 0;
}

export function parseCatalogFieldValue(field: Pick<CatalogFieldDraft, "type" | "required" | "min" | "max" | "maxLength">, input: string | null | undefined, culture: FormCulture): CatalogFieldValueResult {
  const text = input?.trim() ?? "";
  if (!text) return field.required ? { valid: false, reason: "required" } : { valid: true, value: null };
  const type = valueType(field.type);
  if (type) {
    const result = parseCatalogValue(type, text, culture);
    if (!result.valid) return result;
    const compare = field.type === "date" ? (a: string, b: string) => a.localeCompare(b) : compareDecimal;
    for (const [input, lower] of [[field.min, true], [field.max, false]] as const) {
      if (input === null || !input.trim()) continue;
      const bound = parseCatalogValue(type, input, culture);
      if (!bound.valid) return { valid: false, reason: "invalid" };
      if (lower ? compare(result.value!, bound.value!) < 0 : compare(result.value!, bound.value!) > 0) return { valid: false, reason: "range" };
    }
    return result;
  }
  if (field.type === "boolean" && text !== "true" && text !== "false" || field.type === "catalog" && !isCatalogOptionId(text)) return { valid: false, reason: "invalid" };
  if (field.type === "text" && text.length > (field.maxLength ?? textMaxLength)) return { valid: false, reason: "length" };
  return { valid: true, value: field.type === "catalog" ? text.toLowerCase() : text };
}

/** A server row's reason, or `repeated`: a value repeated when «único» is switched on or a unique field is restored arrives as `invalid`. */
export function catalogFieldRowReason(control: string, field: Pick<CatalogFieldDraft, "unique">, reason: CatalogFieldProblemReason): CatalogFieldProblemReason | "repeated" {
  return reason === "invalid" && field.unique && (control === "unique" || control === "isActive") ? "repeated" : reason;
}

/**
 * A value stored in a field of `type` (a server row's: the field's, or the previous one in a type change) as its cell
 * shows it: integer, decimal and date with the shared typed-value format, a yes/no as Sí or No. An option's text comes
 * from its loaded option; a text, and what is not a stored value of the type, stay as they are.
 */
export function catalogStoredValueText(type: CatalogFieldType, value: string | null, culture: FormCulture, labels: YesNoLabels): string | null {
  if (value === null) return null;
  if (type === "boolean") return formatYesNo(value, labels) ?? value;
  const typed = valueType(type);
  return typed && isCanonicalCatalogValue(typed, value) ? formatCatalogValue(typed, value, culture) : value;
}

/**
 * What is wrong with a field value, quoting the value (cut at 40 characters) and the reason for the field type. A range is
 * worded like the field's help, with the draft's bounds read and formatted in `culture`; a value out of range or repeated
 * read as the type, so it is quoted with that same format. What is not a value of the type is quoted as written.
 */
export function catalogFieldProblemText(t: TFunction<"forms">, field: Pick<CatalogFieldDraft, "type" | "min" | "max" | "maxLength">, value: string | null, reason: CatalogFieldProblemReason | "repeated", culture: FormCulture): string {
  if (reason === "required") return t("catalogs.fields.problem.required");
  const written = value?.trim() ?? "", type = field.type;
  const read = written && (reason === "range" || reason === "repeated") && (type === "integer" || type === "decimal" || type === "date") ? catalogScalarText(type, written, culture, undefined, culture) : written;
  const characters = [...read];
  const shown = characters.length > 40 ? characters.slice(0, 40).join("") + "…" : characters.join("");
  if (reason === "repeated") return t("catalogs.fields.problem.repeated", { value: shown });
  if (reason === "invalid") return t("catalogs.fields.problem.invalid." + field.type, { value: shown });
  if (reason === "length") return t("catalogs.fields.problem.length", { value: shown, count: field.maxLength ?? textMaxLength });
  return t("catalogs.fields.problem.range", { value: shown, rule: catalogFieldRange(field, culture, t, "catalogs.fields.problem.rule") });
}

/**
 * The detail under a field's type: its range with the shared typed-value format, or the length of a text; null without
 * either. The draft's bounds are editable text in `culture`; what does not parse is shown as written.
 */
export function catalogFieldRuleSummary(field: Pick<CatalogFieldDraft, "type" | "min" | "max" | "maxLength">, culture: FormCulture, t: TFunction<"forms">): string | null {
  if (field.type === "text") return field.maxLength === null ? null : t("catalogs.fields.detail.length", { count: field.maxLength });
  return catalogFieldRange(field, culture, t, "catalogs.fields.detail");
}

/** The help under an integer, decimal or date value: its type and, when it has one, its range («Entero, de 0 a 180.»). */
export function catalogFieldInputHint(field: Pick<CatalogFieldDraft, "type" | "min" | "max">, culture: FormCulture, t: TFunction<"forms">): string | null {
  if (field.type !== "integer" && field.type !== "decimal" && field.type !== "date") return null;
  const type = t("catalogs.fields.inputHint." + field.type), rule = catalogFieldRange(field, culture, t, "catalogs.fields.problem.rule");
  return rule ? t("catalogs.fields.inputHint.range", { type, rule }) : t("catalogs.fields.inputHint.plain", { type });
}

// The range of an integer, decimal or date field with the shared typed-value format, worded as a title (`detail`) or
// inside a sentence (`problem.rule`); null without bounds or for another type.
function catalogFieldRange(field: Pick<CatalogFieldDraft, "type" | "min" | "max">, culture: FormCulture, t: TFunction<"forms">, keys: "catalogs.fields.detail" | "catalogs.fields.problem.rule"): string | null {
  if (field.type !== "integer" && field.type !== "decimal" && field.type !== "date") return null;
  const type = field.type;
  const bound = (value: string | null) => value?.trim() ? catalogScalarText(type, value.trim(), culture, undefined, culture) : null;
  const min = bound(field.min), max = bound(field.max);
  return min && max ? t(keys + ".between", { min, max }) : min ? t(keys + ".from", { min }) : max ? t(keys + ".to", { max }) : null;
}

export function formatCatalogFieldValue(field: Pick<CatalogFieldDraft, "type">, value: string | null | undefined, culture: FormCulture): string {
  if (value === null || value === undefined) return "";
  const type = valueType(field.type);
  return type && type !== "Date" ? formatCatalogValue(type, value, culture) : value;
}

export function catalogFieldsBody(fields: readonly CatalogFieldDraft[], culture: FormCulture = "es"): readonly CatalogFieldBody[] {
  return fields.map(({ valuesCount: _valuesCount, usedBy: _usedBy, ...field }, index) => {
    const type = valueType(field.type);
    const bound = (input: string | null) => {
      if (!input?.trim()) return null;
      const result = type ? parseCatalogValue(type, input, culture) : null;
      return result?.valid ? result.value : input;
    };
    return { ...field, name: ownTexts(field.name), min: bound(field.min), max: bound(field.max), position: index + 1 };
  });
}
