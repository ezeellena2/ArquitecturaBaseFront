import type { FormCulture, LocalizedText } from "./model";
import { normalizeResponseQuery, type ResponseColumn, type ResponseCondition } from "./responses";
export const ruleEvents = ["Received", "Approved", "Rejected"] as const;
export const ruleActionKinds = ["RequestApproval", "GeneratePdf", "NotifyAuthor", "NotifyRole"] as const;
export type RuleEvent = typeof ruleEvents[number];
export type RuleActionKind = typeof ruleActionKinds[number];
export interface RuleAction { readonly id: string; readonly kind: RuleActionKind; readonly roleId: string | null; readonly text: LocalizedText | null; readonly includePdf: boolean }
export interface FormRule { readonly id: string; readonly event: RuleEvent; readonly conditions: readonly ResponseCondition[]; readonly actions: readonly RuleAction[] }
export interface RuleIssue { readonly path: string; readonly key: string }
export const newRule = (): FormRule => ({ id: crypto.randomUUID(), event: "Received", conditions: [], actions: [] });
export const newRuleAction = (kind: RuleActionKind): RuleAction => ({ id: crypto.randomUUID(), kind, roleId: null, text: kind === "NotifyAuthor" || kind === "NotifyRole" ? { es: "", en: "" } : null, includePdf: false });
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
      const role = action.kind === "RequestApproval" || action.kind === "NotifyRole";
      if (role && !action.roleId) issues.push({ path: actionPath + ".roleId", key: "required" });
      if (action.includePdf && (action.kind !== "NotifyAuthor" || rule.event !== "Approved" || !rule.actions.slice(0, actionIndex).some(item => item.kind === "GeneratePdf"))) issues.push({ path: actionPath + ".includePdf", key: "pdfBeforeAttachment" });
      const message = action.kind === "NotifyAuthor" || action.kind === "NotifyRole";
      const text = message ? Object.fromEntries(Object.entries(action.text ?? {}).map(([culture, value]) => [culture, value.trim()])) : null;
      if (message && !text?.[original]) issues.push({ path: actionPath + ".text." + original, key: "required" });
      for (const [culture, value] of Object.entries(text ?? {})) if (value.length > (action.includePdf ? 1024 : 4096)) issues.push({ path: actionPath + ".text." + culture, key: "tooLong" });
      return { ...action, roleId: role ? action.roleId : null, text, includePdf: message && action.includePdf };
    });
    return { ...rule, conditions: normalized?.conditions ?? rule.conditions, actions };
  });
  return { rules: prepared, issues };
}
