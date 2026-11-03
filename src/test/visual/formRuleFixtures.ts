import type { FormDefinitionSnapshot, FormCulture } from "@/features/business-forms/model";
import type { FormRuleSet } from "@/features/business-forms/api/rules";
// Synthetic configuration persistence for the chosen G1 screen; no provider is called.
export function createRuleVisualFixtures(culture: FormCulture, definition: () => FormDefinitionSnapshot | undefined, seeded = false) {
  const revisions: FormRuleSet[] = [];
  const writes: { expectedRevision: number; rules: FormRuleSet["rules"] }[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const author = { userId: "01990000-0000-7000-8000-000000000002", displayName: "Ana Pérez" };
  const atUtc = "2026-10-16T12:00:00Z";
  // Board LR1-A: three saved rules as the user wrote them, read in steps: one condition and a notice to a role, three
  // conditions and an approval, and three actions with the PDF attached.
  const form = definition();
  if (seeded && form) {
    const field = (index: number) => form.draft.fields[index].fieldId!;
    const [customer, amount, completed, notes] = [field(0), field(2), field(4), field(5)];
    const number = { es: "{número}", en: "{number}" };
    revisions.push({ id: "01990000-0000-7000-8000-000000000501", definitionId: form.id, revision: 1, originalCulture: culture, createdAtUtc: atUtc, author, rules: [
      { id: "01990000-0000-7000-8000-000000000511", event: "Received", conditions: [{ fieldId: completed, operator: "in", values: ["false"] }], actions: [
        { id: "01990000-0000-7000-8000-000000000521", kind: "NotifyRole", roleId: author.userId, includePdf: false, text: { es: `La visita de {${customer}} quedó sin terminar. Revisá la visita ${number.es}.`, en: `The visit to {${customer}} was not finished. Check visit ${number.en}.` } }] },
      { id: "01990000-0000-7000-8000-000000000512", event: "Received", conditions: [{ fieldId: customer, operator: "in", values: [form.draft.fields[0].type === "choice" && !form.draft.fields[0].source ? form.draft.fields[0].options[0].choiceId! : ""] }, { fieldId: amount, operator: "gte", values: ["500"] }, { fieldId: notes, operator: "answered", values: null }], actions: [
        { id: "01990000-0000-7000-8000-000000000522", kind: "RequestApproval", roleId: author.userId, includePdf: false, text: null }] },
      { id: "01990000-0000-7000-8000-000000000513", event: "Approved", conditions: [], actions: [
        { id: "01990000-0000-7000-8000-000000000523", kind: "GeneratePdf", roleId: null, includePdf: false, text: null },
        { id: "01990000-0000-7000-8000-000000000524", kind: "NotifyAuthor", roleId: null, includePdf: true, text: { es: `Aprobamos la visita ${number.es} de {${customer}}. Te mandamos el comprobante.`, en: `We approved visit ${number.en} to {${customer}}. Here is the receipt.` } },
        { id: "01990000-0000-7000-8000-000000000525", kind: "NotifyRole", roleId: author.userId, includePdf: false, text: { es: `Ya está aprobada la visita ${number.es}: cobró {${amount}}.`, en: `Visit ${number.en} is approved: it collected {${amount}}.` } }] },
    ] });
  }
  const current = (): FormRuleSet => revisions.at(-1) ?? { id: null, definitionId: definition()!.id, revision: 0, originalCulture: culture, rules: [], createdAtUtc: null, author: null };
  return {
    writes,
    async handle(request: Request): Promise<Response | null> {
      const path = new URL(request.url).pathname;
      if (!path.includes("/rules")) return null;
      const form = definition();
      if (!form) return json({ code: "Forms.Definition.NotFound" }, 404);
      if (path.endsWith("/rules/options")) return json({ definitionId: form.id, name: form.name, originalCulture: form.draft.culture, questions: form.draft.fields.map(field => ({ ...field, maxLength: "maxLength" in field ? field.maxLength : null, options: field.type === "choice" && !field.source ? field.options : null })), conditionChoices: {}, roles: [{ id: author.userId, name: "Supervisor" }] });
      if (path.endsWith("/rules/revisions")) return json({ items: revisions.map((value, index) => {
        const previous = revisions[index - 1]?.rules ?? [];
        const previousById = new Map(previous.map(rule => [rule.id, rule]));
        const currentById = new Map(value.rules.map(rule => [rule.id, rule]));
        return { id: value.id, revision: value.revision, createdAtUtc: value.createdAtUtc, author: value.author, hasApproval: value.rules.some(rule => rule.actions.some(action => action.kind === "RequestApproval")), changes: {
          addedRules: value.rules.filter(rule => !previousById.has(rule.id)).length,
          updatedRules: value.rules.filter(rule => previousById.has(rule.id) && JSON.stringify(rule) !== JSON.stringify(previousById.get(rule.id))).length,
          removedRules: previous.filter(rule => !currentById.has(rule.id)).length,
          orderChanged: JSON.stringify(previous.filter(rule => currentById.has(rule.id)).map(rule => rule.id)) !== JSON.stringify(value.rules.filter(rule => previousById.has(rule.id)).map(rule => rule.id)),
        } };
      }).reverse(), page: 1, pageSize: 10, totalCount: revisions.length, totalPages: revisions.length ? 1 : 0, hasPrevious: false, hasNext: false });
      if (path.includes("/rules/revisions/")) {
        const revision = revisions.find(value => value.revision === Number(path.split("/").at(-1)));
        return revision ? json(revision) : json({ code: "Forms.Rules.RevisionNotFound" }, 404);
      }
      if (request.method === "GET") return json(current());
      const body = await request.json() as { expectedRevision: number; rules: FormRuleSet["rules"] };
      writes.push(body);
      if (body.expectedRevision !== current().revision) return json({ code: "Forms.Rules.RevisionConflict" }, 409);
      const saved: FormRuleSet = { id: crypto.randomUUID(), definitionId: form.id, revision: current().revision + 1, originalCulture: culture, rules: body.rules.map(rule => ({ ...rule, conditions: rule.conditions.map(condition => ({ ...condition, values: condition.values ? [...condition.values] : condition.values })), actions: rule.actions.map(action => ({ ...action, text: action.text ? { ...action.text } : null })) })), createdAtUtc: atUtc, author };
      revisions.push(saved);
      return json(saved);
    },
  };
}
