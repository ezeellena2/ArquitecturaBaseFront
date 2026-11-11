import { formatDateOnly } from "@/shared/lib/dateTime";
import { formatExactDecimal } from "@/shared/lib/decimal";
import { localizedValue } from "./editorModel";
import type { FormCulture, LocalizedText } from "./model";
import type { RuleEvent } from "./rules";

// A message carries text and data (board MD1-A): the response number, the reason of a rejection or the answer to a question.
// A question is saved by its identity, so it follows a renamed label and serves both languages; the server reads earlier
// revisions, saved with the label, already as identities.
// A datum of a result (RE1-A) is written `{result:<source>.<key>}`; it arrives only after the action that brings it.
export type RuleMessageData = { readonly kind: "number" } | { readonly kind: "reason" } | { readonly kind: "question"; readonly fieldId: string }
  | { readonly kind: "result"; readonly source: string; readonly key: string };
export type RuleMessagePart = { readonly kind: "text"; readonly text: string } | RuleMessageData;
/** A question as the rule options bring it. */
export interface RuleMessageQuestion {
  readonly fieldId: string;
  readonly type: string;
  readonly label: LocalizedText;
  readonly options?: readonly { readonly label: LocalizedText }[] | null;
  readonly selection?: { readonly minSelected: number };
  /** A question of the block of rows (RG5-A): the block is the datum, and brings it item by item. */
  readonly repeated?: boolean;
}
/** A datum an earlier action of the rule brings, such as the number of the voucher an issuer authorizes. */
export interface RuleMessageResult { readonly source: string; readonly sourceName: LocalizedText; readonly key: string; readonly label: LocalizedText; readonly kind: string }
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
      : identity.test(token) ? { kind: "question", fieldId: token.toLowerCase() } : resultOf(token);
    if (!data) { text += piece; continue; }
    if (text) parts.push({ kind: "text", text });
    text = "";
    parts.push(data);
  }
  if (text) parts.push({ kind: "text", text });
  return parts;
}

function resultOf(token: string): RuleMessageData | null {
  if (!token.startsWith("result:")) return null;
  const name = token.slice("result:".length), dot = name.lastIndexOf(".");
  return dot > 0 && dot < name.length - 1 ? { kind: "result", source: name.slice(0, dot), key: name.slice(dot + 1) } : null;
}

/** The message to save: the number and the reason with the words of its language, a question by its identity. */
export const serializeRuleMessage = (parts: readonly RuleMessagePart[], culture: FormCulture) => parts.map(part =>
  part.kind === "text" ? part.text : part.kind === "question" ? "{" + part.fieldId + "}" : part.kind === "result" ? "{result:" + part.source + "." + part.key + "}"
    : "{" + (part.kind === "number" ? (culture === "es" ? "número" : "number") : (culture === "es" ? "motivo" : "reason")) + "}").join("");

const sameResult = (data: RuleMessageData, result: RuleMessageResult) => data.kind === "result" && data.source === result.source && data.key === result.key;

/** What «Agregar dato» offers: the number, the reason only when rejecting and the questions in the form's order. Photos and
 * documents are left out: a message would only bring the file name. The block of rows is a datum and its questions are not. */
export const ruleMessageData = (questions: readonly RuleMessageQuestion[], event: RuleEvent, results: readonly RuleMessageResult[] = []): RuleMessageData[] => [
  { kind: "number" }, ...(event === "Rejected" ? [{ kind: "reason" } as const] : []),
  ...results.map(result => ({ kind: "result", source: result.source, key: result.key } as const)),
  ...questions.filter(question => question.type !== "photo" && question.type !== "document" && !question.repeated)
    .map(question => ({ kind: "question", fieldId: question.fieldId } as const)),
];

/** The name of a datum, or null for a question that is no longer among the options or a result no earlier action brings. */
export function ruleMessageDataLabel(data: RuleMessageData, questions: readonly RuleMessageQuestion[], culture: FormCulture, original: FormCulture, t: Translate,
  results: readonly RuleMessageResult[] = []) {
  if (data.kind === "result") { const result = results.find(item => sameResult(data, item)); return result ? localizedValue(result.label, culture, original) : null; }
  if (data.kind !== "question") return t("rules.data." + data.kind);
  const question = questions.find(item => item.fieldId === data.fieldId);
  return question ? localizedValue(question.label, culture, original) : null;
}

/** The message with the names of its data, as plain text: the original shown while translating. */
export const ruleMessageText = (template: string, questions: readonly RuleMessageQuestion[], culture: FormCulture, original: FormCulture, t: Translate,
  results: readonly RuleMessageResult[] = []) =>
  parseRuleMessage(template).map(part => part.kind === "text" ? part.text
    : ruleMessageDataLabel(part, questions, culture, original, t, results) ?? t(part.kind === "result" ? "rules.missingResult" : "rules.missingQuestion")).join("");

export const hasMissingRuleData = (template: string, questions: readonly { readonly fieldId: string }[]) =>
  parseRuleMessage(template).some(part => part.kind === "question" && !questions.some(question => question.fieldId === part.fieldId));

/** A result datum that no earlier action of the rule brings: it would arrive empty, and the server refuses it. */
export const hasUnavailableResults = (template: string, results: readonly RuleMessageResult[]) =>
  parseRuleMessage(template).some(part => part.kind === "result" && !results.some(result => sameResult(part, result)));

/**
 * The message as it arrives, with the examples of the PDF preview (FormPdfPreviewIssuer): the data are the samples. The block
 * of rows arrives as the notice brings it (RG5-A): an example item, «1. GLIFOSATO 64% · 12.500,5 · Sí», on a new line unless
 * the message starts there or a line break comes before.
 */
export function ruleMessagePreview(template: string, questions: readonly RuleMessageQuestion[], choices: Choices, culture: FormCulture, original: FormCulture, prefix: string, t: Translate,
  results: readonly RuleMessageResult[] = []): RuleMessageSegment[] {
  const segments: RuleMessageSegment[] = [];
  for (const part of parseRuleMessage(template)) {
    if (part.kind === "result") {
      const result = results.find(item => sameResult(part, item));
      segments.push(result ? { text: resultExample(result.kind, culture, t), sample: true } : { text: t("rules.missingResult"), missing: true });
      continue;
    }
    const question = part.kind === "question" ? questions.find(item => item.fieldId === part.fieldId) : undefined;
    if (question?.type === "group") {
      const before = segments.map(segment => segment.text).join("");
      if (before && !before.endsWith("\n")) segments.push({ text: "\n" });
      const answers = blockQuestions(question, questions).map(item => example(item, choices, culture, original, t)).join(" · ");
      segments.push({ text: answers ? "1. " + answers : "1.", sample: true });
      continue;
    }
    segments.push(part.kind === "text" ? { text: part.text } : part.kind === "number" ? { text: prefix + "-000001", sample: true }
      : part.kind === "reason" ? { text: t("rules.samples.reason"), sample: true }
      : question ? { text: example(question, choices, culture, original, t), sample: true } : { text: t("rules.missingQuestion"), missing: true });
  }
  return segments;
}
/** The questions of a block, in order: each one goes with the last block before it, as the rule options bring them. */
function blockQuestions(block: RuleMessageQuestion, questions: readonly RuleMessageQuestion[]) {
  let current: string | null = null;
  return questions.filter(question => {
    if (question.type === "group") current = question.fieldId;
    return question.repeated === true && current === block.fieldId;
  });
}
function resultExample(kind: string, culture: FormCulture, t: Translate) {
  if (kind === "number") return formatExactDecimal("12500.5", culture) ?? "12500.5";
  if (kind === "date") return formatDateOnly("2026-10-16", culture) ?? "2026-10-16";
  return t("rules.samples.result");
}
function example(question: RuleMessageQuestion, choices: Choices, culture: FormCulture, original: FormCulture, t: Translate) {
  const labels = question.options?.map(option => localizedValue(option.label, culture, original)) ?? choices[question.fieldId]?.map(choice => choice.label) ?? [];
  switch (question.type) {
    case "decimal": return formatExactDecimal("12500.5", culture) ?? "12500.5";
    case "date": return formatDateOnly("2026-10-16", culture) ?? "2026-10-16";
    case "boolean": return t("yes");
    case "choice": return labels[0] ?? t("rules.samples.answer");
    case "multiChoice": return labels.length ? labels.slice(0, Math.max(1, question.selection?.minSelected ?? 0)).join(", ") : t("rules.samples.answer");
    default: return t("rules.samples.answer");
  }
}
