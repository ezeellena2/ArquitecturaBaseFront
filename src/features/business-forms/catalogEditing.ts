import { administrativeName } from "./editorModel";
import type { CatalogManualItemValue } from "./catalogItemEdits";
import type { FormCulture } from "./model";
export interface CatalogItemProblem { localId: string; field: string; kind: "required" | "duplicateCode" | "textTooLong"; otherPosition?: number | null }
// Match ordinal case-insensitive codes without expanding one letter into several different letters.
const folded = (value: string) => Array.from(value.trim()).map(letter => { const upper = letter.toUpperCase(); return upper.length === letter.length ? upper : letter; }).join("");
// An option needs its text only in the catalog's original (`original`); the other language is an optional translation.
export function catalogItemProblems(items: readonly CatalogManualItemValue[], original: FormCulture): CatalogItemProblem[] {
  const problems: CatalogItemProblem[] = [];
  const codes = new Map<string, CatalogManualItemValue[]>();
  for (const item of items) { const key = folded(item.code); const group = codes.get(key) ?? []; group.push(item); codes.set(key, group); }
  for (const item of items) {
    if (!item.code.trim()) problems.push({ localId: item.localId, field: "code", kind: "required" });
    else {
      const duplicate = codes.get(folded(item.code))?.find(other => other.localId !== item.localId);
      if (duplicate) problems.push({ localId: item.localId, field: "code", kind: "duplicateCode", otherPosition: duplicate.position });
    }
    for (const culture of ["es", "en"]) {
      const text = item.label[culture] ?? "";
      if (culture === original && !text.trim()) problems.push({ localId: item.localId, field: "text." + original, kind: "required" });
      else if (text.length > 30) problems.push({ localId: item.localId, field: "text." + culture, kind: "textTooLong" });
    }
  }
  return problems;
}
export function generateMissingCatalogCodes(items: readonly CatalogManualItemValue[]): readonly CatalogManualItemValue[] {
  const used = new Set(items.filter(item => item.code.trim()).map(item => folded(item.code)));
  return items.map(item => {
    if (item.code.trim()) return item;
    const base = administrativeName(item.label, "es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
    if (!base) return item;
    let code = base, suffix = 1;
    while (used.has(folded(code))) { const tail = "-" + ++suffix; code = base.slice(0, 80 - tail.length) + tail; }
    used.add(folded(code)); return { ...item, code };
  });
}

export function duplicateCatalogTexts(items: readonly CatalogManualItemValue[], culture: string): Readonly<Record<string, number | null>> {
  const groups = new Map<string, CatalogManualItemValue[]>();
  for (const item of items) { const key = folded(item.label[culture] ?? ""); if (key) { const group = groups.get(key) ?? []; group.push(item); groups.set(key, group); } }
  const duplicates: Record<string, number | null> = {};
  for (const group of groups.values()) if (group.length > 1) for (const [index, item] of group.entries()) duplicates[item.localId] = group[index === 0 ? 1 : 0]!.position;
  return duplicates;
}
