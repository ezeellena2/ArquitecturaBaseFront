import { administrativeName } from "@/features/business-forms/editorModel";
import type { DraftWriteBody, FormCulture, FormDefinitionSnapshot, CanonicalQuestion, FormDraftSaveResult } from "@/features/business-forms/model";

export const fixtureFormId = "01990000-0000-7000-8000-000000000001";
const guid = (n: number) => "01990000-0000-7000-8000-" + String(n).padStart(12, "0");
const key = (id: string) => "field_" + id.replaceAll("-", "");
const audit = { createdAtUtc: "2026-10-10T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-10-10T12:00:00Z", lastChangedBy: { userId: guid(2), displayName: "Ana Pérez" } };
export function fixtureDefinition(culture: FormCulture = "es", prefixLocked = false): FormDefinitionSnapshot {
  const common = (n: number, es: string, en: string) => ({ fieldId: guid(n), key: key(guid(n)), label: { es, en }, help: null, required: true });
  return { id: fixtureFormId, name: { es: "Registrar visita", en: "Register visit" }, prefix: "VIS", prefixLocked, revision: 1,
    draft: { format: 1, culture, submitLabel: { es: "Confirmar visita", en: "Confirm visit" }, fields: [
      { ...common(10, "Cliente", "Customer"), type: "choice", options: [{ choiceId: guid(20), label: { es: "Pérez Hnos.", en: "Pérez Hnos." } }, { choiceId: guid(21), label: { es: "Distribuidora Norte", en: "North distributor" } }] },
      { ...common(11, "Contacto", "Contact"), type: "shortText", maxLength: 80 },
      { ...common(12, "Importe cobrado", "Amount collected"), type: "decimal" },
      { ...common(13, "Fecha de visita", "Visit date"), type: "date" },
      { ...common(14, "Visita completada", "Visit completed"), type: "boolean" },
      { ...common(15, "Observaciones", "Notes"), type: "longText", maxLength: 2000, required: false, help: { [culture]: culture === "es" ? "Contá lo que pasó." : "Describe what happened." } },
    ] } };
}
export function wireDefinition(definition: FormDefinitionSnapshot) {
  return { ...definition, draft: { ...definition.draft, fields: definition.draft.fields.map(q => ({ ...q,
    maxLength: "maxLength" in q ? q.maxLength : null, options: q.type === "choice" ? q.options : null,
  })) } };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
export function createFormFixtureStore(culture: FormCulture = "es", scenario = "") {
  const definitions = new Map<string, FormDefinitionSnapshot>();
  if (scenario !== "forms-empty") definitions.set(fixtureFormId, fixtureDefinition(culture, scenario === "forms-prefix"));
  if (scenario === "forms-translations") {
    const original = fixtureDefinition("es");
    definitions.set(fixtureFormId, { ...original, draft: { ...original.draft, fields: original.draft.fields.map(q => q.type === "decimal" ? { ...q, label: { ...q.label, en: "" } } : q.type === "choice" ? { ...q, options: q.options.map((o, index) => index === 0 ? { ...o, label: { ...o.label, en: "" } } : o) } : q) } });
  }
  const receipts = new Map<string, { body: string; kind: "Create" | "Update"; result: FormDraftSaveResult }>();
  let conflict = false; let missing = false; let serial = 100;
  const calls: { method: string; path: string }[] = [];
  const canSave = scenario !== "forms-read";
  function wireCommit(result: FormDraftSaveResult) { return { ...result, definition: wireDefinition(result.definition) }; }
  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url); const path = url.pathname;
    calls.push({ method: request.method, path });
    if (scenario === "forms-denied") return json({ code: "General.Forbidden" }, 403);

    if (request.method === "GET" && path.startsWith("/api/forms/draft-changes/")) {
      if (scenario === "forms-expired") return json({ code: "Forms.Draft.ChangeExpired" }, 410);
      if (scenario === "forms-uncertain" && !missing) { missing = true; return json({ code: "Forms.Draft.ChangeNotFound" }, 404); }
      const receipt = receipts.get(path.split("/").at(-1)!);
      return receipt ? json({ requestId: receipt.result.requestId, kind: receipt.kind, status: "Committed", committedAtUtc: audit.createdAtUtc,
        currentRevision: definitions.get(receipt.result.definition.id)!.revision, result: wireCommit(receipt.result) }) : json({ code: "Forms.Draft.ChangeNotFound" }, 404);
    }
    if (request.method === "GET" && path === "/api/forms/definitions/facets") {
      const matches = [...definitions.values()].filter(d => administrativeName(d.name, culture).toLowerCase().includes((url.searchParams.get("search") ?? "").toLowerCase()));
      return json({ all: matches.length, published: 0, drafts: matches.length });
    }
    if (request.method === "GET" && path === "/api/forms/definitions") {
      if (scenario === "forms-loading") return new Promise(() => {});
      if (scenario === "forms-error") return json({ code: "General.Unexpected", traceId: "forms-fixture" }, 500);
      const values = [...definitions.values()].filter(d => url.searchParams.get("publicationFilter") !== "Published" && administrativeName(d.name, culture).toLowerCase().includes((url.searchParams.get("search") ?? "").toLowerCase()));
      const sort = url.searchParams.get("sort") ?? "name";
      values.sort((a, b) => (sort.includes("questionCount") ? a.draft.fields.length - b.draft.fields.length : administrativeName(a.name, culture).localeCompare(administrativeName(b.name, culture))) * (sort.startsWith("-") ? -1 : 1));
      const page = Number(url.searchParams.get("page") ?? 1); const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      return json({ items: values.slice((page - 1) * pageSize, page * pageSize).map(d => ({ id: d.id, name: d.name, prefix: d.prefix, questionCount: d.draft.fields.length,
        activeVersionNumber: null, displayState: "Draft", lastChangedAtUtc: audit.lastChangedAtUtc, lastChangedBy: audit.lastChangedBy, canEdit: canSave })),
        page, pageSize, totalCount: values.length, totalPages: Math.ceil(values.length / pageSize), hasPrevious: page > 1, hasNext: page * pageSize < values.length });
    }
    if (request.method === "GET") {
      const definition = definitions.get(path.split("/").at(-1)!);
      return definition ? json({ definition: wireDefinition(definition), capabilities: { canSave }, audit }) : json({ code: "Forms.Definition.NotFound" }, 404);
    }
    if (!canSave) return json({ code: "General.Forbidden" }, 403);
    const body = await request.json() as DraftWriteBody;
    const previousReceipt = receipts.get(body.requestId);
    if (previousReceipt) return previousReceipt.body === JSON.stringify(body) ? json(wireCommit(previousReceipt.result)) : json({ code: "Forms.Draft.RequestConflict" }, 409);
    const previous = request.method === "PUT" ? definitions.get(path.split("/").at(-2)!) : undefined;
    if (scenario === "forms-conflict" && previous && !conflict) {
      conflict = true;
      definitions.set(previous.id, { ...previous, name: { ...previous.name, [culture]: culture === "es" ? "Visita guardada" : "Saved visit" }, revision: previous.revision + 1,
        draft: { ...previous.draft, fields: previous.draft.fields.map(q => q.type === "longText" ? { ...q, maxLength: 300 } : q) } });
      return json({ code: "Forms.Draft.RevisionConflict" }, 409);
    }
    if (previous && body.expectedRevision !== previous.revision) return json({ code: "Forms.Draft.RevisionConflict" }, 409);
    if (previous?.prefixLocked && previous.prefix !== body.prefix) return json({ code: "Forms.Definition.PrefixLocked" }, 409);
    if (!body.name[body.draft.culture]?.trim()) return json({ code: "Validation.Failed", errors: { [`name.${body.draft.culture}`]: [culture === "es" ? "Ingresá un nombre." : "Enter a name."] } }, 400);
    if ([...definitions.values()].some(d => d.id !== previous?.id && d.prefix === body.prefix))
      return json({ code: "Forms.Definition.PrefixTaken", errors: { prefix: [culture === "es" ? "Ya hay un formulario con ese prefijo. Elegí otro." : "A form already uses this prefix. Choose another."] } }, 400);
    if (!/^[A-Z][A-Z0-9]{0,11}$/.test(body.prefix)) return json({ code: "Validation.Failed", errors: { prefix: ["Invalid prefix."] } }, 400);
    const fields: FormDraftSaveResult["identityMap"]["fields"][number][] = []; const choices: FormDraftSaveResult["identityMap"]["choices"][number][] = [];
    const canonical: CanonicalQuestion[] = body.draft.fields.map(q => {
      const fieldId = q.fieldId ?? guid(serial++); const common = { fieldId, key: key(fieldId), label: q.label, help: q.help && Object.values(q.help).some(text => !!text?.trim()) ? Object.fromEntries(Object.entries(q.help).filter((entry): entry is [string, string] => !!entry[1]?.trim())) : null, required: q.required };
      fields.push({ localId: q.localId, fieldId, key: common.key, replacesFieldId: q.replacesFieldId });
      if (q.type === "choice") return { ...common, type: q.type, options: q.options.map(o => {
        const choiceId = o.choiceId ?? guid(serial++); choices.push({ fieldLocalId: q.localId, localId: o.localId, fieldId, choiceId }); return { choiceId, label: o.label };
      }) };
      return q.type === "shortText" || q.type === "longText" ? { ...common, type: q.type, maxLength: q.maxLength ?? (q.type === "shortText" ? 80 : 600) } : { ...common, type: q.type };
    });
    const definition: FormDefinitionSnapshot = { id: previous?.id ?? guid(serial++), name: Object.fromEntries(Object.entries(body.name).map(([language, text]) => [language, text.trim()])), prefix: body.prefix, prefixLocked: previous?.prefixLocked ?? false,
      revision: (previous?.revision ?? 0) + 1, draft: { ...body.draft, fields: canonical } };
    definitions.set(definition.id, definition);
    const result: FormDraftSaveResult = { requestId: body.requestId, definition, identityMap: { fields, choices }, recovery: { path: "/api/forms/draft-changes/" + body.requestId, resultExpiresAtUtc: "2026-11-09T12:00:00Z" } };
    receipts.set(body.requestId, { body: JSON.stringify(body), kind: previous ? "Update" : "Create", result });
    if (scenario === "forms-uncertain" || scenario === "forms-expired") return json({ code: "General.Unexpected", traceId: "forms-fixture" }, 500);
    return json(wireCommit(result), previous ? 200 : 201);
  }
  return { handle, definitions, calls };
}
