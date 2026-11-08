import { localizedValue } from "./editorModel";
import type { FormCulture, LocalizedText } from "./model";
import { normalizeResponseQuery, type ResponseColumn, type ResponseCondition, type ResponseType } from "./responses";
import { hasMissingRuleData } from "./ruleMessage";
export const ruleEvents = ["Received", "Approved", "Rejected"] as const;
export const ruleActionKinds = ["RequestApproval", "GeneratePdf", "NotifyAuthor", "NotifyRole"] as const;
export type RuleEvent = typeof ruleEvents[number];
export type RuleActionKind = typeof ruleActionKinds[number];
export interface RuleAction { readonly id: string; readonly kind: RuleActionKind; readonly roleId: string | null; readonly text: LocalizedText | null; readonly includePdf: boolean }
export interface FormRule { readonly id: string; readonly event: RuleEvent; readonly conditions: readonly ResponseCondition[]; readonly actions: readonly RuleAction[] }
export interface RuleIssue { readonly path: string; readonly key: string }
export type PdfAttachmentIssue = { readonly key: "pdfBeforeAttachment"; readonly fix: "move" | "add" } | { readonly key: "pdfOnApproval"; readonly fix: null };
export const usesMessage = (kind: RuleActionKind) => kind === "NotifyAuthor" || kind === "NotifyRole";
export const usesRole = (kind: RuleActionKind) => kind === "RequestApproval" || kind === "NotifyRole";
export const newRule = (): FormRule => ({ id: crypto.randomUUID(), event: "Received", conditions: [], actions: [] });
export const newRuleAction = (kind: RuleActionKind): RuleAction => ({ id: crypto.randomUUID(), kind, roleId: null, text: usesMessage(kind) ? { es: "", en: "" } : null, includePdf: false });
// Changing the kind keeps what was written: the message, the role and the attachment come back with a kind that uses them.
export const withRuleActionKind = (action: RuleAction, kind: RuleActionKind): RuleAction => ({ ...action, kind, text: action.text ?? (usesMessage(kind) ? { es: "", en: "" } : null) });
// Why a message cannot attach the PDF and which order fixes it (board RP1-A): the choice is never cleared for the user.
export function pdfAttachmentIssue(rule: FormRule, index: number): PdfAttachmentIssue | null {
  const action = rule.actions[index];
  if (action?.kind !== "NotifyAuthor" || !action.includePdf) return null;
  if (rule.event !== "Approved") return { key: "pdfOnApproval", fix: null };
  if (rule.actions.slice(0, index).some(previous => previous.kind === "GeneratePdf")) return null;
  return { key: "pdfBeforeAttachment", fix: rule.actions.slice(index + 1).some(next => next.kind === "GeneratePdf") ? "move" : "add" };
}
/** Puts the first later PDF just before the message or, without one, a new one there. */
export function fixPdfAttachment(rule: FormRule, index: number): FormRule {
  const later = rule.actions.findIndex((action, position) => position > index && action.kind === "GeneratePdf");
  const others = rule.actions.filter((_, position) => position !== later);
  return { ...rule, actions: [...others.slice(0, index), later >= 0 ? rule.actions[later] : newRuleAction("GeneratePdf"), ...others.slice(index)] };
}
/** What the options of rules and suggestions tell of a question: enough to name it in a condition. */
export interface ConditionQuestion {
  readonly fieldId: string;
  readonly type: ResponseType;
  readonly label: Readonly<Record<string, string>>;
  readonly options?: readonly { readonly choiceId: string; readonly label: Readonly<Record<string, string>> }[] | null;
  readonly repeated?: boolean;
}
/**
 * The columns of the conditions of rules and suggestions (RG5-A): a loose question is a column, and the block a `group` column
 * with its questions, as in the sheet. A question of the block goes with the last block before it, also one retired at the end.
 */
export function conditionColumns(questions: readonly ConditionQuestion[], choices: Readonly<Record<string, readonly { id: string; label: string }[]>>,
  culture: FormCulture, original: FormCulture): ResponseColumn[] {
  const columns: ResponseColumn[] = [];
  for (const question of questions) {
    const column: ResponseColumn = { fieldId: question.fieldId, type: question.type, label: localizedValue(question.label, culture, original), introducedInVersion: 1,
      options: [...choices[question.fieldId] ?? (question.type === "choice" || question.type === "multiChoice" ? question.options ?? [] : [])
        .map(option => ({ id: option.choiceId, label: localizedValue(option.label, culture, original) }))] };
    const block = question.repeated ? columns.findLast(item => item.type === "group") : undefined;
    if (block) block.questions = [...block.questions ?? [], column];
    else columns.push(question.type === "group" ? { ...column, options: [], questions: [] } : column);
  }
  return columns;
}
export function prepareRules(rules: readonly FormRule[], original: FormCulture, columns: readonly ResponseColumn[]) {
  const issues: RuleIssue[] = [];
  const prepared = rules.map((rule, index): FormRule => {
    const path = "rules." + index;
    const normalized = normalizeResponseQuery({ page: 1, pageSize: 1, conditions: rule.conditions }, columns);
    if (!normalized || rule.conditions.some(condition => !["answered", "unanswered", "notAsked"].includes(condition.operator) && !condition.values?.some(value => value.trim()))) issues.push({ path: path + ".conditions", key: "invalidConditions" });
    if (!rule.actions.length) issues.push({ path: path + ".actions", key: "required" });
    const actions = rule.actions.map((action, actionIndex): RuleAction => {
      const actionPath = path + ".actions." + actionIndex;
      if (action.kind === "RequestApproval" && actionIndex !== rule.actions.length - 1) issues.push({ path: actionPath, key: "approvalLast" });
      if (action.kind === "RequestApproval" && rule.event !== "Received") issues.push({ path: actionPath, key: "approvalOnReceived" });
      if (action.kind === "GeneratePdf" && rule.event !== "Approved") issues.push({ path: actionPath, key: "pdfAfterApproval" });
      const role = usesRole(action.kind);
      if (role && !action.roleId) issues.push({ path: actionPath + ".roleId", key: "required" });
      const attachment = pdfAttachmentIssue(rule, actionIndex);
      if (attachment) issues.push({ path: actionPath + ".includePdf", key: attachment.key });
      // What another kind left behind stays in the editor and is not saved: the attachment only goes with its message.
      const attached = action.kind === "NotifyAuthor" && action.includePdf;
      const message = usesMessage(action.kind);
      const text = message ? Object.fromEntries(Object.entries(action.text ?? {}).map(([culture, value]) => [culture, value.trim()])) : null;
      if (message && !text?.[original]) issues.push({ path: actionPath + ".text." + original, key: "required" });
      for (const [culture, value] of Object.entries(text ?? {})) if (value.length > (attached ? 1024 : 4096)) issues.push({ path: actionPath + ".text." + culture, key: "tooLong" });
      // A datum whose question left the form would arrive empty: it is told under the message before saving (board MD1-A).
      for (const [culture, value] of Object.entries(text ?? {})) if (hasMissingRuleData(value, columns)) issues.push({ path: actionPath + ".text." + culture, key: "missingData" });
      return { ...action, roleId: role ? action.roleId : null, text, includePdf: attached };
    });
    return { ...rule, conditions: normalized?.conditions ?? rule.conditions, actions };
  });
  return { rules: prepared, issues };
}

// A message error of either language is bound to its rule: the one not on screen is shown under the same field.
export function ruleFieldErrors(source: Readonly<Record<string, readonly string[]>>, rules: readonly FormRule[]) {
  const errors: Record<string, string[]> = {};
  for (const [key, messages] of Object.entries(source)) {
    const path = /^rules(?:\[|\.)/.test(key) ? key.replace(/\[(\d+)\]/g, ".$1") : key;
    errors[path] = [...(errors[path] ?? []), ...messages];
  }
  const fields = rules.flatMap((rule, index) => ["rules." + index + ".conditions", "rules." + index + ".actions", ...rule.actions.flatMap((action, position) => {
    const path = "rules." + index + ".actions." + position;
    return [path, ...(usesRole(action.kind) ? [path + ".roleId"] : []), ...(usesMessage(action.kind) ? [path + ".text.es", path + ".text.en"] : []), ...(action.kind === "NotifyAuthor" ? [path + ".includePdf"] : [])];
  })]);
  const first = Object.keys(errors).find(path => errors[path].length > 0 && fields.includes(path));
  const index = first ? /^rules\.(\d+)\./.exec(first)?.[1] : undefined;
  return { errors, fields, firstRuleId: index === undefined ? null : rules[Number(index)]?.id ?? null };
}
