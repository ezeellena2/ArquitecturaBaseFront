import type { DraftQuestion, DraftSelectionSettings, FormSelectionSettings } from "./model";

type ChoiceQuestion = Extract<DraftQuestion, { type: "choice" | "multiChoice" }>;
export function validSelectionCounts(selection: DraftSelectionSettings): selection is FormSelectionSettings {
  return selection.minSelected !== null && selection.maxSelected !== null
    && Number.isInteger(selection.minSelected) && Number.isInteger(selection.maxSelected)
    && selection.minSelected >= 0 && selection.maxSelected >= 1 && selection.maxSelected <= 20
    && selection.minSelected <= selection.maxSelected;
}
// Only what the editor marks on the range controls: the own option count goes to the server, as for a single choice.
export function hasInvalidSelectionCounts(questions: readonly DraftQuestion[]): boolean {
  return questions.some(question => question.type === "multiChoice"
    && (!validSelectionCounts(question.selection) || !question.source && question.selection.minSelected > question.options.length));
}
export function changeQuestionMultiplicity(question: ChoiceQuestion, multiple: boolean,
  localId: string, nextChoiceLocalId: () => string): ChoiceQuestion {
  if ((question.type === "multiChoice") === multiple) return question;
  const confirmed = question.fieldId !== null;
  const common = {
    localId: confirmed ? localId : question.localId,
    fieldId: confirmed ? null : question.fieldId,
    replacesFieldId: question.fieldId ?? question.replacesFieldId,
    label: question.label, help: question.help, required: question.required,
  };
  const choice = question.source ? { source: { ...question.source } }
    : { options: question.options.map(option => confirmed
      ? { ...option, localId: nextChoiceLocalId(), choiceId: null } : option) };
  return multiple
    ? { ...common, ...choice, type: "multiChoice", selection: { minSelected: question.required ? 1 : 0, maxSelected: 3 } }
    : { ...common, ...choice, type: "choice" };
}
