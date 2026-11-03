import { formatDateOnly } from "@/shared/lib/dateTime";
import { formatExactDecimal } from "@/shared/lib/decimal";
import { localizedValue } from "./editorModel";
import type { FormCulture, LocalizedText } from "./model";
import type { RuleEvent } from "./rules";

// A message carries text and data (board MD1-A): the response number, the reason of a rejection or the answer to a question.
// A question is saved by its identity, so it follows a renamed label and serves both languages; the server reads earlier
// revisions, saved with the label, already as identities.
export type RuleMessageData = { readonly kind: "number" } | { readonly kind: "reason" } | { readonly kind: "question"; readonly fieldId: string };
export type RuleMessagePart = { readonly kind: "text"; readonly text: string } | RuleMessageData;
/** A question as the rule options bring it. */
export interface RuleMessageQuestion {
  readonly fieldId: string;
  readonly type: string;
  readonly label: LocalizedText;
  readonly options?: readonly { readonly label: LocalizedText }[] | null;
  readonly selection?: { readonly minSelected: number };
}
export interface RuleMessageSegment { readonly text: string; readonly sample?: boolean; readonly missing?: boolean }
type Translate = (key: string, options?: Record<string, unknown>) => string;
type Choices = Readonly<Record<string, readonly { readonly label: string }[]>>;

const words: Readonly<Record<string, "number" | "reason">> = { "número": "number", number: "number", motivo: "reason", reason: "reason" };
const identity = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The text and the data of a message; anything else between braces stays text. */
export function parseRuleMessage(template: string): RuleMessagePart[] {
  const parts: RuleMessagePart[] = [];
  let text = "";
  for (const piece of template.split(/(\{[^{}]*\})/)) {
    const token = /^\{([^{}]*)\}$/.exec(piece)?.[1];
    const data: RuleMessageData | null = token === undefined ? null : words[token] ? { kind: words[token] }
      : identity.test(token) ? { kind: "question", fieldId: token.toLowerCase() } : null;
    if (!data) { text += piece; continue; }
    if (text) parts.push({ kind: "text", text });
    text = "";
    parts.push(data);
  }
  if (text) parts.push({ kind: "text", text });
  return parts;
}

/** The message to save: the number and the reason with the words of its language, a question by its identity. */
export const serializeRuleMessage = (parts: readonly RuleMessagePart[], culture: FormCulture) => parts.map(part =>
  part.kind === "text" ? part.text : part.kind === "question" ? "{" + part.fieldId + "}"
    : "{" + (part.kind === "number" ? (culture === "es" ? "número" : "number") : (culture === "es" ? "motivo" : "reason")) + "}").join("");

/** What «Agregar dato» offers: the number, the reason only when rejecting and the questions in the form's order. Photos and
 * documents are left out: a message would only bring the file name. */
export const ruleMessageData = (questions: readonly RuleMessageQuestion[], event: RuleEvent): RuleMessageData[] => [
  { kind: "number" }, ...(event === "Rejected" ? [{ kind: "reason" } as const] : []),
  ...questions.filter(question => question.type !== "photo" && question.type !== "document").map(question => ({ kind: "question", fieldId: question.fieldId } as const)),
];

/** The name of a datum, or null for a question that is no longer among the options. */
export function ruleMessageDataLabel(data: RuleMessageData, questions: readonly RuleMessageQuestion[], culture: FormCulture, original: FormCulture, t: Translate) {
  if (data.kind !== "question") return t("rules.data." + data.kind);
  const question = questions.find(item => item.fieldId === data.fieldId);
  return question ? localizedValue(question.label, culture, original) : null;
}

/** The message with the names of its data, as plain text: the original shown while translating. */
export const ruleMessageText = (template: string, questions: readonly RuleMessageQuestion[], culture: FormCulture, original: FormCulture, t: Translate) =>
  parseRuleMessage(template).map(part => part.kind === "text" ? part.text : ruleMessageDataLabel(part, questions, culture, original, t) ?? t("rules.missingQuestion")).join("");

export const hasMissingRuleData = (template: string, questions: readonly { readonly fieldId: string }[]) =>
  parseRuleMessage(template).some(part => part.kind === "question" && !questions.some(question => question.fieldId === part.fieldId));

/** The message as it arrives, with the examples of the PDF preview (FormPdfPreviewIssuer): the data are the samples. */
export function ruleMessagePreview(template: string, questions: readonly RuleMessageQuestion[], choices: Choices, culture: FormCulture, original: FormCulture, prefix: string, t: Translate): RuleMessageSegment[] {
  return parseRuleMessage(template).map(part => {
    if (part.kind === "text") return { text: part.text };
    if (part.kind === "number") return { text: prefix + "-000001", sample: true };
    if (part.kind === "reason") return { text: t("rules.samples.reason"), sample: true };
    const question = questions.find(item => item.fieldId === part.fieldId);
    return question ? { text: example(question, choices, culture, original, t), sample: true } : { text: t("rules.missingQuestion"), missing: true };
  });
}
function example(question: RuleMessageQuestion, choices: Choices, culture: FormCulture, original: FormCulture, t: Translate) {
  const labels = question.options?.map(option => localizedValue(option.label, culture, original)) ?? choices[question.fieldId]?.map(choice => choice.label) ?? [];
  switch (question.type) {
    case "decimal": return formatExactDecimal("12500.5", culture) ?? "12500.5";
    case "date": return formatDateOnly("2026-10-16", culture, "numeric") ?? "2026-10-16";
    case "boolean": return t("yes");
    case "choice": return labels[0] ?? t("rules.samples.answer");
    case "multiChoice": return labels.length ? labels.slice(0, Math.max(1, question.selection?.minSelected ?? 0)).join(", ") : t("rules.samples.answer");
    default: return t("rules.samples.answer");
  }
}
