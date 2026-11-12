import type { DraftEditorValue, DraftQuestion, FormQuestionReceives } from "./model";

// W3 (UC1-A): «Ubicación y contacto», which text question receives the location or the contact the person shares in the chat while
// the form is open. It lives on the question (`receives`), like a fixed validation: it travels with the draft, is sealed when
// publishing and goes with the question when it is removed or changes its type (another question for the server).

/** The rows of the zone, in the order the data arrive: the location, the contact's name and its phone. */
export const locationContactKinds: readonly FormQuestionReceives[] = ["location", "contactName", "contactPhone"];

const repeated = (question: DraftQuestion) => "repeated" in question && question.repeated === true;
/**
 * A short or a long text outside the block, without a condition (CO1-A, even one still being chosen) and without a fixed validation:
 * what a shared location or contact can fill. WhatsApp does not prefill a question that shows by a condition, so the form sent again
 * would fail, and the account or the CUIT of a library standard keeps its fixed validation; the server refuses both
 * (`Forms.Draft.ReceivesQuestionInvalid`).
 */
export const canReceive = (question: DraftQuestion) => (question.type === "shortText" || question.type === "longText") && !repeated(question) && !question.showWhen
  && !question.validation;
/** What the question receives, or null. */
export const receivesOf = (question: DraftQuestion): FormQuestionReceives | null => question.type === "shortText" || question.type === "longText" ? question.receives ?? null : null;
/**
 * How the zone and its review name a question: its text and its number, «Recibió (pregunta 2)», like the other lists of the editor,
 * or «Pregunta 6» while it has no text. The key of `forms` and its values.
 */
export const questionName = (label: string, number: string): { key: string; values: Readonly<Record<string, string>> } =>
  label.trim() ? { key: "locationContact.option", values: { label, number } } : { key: "locationContact.unnamed", values: { number } };

function withoutReceives(question: DraftQuestion): DraftQuestion {
  if (!("receives" in question)) return question;
  const { receives: _gone, ...rest } = question as DraftQuestion & { receives?: FormQuestionReceives };
  return rest as DraftQuestion;
}

/** The draft with the datum on this question (by its local identity), taken from the one that had it; null leaves it on none. */
export function assignReceives(value: DraftEditorValue, kind: FormQuestionReceives, localId: string | null): DraftEditorValue {
  return { ...value, draft: { ...value.draft, fields: value.draft.fields.map(question => question.localId === localId && canReceive(question)
    ? { ...question, receives: kind } as DraftQuestion : receivesOf(question) === kind ? withoutReceives(question) : question) } };
}

/**
 * Never a choice that no longer fits (W3): a question that went into the block or got a condition keeps nothing (taking the condition
 * away does not bring it back), and with a question «Ubicación» no text receives the location, since W1-A takes it there. On the screen
 * or hidden («Sólo en la app»), so saving never fails on what the zone may not show.
 */
export function withoutDanglingReceives(value: DraftEditorValue): DraftEditorValue {
  const located = value.draft.fields.some(question => question.type === "location");
  const dangling = (question: DraftQuestion) => "receives" in question && (!canReceive(question) || located && receivesOf(question) === "location");
  return value.draft.fields.some(dangling) ? { ...value, draft: { ...value.draft, fields: value.draft.fields.map(question => dangling(question) ? withoutReceives(question) : question) } } : value;
}

// In a review a question is named by its field identity or, while new, by its local one, as the rows of the review do.
const identity = (question: DraftQuestion) => question.fieldId ?? "new:" + question.localId;
/** Which question receives each datum, by its identity in a review; null without one. */
export type LocationContactAssignment = Readonly<Record<FormQuestionReceives, string | null>>;
export function locationContactAssignment(fields: readonly DraftQuestion[]): LocationContactAssignment {
  const owner = (kind: FormQuestionReceives) => { const question = fields.find(item => receivesOf(item) === kind); return question ? identity(question) : null; };
  return { location: owner("location"), contactName: owner("contactName"), contactPhone: owner("contactPhone") };
}

/** The questions kept by a review, each receiving what it received in the version chosen for the zone (`chosen`), or nothing. */
export function withLocationContactAssignment(fields: readonly DraftQuestion[], chosen: readonly DraftQuestion[]): readonly DraftQuestion[] {
  const kinds = new Map(chosen.flatMap(question => { const kind = receivesOf(question); return kind ? [[identity(question), kind] as const] : []; }));
  return fields.map(question => {
    const kind = kinds.get(identity(question)), bare = withoutReceives(question);
    return kind && canReceive(bare) ? { ...bare, receives: kind } as DraftQuestion : bare;
  });
}
