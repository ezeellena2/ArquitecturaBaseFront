import { describe, expect, it } from "vitest";
import { newRule, newRuleAction, clearUnavailablePdfAttachments, prepareRules, ruleFieldErrors } from "./rules";
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

it("normalizes numeric bracket indexes and binds the first known rule error to its identity", () => {
  const first = { ...newRule(), actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: "Recibimos." } }] };
  const second = { ...newRule(), actions: [{ ...newRuleAction("RequestApproval"), roleId: crypto.randomUUID() }] };
  const source = { "rules[1].actions[0].roleId": ["Elegí otro rol."], "rules.0.actions.0.text.es": ["Revisá este mensaje."] };
  const result = ruleFieldErrors(source, [first, second]);
  expect(result.errors).toEqual({ "rules.1.actions.0.roleId": ["Elegí otro rol."], "rules.0.actions.0.text.es": ["Revisá este mensaje."] });
  expect(result.firstRuleId).toBe(second.id);
  expect(result.fields).toContain("rules.1.actions.0.roleId");
  expect(source).toHaveProperty("rules[1].actions[0].roleId");
});
it.each(["rules[5].actions[0].roleId", "rules[0].actions[2].roleId", "rules[0].unknown", "rules[0].actions[0].roleId"])("preserves unbound validation %s without targeting a different rule", path => {
  const rule = { ...newRule(), actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: "Recibimos." } }] };
  const result = ruleFieldErrors({ [path]: ["Revisá la configuración."] }, [rule]);
  expect(result.firstRuleId).toBeNull();
  const normalized = path.replace(/\[(\d+)\]/g, ".$1");
  expect(result.errors[normalized]).toEqual(["Revisá la configuración."]);
  expect(result.fields).not.toContain(normalized);
});
it("keeps every message when both index notations name the same field", () => {
  const rule = { ...newRule(), actions: [{ ...newRuleAction("RequestApproval"), roleId: crypto.randomUUID() }] };
  const result = ruleFieldErrors({ "rules[0].actions[0].roleId": ["Primer motivo."], "rules.0.actions.0.roleId": ["Segundo motivo."] }, [rule]);
  expect(result.errors["rules.0.actions.0.roleId"]).toEqual(["Primer motivo.", "Segundo motivo."]);
});
it("binds a message error of either language to its rule", () => {
  const rule = { ...newRule(), actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: "Recibimos." } }] };
  const result = ruleFieldErrors({ "rules[0].actions[0].text.en": ["Demasiado largo."] }, [rule]);
  expect(result.fields).toEqual(expect.arrayContaining(["rules.0.actions.0.text.es", "rules.0.actions.0.text.en"]));
  expect(result.firstRuleId).toBe(rule.id);
});

it("preserves a selected PDF only while a prior generator still applies without mutating the source", () => {
  const firstPdf = newRuleAction("GeneratePdf"); const secondPdf = newRuleAction("GeneratePdf"); const notice = { ...newRuleAction("NotifyAuthor"), includePdf: true, text: { es: "Aviso" } };
  const rule = { ...newRule(), event: "Approved" as const, actions: [firstPdf, secondPdf, notice] };
  const withoutOne = { ...rule, actions: [secondPdf, notice] };
  expect(clearUnavailablePdfAttachments(withoutOne)).toEqual(withoutOne);
  expect(clearUnavailablePdfAttachments({ ...rule, actions: [notice, firstPdf] }).actions[0]).toEqual({ ...notice, includePdf: false });
  expect(clearUnavailablePdfAttachments({ ...rule, event: "Rejected" }).actions[2].includePdf).toBe(false);
  expect(rule.actions[2].includePdf).toBe(true);
});


it("preserves anyOf and captured multi option IDs when preparing rules", () => {
  const multi: ResponseColumn = { ...column, fieldId: "multi", type: "multiChoice", options: [{ id: "cold", label: "Frío" }] };
  const condition = { fieldId: multi.fieldId, operator: "anyOf", values: ["cold"] };
  const rule = { ...newRule(), event: "Approved" as const, conditions: [condition], actions: [newRuleAction("GeneratePdf")] };
  expect(prepareRules([rule], original, [multi])).toMatchObject({ issues: [], rules: [{ conditions: [condition] }] });
});
