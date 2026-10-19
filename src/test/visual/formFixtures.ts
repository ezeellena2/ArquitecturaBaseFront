import { createRuleVisualFixtures } from "./formRuleFixtures";
import budgetEsCheck from "../fixtures/forms-http/budget-http/es.json" with { type: "json" };
import budgetEnCheck from "../fixtures/forms-http/budget-http/en.json" with { type: "json" };
import publishedEsList from "../fixtures/forms-http/published/list-es.json" with { type: "json" };
import publishedEnList from "../fixtures/forms-http/published/list-en.json" with { type: "json" };
import publishedEsDetail from "../fixtures/forms-http/published/detail-es.json" with { type: "json" };
import publishedEnDetail from "../fixtures/forms-http/published/detail-en.json" with { type: "json" };
import failedEsDetail from "../fixtures/forms-http/failed/detail-es.json" with { type: "json" };
import failedEnDetail from "../fixtures/forms-http/failed/detail-en.json" with { type: "json" };
import failedEsStatus from "../fixtures/forms-http/failed/status-es.json" with { type: "json" };
import failedEnStatus from "../fixtures/forms-http/failed/status-en.json" with { type: "json" };
import { validFileCounts } from "@/features/business-forms/fileQuestions";
import type { FormPublicationCheck } from "@/features/business-forms/api/response";
import { administrativeName } from "@/features/business-forms/editorModel";
import type { DraftWriteBody, FormCulture, FormDefinitionSnapshot, CanonicalQuestion, FormDraftSaveResult } from "@/features/business-forms/model";

export const fixtureFormId = "01990000-0000-7000-8000-000000000001";
const guid = (n: number) => "01990000-0000-7000-8000-" + String(n).padStart(12, "0");
const key = (id: string) => "field_" + id.replaceAll("-", "");
const audit = { createdAtUtc: "2026-10-10T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-10-10T12:00:00Z", lastChangedBy: { userId: guid(2), displayName: "Ana Pérez" } };
export function fixtureDefinition(culture: FormCulture = "es", prefixLocked = false): FormDefinitionSnapshot {
  const common = (n: number, es: string, en: string) => ({ fieldId: guid(n), key: key(guid(n)), label: { es, en }, help: null, required: true });
  return { offerWhen: null, id: fixtureFormId, name: { es: "Registrar visita", en: "Register visit" }, prefix: "VIS", prefixLocked, revision: 1,
    draft: { format: 1, culture, submitLabel: { es: "Confirmar visita", en: "Confirm visit" }, fields: [
      { ...common(10, "Cliente", "Customer"), type: "choice", options: [{ choiceId: guid(20), label: { es: "Pérez Hnos.", en: "Pérez Hnos." } }, { choiceId: guid(21), label: { es: "Distribuidora Norte", en: "North distributor" } }] },
      { ...common(11, "Contacto", "Contact"), type: "shortText", maxLength: 80 },
      { ...common(12, "Importe cobrado", "Amount collected"), type: "decimal" },
      { ...common(13, "Fecha de visita", "Visit date"), type: "date" },
      { ...common(14, "Visita completada", "Visit completed"), type: "boolean" },
      { ...common(15, "Observaciones", "Notes"), type: "longText", maxLength: 2000, required: false, help: { [culture]: culture === "es" ? "Contá lo que pasó." : "Describe what happened." } },
    ] } };
}
const responseBudgetChecks = { es: budgetEsCheck, en: budgetEnCheck };
// Only the check is raw controller output; the editor snapshot is a matching test double.
export function responseBudgetDefinition(culture: FormCulture): FormDefinitionSnapshot {
 const checked = responseBudgetChecks[culture];
 return { ...fixtureDefinition(), id: checked.definitionId, revision: checked.draftRevision,
  draft: { format: 1, culture: "es", submitLabel: { es: "Enviar", en: "Submit" }, fields: [...new Set(checked.issues.map(issue => issue.fieldId))].map((fieldId,index) => ({
   fieldId, key: key(fieldId), type: "longText", required: true, maxLength: 10000, help: null, label: { es: "Respuesta "+index, en: "Response "+index },
  })) } };
}
export function wireDefinition(definition: FormDefinitionSnapshot) {
  return { ...definition, draft: { ...definition.draft, fields: definition.draft.fields.map(q => ({ ...q,
    maxLength: "maxLength" in q ? q.maxLength : null, options: q.type === "choice" && !q.source ? q.options : null,
  })) } };
}
// Synthetic language reports exercise the consumer; real HTTP bodies remain unchanged.
function fixturePublicationCultures(definition: FormDefinitionSnapshot): FormPublicationCheck["cultures"] {
  return (["es", "en"] as const).map(culture => {
    const missing: FormPublicationCheck["issues"] = [];
    const visit = (path: string, text: Readonly<Record<string, string | null>>, fieldId: string | null = null, choiceId: string | null = null) => {
      if (!text[culture]?.trim()) missing.push({ channelId: null, fieldId, choiceId, path: path + "." + culture, code: "Forms.Publication.MissingTranslation", message: "Synthetic untranslated text.", limit: null, culture });
    };
    visit("name", definition.name); visit("draft.submitLabel", definition.draft.submitLabel);
    definition.draft.fields.forEach((field, index) => {
      const path = "draft.fields[" + index + "]";
      visit(path + ".label", field.label, field.fieldId);
      if (field.help && Object.values(field.help).some(value => !!value?.trim())) visit(path + ".help", field.help, field.fieldId);
      if (field.type === "choice" && !field.source) field.options.forEach((option, position) => visit(path + ".options[" + position + "].label", option.label, field.fieldId, option.choiceId));
    });
    return { culture, isOriginal: culture === definition.draft.culture, isComplete: missing.length === 0, missing };
  });
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
export function createFormFixtureStore(culture: FormCulture = "es", scenario = "", responseBudgetRaw?: string) {
  const definitions = new Map<string, FormDefinitionSnapshot>();
  if (scenario !== "forms-empty") definitions.set(fixtureFormId, fixtureDefinition(culture, scenario === "forms-prefix"));
  if (scenario === "forms-files") {
    const original = definitions.get(fixtureFormId)!;
    definitions.set(fixtureFormId,{...original,draft:{...original.draft,fields:[
      {fieldId:guid(51),key:key(guid(51)),type:"photo",label:{es:"Fotos de la obra",en:"Site photos"},help:null,required:true,files:{minFiles:1,maxFiles:6,photoSource:"cameraOrGallery"}},
      {fieldId:guid(52),key:key(guid(52)),type:"shortText",label:{es:"Observaciones",en:"Notes"},help:null,required:false,maxLength:80},
      {fieldId:guid(53),key:key(guid(53)),type:"document",label:{es:"Remito firmado",en:"Signed delivery note"},help:null,required:false,files:{minFiles:0,maxFiles:1,photoSource:null}},
    ]}});
  }
  if (scenario.startsWith("forms-catalog")) {
    const definition = definitions.get(fixtureFormId)!;
    definitions.set(fixtureFormId, { ...definition, draft: { ...definition.draft, fields: definition.draft.fields.map((field, index) => {
      if (index !== 0 || field.type !== "choice" || field.source) return field;
      const { options: _options, ...common } = field;
      return { ...common, source: { catalog: "01990000-0000-7000-8000-000000000080" } };
    }) } });
  }
  if (scenario === "forms-translations" || scenario.startsWith("forms-languages-")) {
    const original = fixtureDefinition("es");
    const complete = scenario === "forms-languages-complete" || scenario === "forms-languages-add";
    definitions.set(fixtureFormId, { ...original, draft: { ...original.draft, fields: original.draft.fields.map(q => q.type === "longText" ? { ...q, help: complete ? { es: "Contá lo que pasó.", en: "Describe what happened." } : { es: "Contá lo que pasó." } }
      : !complete && q.type === "decimal" ? { ...q, label: { ...q.label, en: "" } } : !complete && q.type === "choice" && !q.source ? { ...q, options: q.options.map((o, index) => index === 0 ? { ...o, label: { ...o.label, en: "" } } : o) } : q) } });
  }
  if (scenario.startsWith("forms-publication")) { const d = definitions.get(fixtureFormId)!; definitions.set(d.id, { ...d, draft: { ...d.draft, fields: d.draft.fields.map(q => q.type === "longText" ? { ...q, help: { es: "Contá lo que pasó.", en: "Describe what happened." } } : q) } }); }
  if(scenario === "forms-publication-budget-http"){ const budget=responseBudgetDefinition(culture);definitions.clear();definitions.set(budget.id,budget); }
  const ruleFixture = createRuleVisualFixtures(culture, () => definitions.get(fixtureFormId));
  const publications = new Map<string, { definitionId: string; requestId: string; operationId: string; versionId: string; versionNumber: number; draftRevision: number; state: string; acceptedAtUtc: string; recoveryPath: string }>();
  const publicationStates = new Map<string,string>();
  const publicationCultures = new Map<string, FormCulture[]>();
  const reloadFailed = scenario === "forms-publication-failed-reload";
  const reloadReview = scenario === "forms-publication-uncertain-reload";
  const officialPreview = scenario === "forms-publication-preview";
  const languageChange = scenario === "forms-languages-add" || scenario === "forms-languages-remove";
  const nextVersionNumber = (id: string) => Math.max(0, ...[...publications.values()].filter(value => value.definitionId === id).map(value => value.versionNumber)) + 1;
  if (reloadFailed || reloadReview || officialPreview || languageChange) {
   const d=definitions.get(fixtureFormId)!; definitions.set(d.id,{...d,prefixLocked:true,revision:languageChange?2:d.revision});
   const requestId=guid(92);publications.set(requestId,{definitionId:d.id,requestId,operationId:guid(90),versionId:guid(91),versionNumber:scenario==="forms-languages-remove"?2:1,draftRevision:1,state:"Accepted",acceptedAtUtc:audit.createdAtUtc,recoveryPath:"/api/forms/definitions/"+d.id+"/publications/"+requestId});
   publicationCultures.set(requestId, languageChange ? scenario === "forms-languages-add" ? ["es"] : ["es", "en"] : fixturePublicationCultures(d).filter(item => item.isComplete).map(item => item.culture));
   publicationStates.set(requestId,reloadFailed?"Failed":reloadReview?"Uncertain":"Published");
  }
  function overview(id:string) {
   const operation=[...publications.values()].filter(p=>p.definitionId===id).at(-1);
   const state=operation?publicationStates.get(operation.requestId)??operation.state:"Draft";
   const activeVersion=operation&&state==="Published"?{versionId:operation.versionId,versionNumber:operation.versionNumber,draftRevision:operation.draftRevision,cultures:publicationCultures.get(operation.requestId)!}:null;
   return {activeVersion,currentOperation:operation?{versionId:operation.versionId,versionNumber:operation.versionNumber,draftRevision:operation.draftRevision,state,stage:state==="Published"?"Complete":state==="Failed"?"Upload":"Accepted",requiresReview:state==="Uncertain",canRetry:false,requestId:operation.requestId,recoveryPath:operation.recoveryPath}:null,displayState:state};
  }
  let publicationMissing = false; let publicationReads = 0;
  const receipts = new Map<string, { body: string; kind: "Create" | "Update"; result: FormDraftSaveResult }>();
  let conflict = false; let missing = false; let serial = 100;
  const writes: DraftWriteBody[] = [];
  const calls: { method: string; path: string }[] = [];
  const canSave = scenario !== "forms-read" && scenario !== "forms-catalog-read";
  function wireCommit(result: FormDraftSaveResult) { return { ...result, definition: wireDefinition(result.definition) }; }
  async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url); const path = url.pathname;
    calls.push({ method: request.method, path });
    const ruleResponse = await ruleFixture.handle(request);
    if (ruleResponse) return ruleResponse;
    if (scenario === "forms-publication-http-published" || scenario === "forms-publication-http-failed") {
      const failed = scenario.endsWith("failed");
      if (request.method !== "GET") return json({ code: "Forms.Draft.RevisionConflict" }, 409);
      if (path.endsWith("/facets")) return json({ all: 1, published: failed ? 0 : 1, drafts: failed ? 1 : 0 });
      if (path === "/api/forms/definitions") return json(culture === "es" ? publishedEsList : publishedEnList);
      if (path.includes("/publications/")) return json(culture === "es" ? failedEsStatus : failedEnStatus);
      return json(failed ? culture === "es" ? failedEsDetail : failedEnDetail : culture === "es" ? publishedEsDetail : publishedEnDetail);
    }
    if (scenario === "forms-denied") return json({ code: "General.Forbidden" }, 403);

    if (request.method === "POST" && path.endsWith("/publication-checks")) {
      if(scenario === "forms-publication-budget-http"){if(!responseBudgetRaw)throw new Error("Missing raw response budget capture.");return new Response(responseBudgetRaw,{status:200,headers:{"Content-Type":"application/json"}});}
      const definition = definitions.get(path.split("/").at(-2)!);
      if (!definition) return json({ code: "Forms.Definition.NotFound" }, 404);
      const input = await request.json() as DraftWriteBody;
      if (input.expectedRevision !== definition.revision) return json({ code: "Forms.Draft.RevisionConflict" }, 409);
      const available = scenario.startsWith("forms-publication") || scenario.startsWith("forms-languages-");
      const cultures = fixturePublicationCultures(definition);
      const complete = cultures.filter(item => item.isComplete).map(item => item.culture);
      const activeVersion = overview(definition.id).activeVersion;
      const previousCultures = activeVersion?.cultures ?? [];
      return json({ definitionId: definition.id, draftRevision: definition.revision, nextVersionNumber: nextVersionNumber(definition.id), compatibility: "LocallyValidated",
        canAccept: available, acceptanceAvailability: available ? "Available" : "Unavailable", cultures, channels: [{ channelId: "phone", profileRevision: "fixture-v1", compatibility: "LocallyValidated", externalEvidence: "Pending", cultures: complete }], issues: [],
        checkToken: available ? "fixture-publication-ticket" : null, checkExpiresAtUtc: available ? "2099-10-10T16:00:00Z" : null,
        diff: { baseVersionId: activeVersion?.versionId ?? null, added: activeVersion ? [] : definition.draft.fields.map(q => q.fieldId), changed: [], removed: [], addedCultures: complete.filter(value => !previousCultures.includes(value)), removedCultures: previousCultures.filter(value => !complete.includes(value)) } });
    }
    if (request.method === "POST" && path.endsWith("/publications")) {
      const definition = definitions.get(path.split("/").at(-2)!);
      if (!definition) return json({ code: "Forms.Definition.NotFound" }, 404);
      const input = await request.json() as DraftWriteBody;
      const prior = publications.get(input.requestId);
      if (prior) return json(prior, 202);
      const result = { definitionId: definition.id, requestId: input.requestId, operationId: guid(90), versionId: guid(91),
        versionNumber: nextVersionNumber(definition.id), draftRevision: definition.revision, state: "Accepted", acceptedAtUtc: audit.createdAtUtc,
        recoveryPath: "/api/forms/definitions/" + definition.id + "/publications/" + input.requestId };
      publications.set(input.requestId, result);
      publicationCultures.set(input.requestId, fixturePublicationCultures(definition).filter(item => item.isComplete).map(item => item.culture));
      definitions.set(definition.id, { ...definition, prefixLocked: true });
      if (scenario === "forms-publication-uncertain") return json({ code: "General.Unexpected", traceId: "publication-fixture" }, 500);
      return json(result, 202);
    }
    if (request.method === "GET" && path.includes("/publications/")) {
      const publication = publications.get(path.split("/").at(-1)!);
      if (scenario === "forms-publication-uncertain" && !publicationMissing) { publicationMissing = true; return json({ code: "Forms.Publication.NotFound" }, 404); }
      if (!publication) return json({ code: "Forms.Publication.NotFound" }, 404);
      const { recoveryPath: _path, ...identity } = publication;
      publicationReads++;
      const state=scenario === "forms-publication-progress" ? publicationReads > 1 ? "Published" : "Publishing" : publicationStates.get(publication.requestId) ?? "Accepted";
      publicationStates.set(publication.requestId,state);
      return json({ ...identity, state, cultures: publicationCultures.get(publication.requestId)!,
        stage: state === "Uncertain" ? "Validate" : scenario === "forms-publication-progress" ? publicationReads > 1 ? "Complete" : "Validate" : "Accepted",
        updatedAtUtc: audit.createdAtUtc, nextCheckAtUtc: null, canRetry: false, requiresReview: state === "Uncertain", issues: reloadFailed ? Array.from({length:6},()=>({channelId:"WhatsApp",fieldId:null,choiceId:null,path:"channel",code:"WhatsApp.Flow.ValidationFailed",message:culture==="es"?"WhatsApp rechazó la validación del formulario.":"WhatsApp rejected the form validation.",limit:null,culture:"en"})) : [] });
    }
    if (request.method === "GET" && path.endsWith("/preview")) {
     const selected=url.searchParams.get("culture");
     if(!officialPreview || selected!=="es"&&selected!=="en")return json({code:"WhatsApp.Flow.PreviewUnavailable"},409);
     return json({url:"https://www.facebook.com/whatsapp/flows/preview/fixture?culture="+selected,expiresAtUtc:new Date(Date.now()+6000).toISOString()});
    }
    if (request.method === "GET" && path.startsWith("/api/forms/draft-changes/")) {
      if (scenario === "forms-expired") return json({ code: "Forms.Draft.ChangeExpired" }, 410);
      if (scenario === "forms-uncertain" && !missing) { missing = true; return json({ code: "Forms.Draft.ChangeNotFound" }, 404); }
      const receipt = receipts.get(path.split("/").at(-1)!);
      return receipt ? json({ requestId: receipt.result.requestId, kind: receipt.kind, status: "Committed", committedAtUtc: audit.createdAtUtc,
        currentRevision: definitions.get(receipt.result.definition.id)!.revision, result: wireCommit(receipt.result) }) : json({ code: "Forms.Draft.ChangeNotFound" }, 404);
    }
    if (request.method === "GET" && path === "/api/forms/definitions/facets") {
      const matches = [...definitions.values()].filter(d => administrativeName(d.name, culture).toLowerCase().includes((url.searchParams.get("search") ?? "").toLowerCase()));
      const published=matches.filter(d=>overview(d.id).activeVersion).length;
      return json({ all: matches.length, published, drafts: matches.length-published });
    }
    if (request.method === "GET" && path === "/api/forms/definitions") {
      if (scenario === "forms-loading") return new Promise(() => {});
      if (scenario === "forms-error") return json({ code: "General.Unexpected", traceId: "forms-fixture" }, 500);
      const values = [...definitions.values()].filter(d => (url.searchParams.get("publicationFilter") === "Published" ? !!overview(d.id).activeVersion : url.searchParams.get("publicationFilter") === "Drafts" ? !overview(d.id).activeVersion : true) && administrativeName(d.name, culture).toLowerCase().includes((url.searchParams.get("search") ?? "").toLowerCase()));
      const sort = url.searchParams.get("sort") ?? "name";
      values.sort((a, b) => (sort.includes("questionCount") ? a.draft.fields.length - b.draft.fields.length : administrativeName(a.name, culture).localeCompare(administrativeName(b.name, culture))) * (sort.startsWith("-") ? -1 : 1));
      const page = Number(url.searchParams.get("page") ?? 1); const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      return json({ items: values.slice((page - 1) * pageSize, page * pageSize).map(d => ({ id: d.id, name: d.name, prefix: d.prefix, questionCount: d.draft.fields.length,
        activeVersionNumber: overview(d.id).activeVersion?.versionNumber ?? null, displayState: overview(d.id).displayState, lastChangedAtUtc: audit.lastChangedAtUtc, lastChangedBy: audit.lastChangedBy, canEdit: canSave })),
        page, pageSize, totalCount: values.length, totalPages: Math.ceil(values.length / pageSize), hasPrevious: page > 1, hasNext: page * pageSize < values.length });
    }
    if (request.method === "GET") {
      const definition = definitions.get(path.split("/").at(-1)!);
      return definition ? json({ definition: wireDefinition(definition), capabilities: { canSave, canPublish: true, canPreview: !!overview(definition.id).activeVersion }, publication: overview(definition.id), audit }) : json({ code: "Forms.Definition.NotFound" }, 404);
    }
    if (!canSave) return json({ code: "General.Forbidden" }, 403);
    const body = await request.json() as DraftWriteBody;
    writes.push(body);
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
      if (q.type === "choice" && q.source) {
        if (!q.source.catalog) throw new Error("The synthetic canonical response requires a selected catalog.");
        return { ...common, type: q.type, source: { catalog: q.source.catalog } };
      }
      if (q.type === "choice" && !q.source) return { ...common, type: q.type, options: q.options.map(o => {
        const choiceId = o.choiceId ?? guid(serial++); choices.push({ fieldLocalId: q.localId, localId: o.localId, fieldId, choiceId }); return { choiceId, label: o.label };
      }) };
      if (q.type === "photo" || q.type === "document") {
        if (!validFileCounts(q.files)) throw new Error("Invalid file counts.");
        return { ...common, type: q.type, files: { ...q.files } };
      }
      return q.type === "shortText" || q.type === "longText" ? { ...common, type: q.type, maxLength: q.maxLength ?? (q.type === "shortText" ? 80 : 600) } : { ...common, type: q.type };
    });
    const definition: FormDefinitionSnapshot = { offerWhen: body.offerWhen?.trim() || null, id: previous?.id ?? guid(serial++), name: Object.fromEntries(Object.entries(body.name).map(([language, text]) => [language, text.trim()])), prefix: body.prefix, prefixLocked: previous?.prefixLocked ?? false,
      revision: (previous?.revision ?? 0) + 1, draft: { ...body.draft, fields: canonical } };
    definitions.set(definition.id, definition);
    const result: FormDraftSaveResult = { requestId: body.requestId, definition, identityMap: { fields, choices }, recovery: { path: "/api/forms/draft-changes/" + body.requestId, resultExpiresAtUtc: "2026-11-09T12:00:00Z" } };
    receipts.set(body.requestId, { body: JSON.stringify(body), kind: previous ? "Update" : "Create", result });
    if (scenario === "forms-uncertain" || scenario === "forms-expired") return json({ code: "General.Unexpected", traceId: "forms-fixture" }, 500);
    return json(wireCommit(result), previous ? 200 : 201);
  }
  return { handle, definitions, calls, writes, ruleWrites: ruleFixture.writes };
}
