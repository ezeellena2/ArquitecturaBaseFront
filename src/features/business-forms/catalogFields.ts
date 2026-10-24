import type { TFunction } from "i18next";
import type { CatalogField, CatalogFieldUsage } from "./api/catalogResponse";
import { formatCatalogValue, isCanonicalCatalogValue, parseCatalogValue, type CatalogValueType } from "./catalogValues";
import type { FormCulture } from "./model";

export type CatalogFieldType = CatalogField["type"];
export interface CatalogFieldDraft extends Omit<CatalogField, "id"> { readonly id: string | null; readonly localId: string }
export type CatalogFieldBody = Omit<CatalogFieldDraft, "hasValues" | "usedBy">;
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

export const newCatalogField = (localId: string, position: number): CatalogFieldDraft => ({ localId, id: null, key: "", name: { es: "" }, type: "text", sourceCatalogId: null, required: false, unique: false, min: null, max: null, maxLength: null, role: "data", position, isActive: true, hasValues: false, usedBy: [] });
export const openCatalogField = (field: CatalogField, culture: FormCulture = "es"): CatalogFieldDraft => ({ ...field, localId: field.id, name: { ...field.name }, min: field.min === null ? null : formatCatalogFieldValue(field, field.min, culture), max: field.max === null ? null : formatCatalogFieldValue(field, field.max, culture), usedBy: field.usedBy.map(use => ({ ...use })) });
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

/** What is wrong with a field value, quoting the value as entered (cut at 40 characters) and the reason for the field type. */
export function catalogFieldProblemText(t: TFunction<"forms">, field: Pick<CatalogFieldDraft, "type" | "min" | "max" | "maxLength">, value: string | null, reason: CatalogFieldProblemReason | "repeated"): string {
  if (reason === "required") return t("catalogs.fields.problem.required");
  const characters = [...(value?.trim() ?? "")];
  const shown = characters.length > 40 ? characters.slice(0, 40).join("") + "…" : characters.join("");
  if (reason === "repeated") return t("catalogs.fields.problem.repeated", { value: shown });
  if (reason === "invalid") return t("catalogs.fields.problem.invalid." + field.type, { value: shown });
  if (reason === "length") return t("catalogs.fields.problem.length", { value: shown, count: field.maxLength ?? textMaxLength });
  const min = field.min?.trim(), max = field.max?.trim();
  const rule = min && max ? t("catalogs.fields.problem.rule.between", { min, max }) : min ? t("catalogs.fields.problem.rule.from", { min }) : t("catalogs.fields.problem.rule.to", { max });
  return t("catalogs.fields.problem.range", { value: shown, rule });
}

export function formatCatalogFieldValue(field: Pick<CatalogFieldDraft, "type">, value: string | null | undefined, culture: FormCulture): string {
  if (value === null || value === undefined) return "";
  const type = valueType(field.type);
  return type && type !== "Date" ? formatCatalogValue(type, value, culture) : value;
}

export function catalogFieldsBody(fields: readonly CatalogFieldDraft[], culture: FormCulture = "es"): readonly CatalogFieldBody[] {
  return fields.map(({ hasValues: _hasValues, usedBy: _usedBy, ...field }, index) => {
    const type = valueType(field.type);
    const bound = (input: string | null) => {
      if (!input?.trim()) return null;
      const result = type ? parseCatalogValue(type, input, culture) : null;
      return result?.valid ? result.value : input;
    };
    return { ...field, name: { es: field.name.es.trim(), ...(field.name.en?.trim() ? { en: field.name.en.trim() } : {}) }, min: bound(field.min), max: bound(field.max), position: index + 1 };
  });
}
