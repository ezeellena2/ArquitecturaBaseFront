import type { FormDefinitionSnapshot, FormCulture } from "@/features/business-forms/model";
import type { FormRuleSet } from "@/features/business-forms/api/rules";
// Synthetic configuration persistence for the chosen G1 screen; no provider is called.
export function createRuleVisualFixtures(culture: FormCulture, definition: () => FormDefinitionSnapshot | undefined) {
  const revisions: FormRuleSet[] = [];
  const writes: { expectedRevision: number; rules: FormRuleSet["rules"] }[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const author = { userId: "01990000-0000-7000-8000-000000000002", displayName: "Ana Pérez" };
  const atUtc = "2026-10-16T12:00:00Z";
  const current = (): FormRuleSet => revisions.at(-1) ?? { id: null, definitionId: definition()!.id, revision: 0, originalCulture: culture, rules: [], createdAtUtc: null, author: null };
  return {
    writes,
    async handle(request: Request): Promise<Response | null> {
      const path = new URL(request.url).pathname;
      if (!path.includes("/rules")) return null;
      const form = definition();
      if (!form) return json({ code: "Forms.Definition.NotFound" }, 404);
      if (path.endsWith("/rules/options")) return json({ definitionId: form.id, name: form.name, originalCulture: form.draft.culture, questions: form.draft.fields.map(field => ({ ...field, maxLength: "maxLength" in field ? field.maxLength : null, options: field.type === "choice" && !field.source ? field.options : null })), conditionChoices: {}, roles: [{ id: author.userId, name: "Supervisor" }] });
      if (path.endsWith("/rules/revisions")) return json({ items: [...revisions].reverse().map(value => ({ id: value.id, revision: value.revision, createdAtUtc: value.createdAtUtc, author: value.author, hasApproval: value.rules.some(rule => rule.actions.some(action => action.kind === "RequestApproval")) })), page: 1, pageSize: 10, totalCount: revisions.length, totalPages: revisions.length ? 1 : 0, hasPrevious: false, hasNext: false });
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
