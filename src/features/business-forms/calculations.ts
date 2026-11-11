import type { FormEntry, FormEntryQuestion } from "./api/entries";
import { questionIdentity } from "./dependentLists";
import { localizedValue } from "./editorModel";
import type { EntryDraft } from "./entryForm";
import type { DraftCalculation, DraftQuestion, FormCalculationOperation, FormCulture } from "./model";
import { questionNumbers } from "./rowsQuestions";

// CA1-A: «Cálculo» is a question of number the server computes, with one of three fixed operations over questions that go
// before it. Multiply and percent (base and rate) take two; a sum, from one to twenty.

export const maxSumOperands = 20;
type Question = DraftQuestion;
const repeated = (question: Question) => "repeated" in question && question.repeated === true;
const calculationOf = (question: Question) => question.type === "decimal" ? question.calculation ?? null : null;

/** Another operation keeps what was chosen: the first two places for multiply and percent, every chosen question for a sum. */
export function changeCalculationOperation(calculation: DraftCalculation, operation: FormCalculationOperation): DraftCalculation {
  if (operation === calculation.operation) return calculation;
  const chosen = calculation.operands.filter((operand): operand is string => operand !== null);
  return { operation, operands: operation === "sum" ? chosen : [chosen[0] ?? null, chosen[1] ?? null] };
}

/** A question a calculation can use: its number in the list and, in a sum, whether it adds a question of the block over all the items. */
export interface CalculationCandidate {
  readonly id: string;
  readonly number: string;
  readonly label: string;
  readonly allItems: boolean;
  /** The rate of a percentage may be a choice from a catalog with a numeric value: that option's value is the rate. */
  readonly rate?: true;
}

/**
 * The questions a calculation can use in one of its places, in order: earlier numbers (other calculations included) within its
 * reach. Multiply and percent take those of the same item when the calculation is in the block and those outside it otherwise,
 * and the rate of a percentage (its second place) may also be an earlier catalog choice; a sum goes outside the block and adds
 * numbers outside it or a question of the block over all the items. Earlier questions also rule out cycles.
 */
export function calculationCandidates(fields: readonly Question[], localId: string, operation: FormCalculationOperation, place: number,
  culture: FormCulture, original: FormCulture): CalculationCandidate[] {
  const index = fields.findIndex(question => question.localId === localId);
  if (index < 0) return [];
  const inBlock = repeated(fields[index]!);
  if (operation === "sum" && inBlock) return [];
  const numbers = questionNumbers(fields);
  return fields.slice(0, index).flatMap((question, position): CalculationCandidate[] => {
    const isNumber = question.type === "decimal";
    const isRate = operation === "percent" && place === 1 && question.type === "choice" && !!question.source;
    if (!isNumber && !isRate) return [];
    if (operation !== "sum" && repeated(question) !== inBlock) return [];
    return [{ id: questionIdentity(question), number: numbers[position]!, label: localizedValue(question.label, culture, original),
      allItems: operation === "sum" && repeated(question), ...isRate ? { rate: true as const } : {} }];
  });
}

/** Whether a calculation cannot be saved yet: a place without a question, a sum without one, or a question chosen twice. */
export function calculationIncomplete(question: Question): boolean {
  const calculation = calculationOf(question);
  if (!calculation) return false;
  const operands = calculation.operands;
  return operands.some(operand => operand === null) || operands.length === 0 || new Set(operands).size !== operands.length;
}

// Exact decimals, as the server's: a whole number scaled by 10^scale, so neither a product nor a sum passes through floating point.
interface Exact { readonly value: bigint; readonly scale: number }
const typedDecimal = /^([-+]?)(\d+)(?:[.,](\d+))?$/;
function parseExact(text: string): Exact | null {
  const match = typedDecimal.exec(text.trim());
  if (!match) return null;
  const fraction = match[3] ?? "";
  const value = BigInt(match[2]! + fraction);
  return { value: match[1] === "-" ? -value : value, scale: fraction.length };
}
const ten = (power: number) => 10n ** BigInt(power);
const rescale = (number: Exact, scale: number): bigint => number.value * ten(scale - number.scale);
// Rounded to two decimals with half-even (banker's) rounding, as the server's MidpointRounding.ToEven; fewer decimals stay as they are.
function roundTwo(number: Exact): Exact {
  if (number.scale <= 2) return number;
  const divisor = ten(number.scale - 2);
  const negative = number.value < 0n;
  const magnitude = negative ? -number.value : number.value;
  let quotient = magnitude / divisor;
  const remainder = magnitude % divisor;
  if (remainder * 2n > divisor || remainder * 2n === divisor && quotient % 2n === 1n) quotient += 1n;
  return { value: negative ? -quotient : quotient, scale: 2 };
}
// A product keeps the decimals of both numbers; dividing by one hundred keeps the scale of an exact division, the smallest that
// holds the result (as the server's decimal division does).
function multiply(first: Exact, second: Exact): Exact { return { value: first.value * second.value, scale: first.scale + second.scale }; }
function percentOf(base: Exact, rate: Exact): Exact {
  const product = multiply(base, rate);
  for (let extra = 0; ; extra++) {
    const scaled = product.value * ten(extra);
    if (scaled % 100n === 0n) return { value: scaled / 100n, scale: product.scale + extra };
  }
}
function add(numbers: readonly Exact[]): Exact | null {
  if (numbers.length === 0) return null;
  const scale = Math.max(...numbers.map(number => number.scale));
  return { value: numbers.reduce((total, number) => total + rescale(number, scale), 0n), scale };
}
/** The canonical text of an exact decimal: a dot, no grouping and never a negative zero. */
function exactText(number: Exact): string {
  const negative = number.value < 0n;
  const digits = (negative ? -number.value : number.value).toString().padStart(number.scale + 1, "0");
  const whole = digits.slice(0, digits.length - number.scale);
  const text = number.scale ? `${whole}.${digits.slice(digits.length - number.scale)}` : whole;
  return negative ? "-" + text : text;
}

function compute(operation: FormCalculationOperation, operands: readonly (Exact | null)[]): Exact | null {
  if (operation === "sum") return add(operands.filter((operand): operand is Exact => operand !== null));
  const [first, second] = operands;
  if (!first || !second) return null;
  return operation === "multiply" ? multiply(first, second) : percentOf(first, second);
}

/**
 * One operation over typed numbers ("12,5" or a canonical "12.5"; null or anything else is empty), as the server: a product or a
 * percentage with an empty operand is empty, a sum adds what there is, and the result is rounded to two decimals half-even.
 */
export function exactCalculation(operation: FormCalculationOperation, operands: readonly (string | null)[]): string | null {
  const result = compute(operation, operands.map(operand => operand === null ? null : parseExact(operand)));
  return result ? exactText(roundTwo(result)) : null;
}

/** What the preview shows: each calculation's canonical value outside the block and in each item (by its key); none while empty. */
export interface EntryCalculations {
  readonly values: Readonly<Record<string, string>>;
  readonly items: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/**
 * The calculations of a response while it is loaded, in the order of the form, as the server computes them on receiving it:
 * a hidden question counts as empty, a calculation uses earlier ones already rounded, a sum adds a question of the block over
 * all the items, and a rate chosen from a catalog has no value here (its option does not bring it), so that percentage stays
 * empty until it is sent.
 */
export function entryCalculations(entry: FormEntry, draft: EntryDraft, hidden: ReadonlySet<string>): EntryCalculations {
  const known = new Map<string, Exact[]>();
  const values: Record<string, string> = {};
  const items: Record<string, Record<string, string>> = {};
  const remember = (fieldId: string, number: Exact) => known.set(fieldId, [...known.get(fieldId) ?? [], number]);
  const calculate = (question: FormEntryQuestion, own: Map<string, Exact[]>) => {
    const calculation = question.calculation!;
    const operands = calculation.operation === "sum"
      ? calculation.operands.flatMap(operand => own.get(operand) ?? [])
      : calculation.operands.map(operand => own.get(operand)?.[0] ?? null);
    const result = compute(calculation.operation, operands);
    return result ? roundTwo(result) : null;
  };
  for (let index = 0; index < entry.questions.length; index++) {
    const question = entry.questions[index]!;
    if (question.repeated || hidden.has(question.fieldId)) continue;
    if (question.type === "group") {
      const block: FormEntryQuestion[] = [];
      for (let next = index + 1; next < entry.questions.length && entry.questions[next]!.repeated; next++) block.push(entry.questions[next]!);
      for (const item of draft.rows?.[question.fieldId] ?? []) {
        const own = new Map<string, Exact[]>();
        const results: Record<string, string> = {};
        for (const inner of block) {
          const number = inner.calculation ? calculate(inner, own) : inner.type === "decimal" ? parseExact(item.values[inner.fieldId] ?? "") : null;
          if (!number) continue;
          own.set(inner.fieldId, [number]);
          remember(inner.fieldId, number);
          if (inner.calculation) results[inner.fieldId] = exactText(number);
        }
        items[item.key] = results;
      }
      continue;
    }
    if (question.type !== "decimal") continue;
    const number = question.calculation ? calculate(question, known) : parseExact(draft.values[question.fieldId] ?? "");
    if (!number) continue;
    remember(question.fieldId, number);
    if (question.calculation) values[question.fieldId] = exactText(number);
  }
  return { values, items };
}

/** A question a calculation names, as it reads: its name and, in a sum outside the block, whether it adds it over all the items. */
export interface FormulaOperand { readonly label: string; readonly allItems: boolean }
/** The words of a formula, in the language of the screen. */
export interface FormulaWords {
  readonly multiply: (first: string, second: string) => string;
  readonly percent: (base: string, rate: string) => string;
  readonly sum: (questions: string) => string;
  readonly allItems: (label: string) => string;
  readonly list: (items: readonly string[]) => string;
  readonly missing: string;
}

/** How a calculation reads, for its (i) and its line in the editor: «Suma de Importe de todos los ítems», «Cantidad por Precio unitario». */
export function calculationFormula(operation: FormCalculationOperation, operands: readonly (FormulaOperand | null)[], words: FormulaWords): string {
  const name = (operand: FormulaOperand | null | undefined) => !operand ? words.missing : operand.allItems ? words.allItems(operand.label) : operand.label;
  if (operation === "sum") return words.sum(operands.length ? words.list(operands.map(name)) : words.missing);
  return operation === "multiply" ? words.multiply(name(operands[0]), name(operands[1])) : words.percent(name(operands[0]), name(operands[1]));
}

/** The questions a calculation of the draft names, in the menu language; one that is not in the draft, or not chosen yet, is null. */
export function draftFormulaOperands(fields: readonly Question[], question: Question, culture: FormCulture, original: FormCulture): (FormulaOperand | null)[] {
  const calculation = calculationOf(question);
  if (!calculation) return [];
  const inBlock = repeated(question);
  return calculation.operands.map(operand => {
    const named = operand === null ? undefined : fields.find(field => questionIdentity(field) === operand);
    return named ? { label: localizedValue(named.label, culture, original), allItems: calculation.operation === "sum" && !inBlock && repeated(named) } : null;
  });
}

/**
 * The questions a calculation of the form being loaded names, and whether the rate of its percentage comes from a catalog: its
 * option does not bring the value here, so the preview stays empty until it is sent.
 */
export function entryFormulaOperands(entry: Pick<FormEntry, "questions">, question: FormEntryQuestion): { operands: (FormulaOperand | null)[]; catalogRate: boolean } {
  const calculation = question.calculation;
  if (!calculation) return { operands: [], catalogRate: false };
  const named = calculation.operands.map(operand => entry.questions.find(item => item.fieldId === operand));
  return {
    operands: named.map(item => item ? { label: item.label, allItems: calculation.operation === "sum" && !question.repeated && !!item.repeated } : null),
    catalogRate: calculation.operation === "percent" && named[1]?.type === "choice",
  };
}
