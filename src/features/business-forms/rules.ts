import { localizedValue } from "./editorModel";
import type { FormCulture, LocalizedText } from "./model";
import { normalizeResponseQuery, responseQuestionColumns, type ResponseColumn, type ResponseCondition, type ResponseType } from "./responses";
import { hasMissingRuleData, hasUnavailableResults, type RuleMessageResult } from "./ruleMessage";
export const ruleEvents = ["Received", "Approved", "Rejected"] as const;
// «SendCopy» (copy by email) sends the document of an earlier «IssueDocument» of its rule to whoever received it, with its message.
export const ruleActionKinds = ["RequestApproval", "GeneratePdf", "NotifyAuthor", "NotifyRole", "IssueDocument", "SendCopy"] as const;
export type RuleEvent = typeof ruleEvents[number];
export type RuleActionKind = typeof ruleActionKinds[number];
/**
 * `issuerId`: the installed issuer of an «IssueDocument» action; the other kinds do not carry it. `authorMayDecide` («Puede decidir quien
 * cargó») and `reasonOptional` («Exigir motivo al rechazar» unchecked) belong to «RequestApproval» (RC4-A): the server sends them only when
 * true, and they are saved only with that kind.
 */
export interface RuleAction { readonly id: string; readonly kind: RuleActionKind; readonly roleId: string | null; readonly text: LocalizedText | null; readonly includePdf: boolean; readonly issuerId?: string | null;
  readonly authorMayDecide?: boolean; readonly reasonOptional?: boolean }
/** An issuer the rule options offer (only on a form copied from its standard): its name and the data its result brings. */
export interface RuleIssuer { readonly id: string; readonly name: LocalizedText; readonly resultFields: readonly { readonly key: string; readonly label: LocalizedText; readonly kind: string }[] }
export interface FormRule { readonly id: string; readonly event: RuleEvent; readonly conditions: readonly ResponseCondition[]; readonly actions: readonly RuleAction[] }
export interface RuleIssue { readonly path: string; readonly key: string }
export type PdfAttachmentIssue = { readonly key: "pdfBeforeAttachment"; readonly fix: "move" | "add" } | { readonly key: "pdfOnApproval"; readonly fix: null };
export const usesMessage = (kind: RuleActionKind) => kind === "NotifyAuthor" || kind === "NotifyRole" || kind === "SendCopy";
export const usesRole = (kind: RuleActionKind) => kind === "RequestApproval" || kind === "NotifyRole";
export const newRule = (): FormRule => ({ id: crypto.randomUUID(), event: "Received", conditions: [], actions: [] });
export const newRuleAction = (kind: RuleActionKind, issuerId: string | null = null): RuleAction => ({ id: crypto.randomUUID(), kind, roleId: null,
  text: usesMessage(kind) ? { es: "", en: "" } : null, includePdf: false, ...kind === "IssueDocument" ? { issuerId } : {} });
// Changing the kind keeps what was written: the message, the role and the attachment come back with a kind that uses them. The
// issuer goes only with «IssueDocument».
export const withRuleActionKind = (action: RuleAction, kind: RuleActionKind, issuerId: string | null = null): RuleAction => {
  const { issuerId: previous, ...rest } = action;
  return { ...rest, kind, text: action.text ?? (usesMessage(kind) ? { es: "", en: "" } : null), ...kind === "IssueDocument" ? { issuerId: issuerId ?? previous ?? null } : {} };
};
/** The result data a message may use (RE1-A): those of the «IssueDocument» actions before it in its rule. */
export const ruleResultsBefore = (rule: FormRule, index: number, issuers: readonly RuleIssuer[]): RuleMessageResult[] => rule.actions.slice(0, index).flatMap(action => {
  const issuer = action.kind === "IssueDocument" ? issuers.find(item => item.id === action.issuerId) : undefined;
  return issuer ? issuer.resultFields.map(field => ({ source: issuer.id, sourceName: issuer.name, key: field.key, label: field.label, kind: field.kind })) : [];
});
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
export function prepareRules(rules: readonly FormRule[], original: FormCulture, columns: readonly ResponseColumn[], issuers: readonly RuleIssuer[] = []) {
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
      // An issuance goes when a response arrives or is approved, once per rule and before the messages, which may use its data.
      if (action.kind === "IssueDocument") {
        const before = rule.actions.slice(0, actionIndex);
        if (rule.event !== "Received" && rule.event !== "Approved") issues.push({ path: actionPath, key: "issueOnEvent" });
        else if (before.some(previous => previous.kind === "IssueDocument")) issues.push({ path: actionPath, key: "issueOnce" });
        else if (before.some(previous => usesMessage(previous.kind))) issues.push({ path: actionPath, key: "issueBeforeMessages" });
        if (!issuers.some(issuer => issuer.id === action.issuerId)) issues.push({ path: actionPath + ".issuerId", key: "issuerUnavailable" });
      }
      // The copy by email sends what an issuance of its rule left: it goes after it.
      if (action.kind === "SendCopy" && !rule.actions.slice(0, actionIndex).some(previous => previous.kind === "IssueDocument"))
        issues.push({ path: actionPath, key: "copyAfterIssue" });
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
      // A datum whose question left the form would arrive empty: it is told under the message before saving (board MD1-A). A
      // question of the block is among them, and the server says that it is not a datum (RG5-A).
      for (const [culture, value] of Object.entries(text ?? {})) if (hasMissingRuleData(value, responseQuestionColumns(columns))) issues.push({ path: actionPath + ".text." + culture, key: "missingData" });
      // A datum of a result only arrives after the action that brings it (RE1-A).
      const results = ruleResultsBefore(rule, actionIndex, issuers);
      for (const [culture, value] of Object.entries(text ?? {})) if (hasUnavailableResults(value, results)) issues.push({ path: actionPath + ".text." + culture, key: "resultBeforeIssue" });
      // The choices of an approval (RC4-A) go only with «RequestApproval» and only when they leave today's rule.
      const approval = action.kind === "RequestApproval";
      return { ...action, roleId: role ? action.roleId : null, text, includePdf: attached, issuerId: action.kind === "IssueDocument" ? action.issuerId ?? null : undefined,
        authorMayDecide: approval && action.authorMayDecide ? true : undefined, reasonOptional: approval && action.reasonOptional ? true : undefined };
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
    return [path, ...(usesRole(action.kind) ? [path + ".roleId"] : []), ...(usesMessage(action.kind) ? [path + ".text.es", path + ".text.en"] : []), ...(action.kind === "NotifyAuthor" ? [path + ".includePdf"] : []),
      ...(action.kind === "IssueDocument" ? [path + ".issuerId"] : []), ...(action.kind === "RequestApproval" ? [path + ".authorMayDecide", path + ".reasonOptional"] : [])];
  })]);
  const first = Object.keys(errors).find(path => errors[path].length > 0 && fields.includes(path));
  const index = first ? /^rules\.(\d+)\./.exec(first)?.[1] : undefined;
  return { errors, fields, firstRuleId: index === undefined ? null : rules[Number(index)]?.id ?? null };
}
