import { describe, expect, it } from "vitest";
import { newRule, newRuleAction, prepareRules } from "./rules";
import type { ResponseColumn } from "./responses";
const original = "es";
const column: ResponseColumn = { fieldId: "0199a0c0-0000-7000-8000-000000000030", type: "decimal", label: "Importe", introducedInVersion: 1, options: [] };
describe("rule preparation", () => {
  it("requires only the original message language and preserves the optional text", () => {
    const rule = { ...newRule(), actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: " Recibimos {número}. ", en: "" } }] };
    expect(prepareRules([rule], original, [column])).toMatchObject({ issues: [], rules: [{ actions: [{ text: { es: "Recibimos {número}.", en: "" } }] }] });
    expect(prepareRules([{ ...rule, actions: [{ ...rule.actions[0], text: { es: "", en: "Received." } }] }], original, [column]).issues).toContainEqual({ path: "rules.0.actions.0.text.es", key: "required" });
  });
  it("normalizes decimal conditions without accepting an unfinished number", () => {
    const rule = { ...newRule(), conditions: [{ fieldId: column.fieldId, operator: "gte", values: [" 12,5 "] }], actions: [newRuleAction("NotifyAuthor")] };
    expect(prepareRules([rule], original, [column]).rules[0].conditions[0].values).toEqual(["12.5"]);
    expect(prepareRules([{ ...rule, conditions: [{ ...rule.conditions[0], values: ["12,"] }] }], original, [column]).issues).toContainEqual({ path: "rules.0.conditions", key: "invalidConditions" });
  });
  it("keeps approval last and restricts PDF to the approved event", () => {
    const rule = { ...newRule(), actions: [{ ...newRuleAction("RequestApproval"), roleId: crypto.randomUUID() }, newRuleAction("GeneratePdf")] };
    const issues = prepareRules([rule], original, [column]).issues;
    expect(issues).toContainEqual({ path: "rules.0.actions.0", key: "approvalLast" });
    expect(issues).toContainEqual({ path: "rules.0.actions.1", key: "pdfAfterApproval" });
    expect(prepareRules([{ ...rule, event: "Approved", actions: [newRuleAction("GeneratePdf")] }], original, [column]).issues).toEqual([]);
  });
  it("requires a role for role actions and at least one action", () => {
    expect(prepareRules([{ ...newRule(), actions: [] }], original, [column]).issues).toContainEqual({ path: "rules.0.actions", key: "required" });
    for (const kind of ["RequestApproval", "NotifyRole"] as const)
      expect(prepareRules([{ ...newRule(), actions: [newRuleAction(kind)] }], original, [column]).issues).toContainEqual({ path: "rules.0.actions.0.roleId", key: "required" });
  });
});

it("attaches only an approved PDF generated earlier in the same rule", () => {
  const notify = { ...newRuleAction("NotifyAuthor"), includePdf: true, text: { es: "Aprobado." } };
  expect(prepareRules([{ ...newRule(), event: "Approved", actions: [notify] }], "es", []).issues).toContainEqual({ path: "rules.0.actions.0.includePdf", key: "pdfBeforeAttachment" });
  expect(prepareRules([{ ...newRule(), event: "Approved", actions: [newRuleAction("GeneratePdf"), notify] }], "es", []).issues).toEqual([]);
});
it("rejects blank conditions and limits caption text without changing it", () => {
  const rule = { ...newRule(), conditions: [{ fieldId: column.fieldId, operator: "equals", values: [""] }], actions: [newRuleAction("GeneratePdf"), { ...newRuleAction("NotifyAuthor"), includePdf: true, text: { es: "a".repeat(1025) } }] };
  const result = prepareRules([{ ...rule, event: "Approved" }], "es", [column]);
  expect(result.issues).toContainEqual({ path: "rules.0.conditions", key: "invalidConditions" });
  expect(result.issues).toContainEqual({ path: "rules.0.actions.1.text.es", key: "tooLong" });
  expect(result.rules[0].actions[1].text?.es).toHaveLength(1025);
});
