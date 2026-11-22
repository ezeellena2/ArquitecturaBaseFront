import { useTranslation } from "react-i18next";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { Picker } from "@/shared/ui/Picker";
import { calculationCandidates, calculationFormula, changeCalculationOperation, draftFormulaOperands, maxSumOperands, type CalculationCandidate } from "../calculations";
import { useCalculationWords } from "../hooks/useCalculationWords";
import type { DraftCalculation, DraftQuestion, FormCalculationOperation, FormCulture } from "../model";
import { QuestionChips } from "./QuestionChips";

const operations: readonly FormCalculationOperation[] = ["multiply", "sum", "percent"];
const repeated = (question: DraftQuestion) => "repeated" in question && question.repeated === true;

/** How a calculation of the draft reads, for its line in the list: «Suma de Importe de todos los ítems». */
export function CalculationFormula({ question, questions, culture, original }: { question: DraftQuestion; questions: readonly DraftQuestion[]; culture: FormCulture; original: FormCulture }) {
  const words = useCalculationWords("forms");
  if (question.type !== "decimal" || !question.calculation) return null;
  return <>{calculationFormula(question.calculation.operation, draftFormulaOperands(questions, question, culture, original), words)}</>;
}

/**
 * «Qué calcula» of a calculation (CA1-A): Multiplicar, Sumar or Porcentaje, in the only piece to choose (DS1-A, 2026-11-22),
 * and the questions it uses, earlier numbers within its reach. Multiply and percent (base and rate) choose two in their lists;
 * a sum, chips with «+ Agregar», also a question of the block over all the items. A sum goes outside the block. Bound by the
 * library standard (BI1-A), every control is off with its reason on itself.
 */
export function CalculationSettings({ question, questions, culture, original, readOnly, lockedReason, error, onChange }: {
  question: DraftQuestion; questions: readonly DraftQuestion[]; culture: FormCulture; original: FormCulture; readOnly: boolean;
  lockedReason?: string | null; error?: string; onChange: (question: DraftQuestion) => void;
}) {
  const { t } = useTranslation("forms");
  if (question.type !== "decimal" || !question.calculation) return null;
  const calculation = question.calculation;
  const inBlock = repeated(question);
  const change = (next: DraftCalculation) => onChange({ ...question, calculation: next });
  const candidates = (place: number) => calculationCandidates(questions, question.localId, calculation.operation, place, culture, original);
  const name = (candidate: CalculationCandidate) => calculation.operation === "sum"
    ? candidate.allItems ? t("calculation.allItems", { label: candidate.label }) : candidate.label
    : t("calculation.operand", { label: candidate.label, number: candidate.number });
  // A question that is no longer in the draft, or out of reach, still shows as chosen: publishing says what to fix.
  const nameOf = (id: string, place: number) => { const found = candidates(place).find(candidate => candidate.id === id); return found ? name(found) : t("calculation.unavailable"); };
  const operand = (place: number, label: string) => {
    const value = calculation.operands[place] ?? null;
    const list = candidates(place);
    return <div data-engine-unset={value === null ? "" : undefined}><FormField label={label}><DisabledReason reason={lockedReason}><Picker label={label} disabled={readOnly || !!lockedReason} value={value}
      placeholder={t("calculation.choose")} onChange={id => change({ ...calculation, operands: calculation.operands.map((current, index) => index === place ? id : current) })}
      options={[...value !== null && !list.some(candidate => candidate.id === value) ? [{ id: value, label: t("calculation.unavailable") }] : [], ...list.map(candidate => ({ id: candidate.id, label: name(candidate) }))]} />
    </DisabledReason></FormField></div>;
  };
  const sumCandidates = calculation.operation === "sum" ? candidates(0) : [];
  const chosen = calculation.operands.filter((item): item is string => item !== null);
  const left = sumCandidates.filter(candidate => !chosen.includes(candidate.id));
  return <div data-question-control="calculation" className="flex flex-col gap-3">
    {/* As wide as the first of the two lists under it; choosing the one it has changes nothing. */}
    <div className="grid gap-4 sm:grid-cols-2"><FormField label={t("calculation.operation")} help={t("calculation.help")}>
      <DisabledReason reason={lockedReason} className="grid w-full"><Picker label={t("calculation.operation")} disabled={readOnly || !!lockedReason} value={calculation.operation}
        onChange={operation => { if (operation !== calculation.operation) change(changeCalculationOperation(calculation, operation as FormCalculationOperation)); }}
        options={operations.map(operation => ({ id: operation, label: t("calculation.operations." + operation),
          disabledReason: operation === "sum" && inBlock && calculation.operation !== "sum" ? t("calculation.sumInBlock") : null }))} /></DisabledReason>
    </FormField></div>
    {calculation.operation === "sum"
      ? <QuestionChips label={t("calculation.sumOf")} chips={chosen.map(id => ({ id, label: nameOf(id, 0) }))} options={left.map(candidate => ({ id: candidate.id, label: name(candidate) }))}
        addLabel={t("calculation.add")} removeLabel={label => t("calculation.remove", { label })} readOnly={readOnly} lockedReason={lockedReason}
        addReason={chosen.length >= maxSumOperands ? t("calculation.sumFull", { count: maxSumOperands }) : left.length === 0 ? t(sumCandidates.length ? "calculation.allAdded" : "calculation.noNumbers") : null}
        onAdd={id => change({ ...calculation, operands: [...chosen, id] })} onRemove={id => change({ ...calculation, operands: chosen.filter(item => item !== id) })} />
      : <div className="grid gap-4 sm:grid-cols-2">
        {operand(0, t(calculation.operation === "multiply" ? "calculation.multiplyFirst" : "calculation.percentBase"))}
        {operand(1, t(calculation.operation === "multiply" ? "calculation.multiplySecond" : "calculation.percentRate"))}
      </div>}
    {error ? <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
  </div>;
}
