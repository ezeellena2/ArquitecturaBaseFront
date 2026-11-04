import type { DraftQuestionSource, FormCatalogMatch, FormQuestionSource } from "./model";

export function copyCatalogQuestionSource(source: FormQuestionSource): FormQuestionSource;
export function copyCatalogQuestionSource(source: DraftQuestionSource): DraftQuestionSource;
export function copyCatalogQuestionSource(source: DraftQuestionSource): DraftQuestionSource {
  return {
    catalog: source.catalog,
    ...(source.match !== undefined ? { match: source.match?.map(match => ({ ...match })) ?? null } : {}),
    ...(source.presentation !== undefined ? {
      presentation: source.presentation ? { title: [...source.presentation.title], description: [...source.presentation.description] } : null,
    } : {}),
  };
}

export function normalizeCatalogQuestionSource(source: FormQuestionSource): FormQuestionSource;
export function normalizeCatalogQuestionSource(source: DraftQuestionSource): DraftQuestionSource;
export function normalizeCatalogQuestionSource(source: DraftQuestionSource): DraftQuestionSource {
  const copied = copyCatalogQuestionSource(source);
  return {
    catalog: copied.catalog,
    ...(copied.match?.length ? { match: [...copied.match].sort((left, right) => left.fieldId < right.fieldId ? -1 : left.fieldId > right.fieldId ? 1 : 0) } : {}),
    ...(copied.presentation ? { presentation: copied.presentation } : {}),
  };
}

export function sameCatalogQuestionSource(left: DraftQuestionSource | null | undefined, right: DraftQuestionSource | null | undefined): boolean {
  if (!left || !right) return !left && !right;
  const a = normalizeCatalogQuestionSource(left), b = normalizeCatalogQuestionSource(right);
  if (a.catalog !== b.catalog) return false;
  const aMatches = a.match ?? [], bMatches = b.match ?? [];
  if (aMatches.length !== bMatches.length || aMatches.some((match, index) => {
    const other = bMatches[index]!;
    return match.fieldId !== other.fieldId || matchKind(match) !== matchKind(other) || matchTarget(match) !== matchTarget(other);
  })) return false;
  if (!a.presentation || !b.presentation) return !a.presentation && !b.presentation;
  return sameParts(a.presentation.title, b.presentation.title) && sameParts(a.presentation.description, b.presentation.description);
}

/** A filter is fixed, by who receives it or by another answer (CW7). */
export function matchKind(match: FormCatalogMatch<string | null>): "fixed" | "person" | "answer" {
  return "value" in match ? "fixed" : "personAttributeId" in match ? "person" : "answer";
}
const matchTarget = (match: FormCatalogMatch<string | null>) => match.value ?? match.personAttributeId ?? match.questionId ?? null;

function sameParts(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
