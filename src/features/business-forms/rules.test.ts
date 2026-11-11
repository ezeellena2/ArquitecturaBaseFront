import { describe, expect, it } from "vitest";
import { conditionColumns, newRule, newRuleAction, fixPdfAttachment, pdfAttachmentIssue, prepareRules, ruleFieldErrors, withRuleActionKind } from "./rules";
import type { ResponseColumn } from "./responses";
const original = "es";
const column: ResponseColumn = { fieldId: "0199a0c0-0000-7000-8000-000000000030", type: "decimal", label: "Importe", introducedInVersion: 1, options: [] };
const issuer = { id: "arca.invoice", name: { es: "Emitir comprobante en ARCA", en: "Issue an ARCA voucher" }, resultFields: [{ key: "number", label: { es: "Número", en: "Number" }, kind: "text" }] };
describe("issuing a document", () => {
  const issue = () => newRuleAction("IssueDocument", issuer.id);
  it("goes when a response arrives or is approved, once per rule and before the messages", () => {
    const message = { ...newRuleAction("NotifyAuthor"), text: { es: "Listo", en: "" } };
    expect(prepareRules([{ ...newRule(), actions: [issue(), message] }], original, [column], [issuer]).issues).toEqual([]);
    expect(prepareRules([{ ...newRule(), event: "Approved", actions: [issue()] }], original, [column], [issuer]).issues).toEqual([]);
    expect(prepareRules([{ ...newRule(), event: "Rejected", actions: [issue()] }], original, [column], [issuer]).issues).toEqual([{ path: "rules.0.actions.0", key: "issueOnEvent" }]);
    expect(prepareRules([{ ...newRule(), actions: [issue(), issue()] }], original, [column], [issuer]).issues).toEqual([{ path: "rules.0.actions.1", key: "issueOnce" }]);
    expect(prepareRules([{ ...newRule(), actions: [message, issue()] }], original, [column], [issuer]).issues).toEqual([{ path: "rules.0.actions.1", key: "issueBeforeMessages" }]);
  });
  it("needs an issuer the form offers, and only its action keeps it", () => {
    expect(prepareRules([{ ...newRule(), actions: [issue()] }], original, [column]).issues).toEqual([{ path: "rules.0.actions.0.issuerId", key: "issuerUnavailable" }]);
    const prepared = prepareRules([{ ...newRule(), event: "Approved", actions: [issue(), { ...newRuleAction("GeneratePdf"), issuerId: issuer.id }] }], original, [column], [issuer]);
    expect(prepared.rules[0].actions.map(action => action.issuerId)).toEqual([issuer.id, undefined]);
  });
  it("uses a datum of the result only after the action that brings it", () => {
    const message = { ...newRuleAction("NotifyAuthor"), text: { es: "Va {result:arca.invoice.number}", en: "" } };
    expect(prepareRules([{ ...newRule(), actions: [issue(), message] }], original, [column], [issuer]).issues).toEqual([]);
    expect(prepareRules([{ ...newRule(), actions: [message] }], original, [column], [issuer]).issues).toEqual([{ path: "rules.0.actions.0.text.es", key: "resultBeforeIssue" }]);
  });
  it("brings its issuer when the kind changes to it and leaves it behind when it changes back", () => {
    const issuing = withRuleActionKind(newRuleAction("NotifyAuthor"), "IssueDocument", issuer.id);
    expect(issuing).toMatchObject({ kind: "IssueDocument", issuerId: issuer.id });
    expect(withRuleActionKind(issuing, "NotifyAuthor")).not.toHaveProperty("issuerId");
  });
});
describe("rule preparation", () => {
  it("requires only the original message language and preserves the optional text", () => {
    const rule = { ...newRule(), actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: " Recibimos {número}. ", en: "" } }] };
    expect(prepareRules([rule], original, [column])).toMatchObject({ issues: [], rules: [{ actions: [{ text: { es: "Recibimos {número}.", en: "" } }] }] });
    expect(prepareRules([{ ...rule, actions: [{ ...rule.actions[0], text: { es: "", en: "Received." } }] }], original, [column]).issues).toContainEqual({ path: "rules.0.actions.0.text.es", key: "required" });
  });
  it("does not save a message with a question that is no longer in the form, in either language", () => {
    const gone = "0199a0c0-0000-7000-8000-000000000099";
    const rule = { ...newRule(), actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: `Llegó {${column.fieldId}}`, en: `Arrived {${gone}}` } }] };
    expect(prepareRules([rule], original, [column]).issues).toEqual([{ path: "rules.0.actions.0.text.en", key: "missingData" }]);
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
  expect(prepareRules([{ ...newRule(), event: "Received", actions: [notify] }], "es", []).issues).toContainEqual({ path: "rules.0.actions.0.includePdf", key: "pdfOnApproval" });
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

it("tells why an attached PDF cannot go and which fix applies, without clearing the choice", () => {
  const pdf = newRuleAction("GeneratePdf"); const notice = { ...newRuleAction("NotifyAuthor"), includePdf: true, text: { es: "Aviso" } };
  const rule = { ...newRule(), event: "Approved" as const, actions: [notice, pdf] };
  expect(pdfAttachmentIssue(rule, 0)).toEqual({ key: "pdfBeforeAttachment", fix: "move" });
  expect(pdfAttachmentIssue({ ...rule, actions: [notice] }, 0)).toEqual({ key: "pdfBeforeAttachment", fix: "add" });
  expect(pdfAttachmentIssue({ ...rule, actions: [pdf, notice] }, 1)).toBeNull();
  expect(pdfAttachmentIssue({ ...rule, event: "Rejected", actions: [pdf, notice] }, 1)).toEqual({ key: "pdfOnApproval", fix: null });
  expect(pdfAttachmentIssue({ ...rule, actions: [{ ...notice, includePdf: false }] }, 0)).toBeNull();
  expect(rule.actions[0].includePdf).toBe(true);
});
it("moves the first later PDF just before the message, or adds one there", () => {
  const pdf = newRuleAction("GeneratePdf"); const role = { ...newRuleAction("NotifyRole"), roleId: crypto.randomUUID() };
  const notice = { ...newRuleAction("NotifyAuthor"), includePdf: true, text: { es: "Aviso" } };
  const rule = { ...newRule(), event: "Approved" as const, actions: [role, notice, pdf, newRuleAction("GeneratePdf")] };
  expect(fixPdfAttachment(rule, 1).actions).toEqual([role, pdf, notice, rule.actions[3]]);
  const added = fixPdfAttachment({ ...rule, actions: [role, notice] }, 1).actions;
  expect(added.map(action => action.kind)).toEqual(["NotifyRole", "GeneratePdf", "NotifyAuthor"]);
  expect(added[1].id).not.toBe(pdf.id);
});
it("keeps the message, the role and the attachment when the kind changes, and saves each only with its kind", () => {
  const roleId = crypto.randomUUID();
  const message = { ...newRuleAction("NotifyAuthor"), includePdf: true, text: { es: "Aviso", en: "" } };
  const toRole = { ...withRuleActionKind(message, "NotifyRole"), roleId };
  expect(toRole).toEqual({ ...message, kind: "NotifyRole", roleId });
  const toPdf = withRuleActionKind(toRole, "GeneratePdf");
  expect(withRuleActionKind(toPdf, "NotifyAuthor")).toEqual({ ...message, roleId });
  expect(withRuleActionKind(newRuleAction("GeneratePdf"), "NotifyAuthor").text).toEqual({ es: "", en: "" });
  const prepared = prepareRules([{ ...newRule(), event: "Approved", actions: [newRuleAction("GeneratePdf"), toRole] }], "es", []);
  expect(prepared.issues).toEqual([]);
  expect(prepared.rules[0].actions[1]).toMatchObject({ kind: "NotifyRole", roleId, includePdf: false, text: { es: "Aviso", en: "" } });
  expect(prepareRules([{ ...newRule(), event: "Approved", actions: [toPdf] }], "es", []).rules[0].actions[0]).toMatchObject({ kind: "GeneratePdf", roleId: null, text: null, includePdf: false });
});


it("preserves anyOf and captured multi option IDs when preparing rules", () => {
  const multi: ResponseColumn = { ...column, fieldId: "multi", type: "multiChoice", options: [{ id: "cold", label: "Frío" }] };
  const condition = { fieldId: multi.fieldId, operator: "anyOf", values: ["cold"] };
  const rule = { ...newRule(), event: "Approved" as const, conditions: [condition], actions: [newRuleAction("GeneratePdf")] };
  expect(prepareRules([rule], original, [multi])).toMatchObject({ issues: [], rules: [{ conditions: [condition] }] });
});
describe("condition columns", () => {
  const label = (es: string) => ({ es, en: es + " (en)" });
  it("put the block as a group column with its questions, also one retired at the end, and keep loose questions as columns", () => {
    const columns = conditionColumns([
      { fieldId: "remito", type: "shortText", label: label("Remito") },
      { fieldId: "items", type: "group", label: label("Artículos") },
      { fieldId: "article", type: "choice", label: label("Artículo"), options: [{ choiceId: "seed", label: label("Semilla") }], repeated: true },
      { fieldId: "unit", type: "choice", label: label("Unidad"), options: [{ choiceId: "liters", label: label("Litros") }], repeated: true },
      { fieldId: "notes", type: "longText", label: label("Notas") },
      // A question of the block retired from the draft comes after the draft's questions: it goes with the last block before it.
      { fieldId: "good", type: "boolean", label: label("¿Llegó en buen estado?"), repeated: true },
    ], { article: [{ id: "seed", label: "Semilla del catálogo" }] }, "en", "es");

    expect(columns.map(column => column.fieldId)).toEqual(["remito", "items", "notes"]);
    expect(columns[1]).toMatchObject({ type: "group", label: "Artículos (en)", options: [] });
    expect(columns[1].questions?.map(question => question.fieldId)).toEqual(["article", "unit", "good"]);
    expect(columns[1].questions?.[0].options).toEqual([{ id: "seed", label: "Semilla del catálogo" }]);
    expect(columns[1].questions?.[1].options).toEqual([{ id: "liters", label: "Litros (en)" }]);
    expect(columns[0]).toEqual({ fieldId: "remito", type: "shortText", label: "Remito (en)", introducedInVersion: 1, options: [] });
  });
});
describe("a message with the block of rows", () => {
  it("looks for its data among every question, also those of the block, so the server says what is not a datum", () => {
    const block: ResponseColumn = { fieldId: "0199a0c0-0000-7000-8000-000000000041", type: "group", label: "Artículos", introducedInVersion: 1, options: [],
      questions: [{ fieldId: "0199a0c0-0000-7000-8000-000000000042", type: "decimal", label: "Cantidad", introducedInVersion: 1, options: [] }] };
    const rule = { ...newRule(), actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: `Llegó {${block.fieldId}} con {${block.questions![0].fieldId}}`, en: "" } }] };
    expect(prepareRules([rule], original, [column, block]).issues).toEqual([]);
  });
});
