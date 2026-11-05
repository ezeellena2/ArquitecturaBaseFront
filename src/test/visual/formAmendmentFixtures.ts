import type { FormEntryCorrection } from "@/features/business-forms/api/entries";
import type { ResponseDetail, ResponseSheet } from "@/features/business-forms/api/responses";
import type { ResponseWorkflow } from "@/features/business-forms/api/workflow";
import type { ResponseQuery } from "@/features/business-forms/responses";
import { responseFormId, responseRecordId, responseSecondId } from "../responseFixtures";

const id = (n: number) => "0199a0c0-0000-7000-8000-" + String(n).padStart(12, "0");
export const formAmendmentFixtureIds = { form: responseFormId, pending: responseRecordId, approved: responseSecondId, pendingCorrection: id(311), approvedCorrection: id(312) };

type Row = ResponseSheet["records"]["items"][number];
type Task = NonNullable<ResponseWorkflow["task"]>;
interface FullFixtures { permissions: string[]; calls: { method: string; path: string }[]; handle(request: Request): Promise<Response | null> }
interface Version { id: string; base: string; amount: string; state: Row["state"]; replacedBy?: string; correctionOf?: string }

/**
 * Correcting and voiding (CW10-A and CW11-A) over the real sheet, D2 and DC1, on top of the full view's transport:
 * «Corregir» and «⋯ › Anular» on a pending and an approved response (responses-full-amend), the sheet after correcting both
 * (responses-full-amend-corrected) and whoever only loads with their own (responses-full-amend-own). Synthetic doubles; the
 * bodies exported by the backend qualify the HTTP contract in the entries contract tests.
 */
export function createFormAmendmentFixtures(language: "es" | "en", scenario: string, full: FullFixtures): FullFixtures {
  const en = language === "en";
  const own = scenario === "responses-full-amend-own";
  const corrected = scenario === "responses-full-amend-corrected";
  const ids = formAmendmentFixtureIds;
  const correctedAtUtc = "2026-10-16T14:20:00Z", approvedAtUtc = "2026-10-16T13:10:00Z", pdfAtUtc = "2026-10-16T13:11:00Z";
  const ana = { userId: id(377), displayName: "Ana Pérez" }, laura = { userId: id(376), displayName: "Laura Ríos" };
  const reasons = { pending: en ? "The amount was 1350.5, not 1250.5." : "El importe era 1350,5, no 1250,5.", approved: en ? "Wrong amount." : "Importe equivocado." };
  // Each version of a response: the current ones show in the sheet; a replaced one is only read from its correction.
  const versions: Version[] = corrected
    ? [{ id: ids.pending, base: ids.pending, amount: "1250.5", state: "PendingApproval", replacedBy: ids.pendingCorrection },
      { id: ids.approved, base: ids.approved, amount: "980", state: "Approved", replacedBy: ids.approvedCorrection },
      { id: ids.pendingCorrection, base: ids.pending, amount: "1350.5", state: "PendingApproval", correctionOf: ids.pending },
      { id: ids.approvedCorrection, base: ids.approved, amount: "890", state: "PendingApproval", correctionOf: ids.approved }]
    : [{ id: ids.pending, base: ids.pending, amount: "1250.5", state: "PendingApproval" }, { id: ids.approved, base: ids.approved, amount: "980", state: "Approved" }];
  const voided = new Map<string, { atUtc: string; reason: string }>();
  const version = (recordId: string) => versions.find(item => item.id === recordId);
  const json = (body: unknown, status = 200) => Response.json(body, { status });
  const notes = en ? "Full delivery at the central warehouse." : "Entrega completa en el depósito central.";
  const task = (recordId: string, state: Task["state"]): Task => ({ id: id(version(recordId)!.base === ids.approved ? 372 : 371), roleId: id(375),
    roleName: en ? "Supervision" : "Supervisión", requestedAtUtc: version(recordId)!.correctionOf ? correctedAtUtc : "2026-10-16T12:00:00Z",
    state, revision: state === "Open" ? 1 : 2, decidedAtUtc: state === "Approved" ? approvedAtUtc : null, decidedBy: state === "Approved" ? laura : null, reason: null });
  const document = { id: id(380), runId: id(390), culture: language, name: en ? "Receipt-TEST-000001.pdf" : "Comprobante-TEST-000001.pdf", size: 4096, createdAtUtc: pdfAtUtc };
  function workflow(recordId: string): ResponseWorkflow {
    const current = version(recordId)!;
    const closed = !!current.replacedBy && current.state === "PendingApproval" || voided.has(recordId);
    const approval = { id: id(389), ruleId: id(395), kind: "RequestApproval" as const, event: "Received" as const, order: 0, revision: 1, state: "Completed" as const,
      reasonCode: null, reason: null, canConsult: false, canRetry: false, recipients: [], createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:01Z", completedAtUtc: "2026-10-16T12:00:01Z" };
    const approved = current.state === "Approved";
    return { recordId, recordState: voided.has(recordId) ? "Voided" : current.state, ruleRevision: 3,
      task: task(recordId, closed ? "Closed" : approved ? "Approved" : "Open"),
      actions: approved ? [approval, { id: document.runId, ruleId: id(396), kind: "GeneratePdf", event: "Approved", order: 0, revision: 1, state: "Completed", reasonCode: null, reason: null,
        canConsult: false, canRetry: false, recipients: [], createdAtUtc: approvedAtUtc, updatedAtUtc: pdfAtUtc, completedAtUtc: pdfAtUtc }] : [approval],
      documents: approved ? [document] : [] };
  }
  // The answers that tell the versions apart: the amount, the notes and whether it was confirmed.
  function withAnswers<T extends { fieldId: string; value: unknown }>(cells: T[], current: Version): T[] {
    return cells.map(cell => {
      const value = cell.fieldId === id(30) ? current.amount : cell.fieldId === id(31) ? notes : cell.fieldId === id(32) ? current.base === ids.pending : undefined;
      return value === undefined ? cell : { ...cell, value };
    });
  }
  async function baseSheet(request: Request): Promise<ResponseSheet> {
    const response = await full.handle(new Request(new URL("/api/forms/definitions/" + ids.form + "/records/search", request.url), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: 1, pageSize: 20 }) }));
    return await response!.json() as ResponseSheet;
  }
  // The rows the sheet reads: the current versions, without the voided unless «Estado: Anulada» asks for them.
  async function rows(request: Request, query: ResponseQuery): Promise<{ sheet: ResponseSheet; items: Row[] }> {
    const sheet = await baseSheet(request);
    const items = versions.filter(item => !item.replacedBy).flatMap(item => {
      const row = sheet.records.items.find(row => row.id === item.base)!;
      const state = voided.has(item.id) ? "Voided" as const : item.state;
      return query.state ? state === query.state ? [{ ...row, id: item.id, state, hasPdf: false, cells: withAnswers(row.cells, item), ...item.correctionOf ? { corrected: true as const } : {} }] : []
        : state === "Voided" ? [] : [{ ...row, id: item.id, state, hasPdf: state === "Approved", cells: withAnswers(row.cells, item), ...item.correctionOf ? { corrected: true as const } : {} }];
    }).sort((left, right) => right.number.localeCompare(left.number));
    return { sheet, items };
  }
  function correction(recordId: string): FormEntryCorrection {
    const current = version(recordId)!;
    const files = (minFiles: number, maxFiles: number, photoSource: "cameraOrGallery" | null) => ({ minFiles, maxFiles, photoSource });
    return {
      entry: { definitionId: ids.form, versionId: id(13), versionNumber: 2, prefix: "TEST", name: en ? "Delivery report" : "Informe de entregas", culture: language,
        submitLabel: en ? "Send" : "Enviar", maxFileSizeMiB: 25, questions: [
          { fieldId: id(30), type: "decimal", label: en ? "Amount" : "Importe", help: null, required: true, maxLength: null, options: null, selection: null, files: null, catalog: null },
          { fieldId: id(31), type: "longText", label: en ? "Notes" : "Observaciones", help: null, required: false, maxLength: 500, options: null, selection: null, files: null, catalog: null },
          { fieldId: id(32), type: "boolean", label: en ? "Confirmed" : "Confirmado", help: null, required: false, maxLength: null, options: null, selection: null, files: null, catalog: null },
          { fieldId: id(33), type: "shortText", label: en ? "Optional detail" : "Detalle opcional", help: null, required: false, maxLength: 120, options: null, selection: null, files: null, catalog: null },
          { fieldId: id(35), type: "photo", label: en ? "Delivery photos" : "Fotos de la entrega", help: null, required: false, maxLength: null, options: null, selection: null,
            files: files(0, 3, "cameraOrGallery"), catalog: null },
          { fieldId: id(36), type: "document", label: en ? "Receipt" : "Comprobante", help: null, required: false, maxLength: null, options: null, selection: null,
            files: files(0, 1, null), catalog: null },
        ] },
      recordId, number: current.base === ids.pending ? "TEST-000002" : "TEST-000001",
      answers: [{ fieldId: id(30), value: current.amount, choiceIds: null, options: null }, { fieldId: id(31), value: notes, choiceIds: null, options: null },
        { fieldId: id(32), value: String(current.base === ids.pending), choiceIds: null, options: null }],
      files: [{ fileId: id(70), fieldId: id(35), name: "entrega.jpg", contentType: "image/jpeg", size: 88229, hasThumbnail: true },
        { fileId: id(71), fieldId: id(35), name: "detalle.jpg", contentType: "image/jpeg", size: 45231, hasThumbnail: true },
        { fileId: id(72), fieldId: id(36), name: "comprobante.pdf", contentType: "application/pdf", size: 41412, hasThumbnail: false }],
    };
  }
  // Decision 8: whoever loaded it, while it is not decided; with «Corregir y anular respuestas», always.
  const canAmend = (current: Version) => !current.replacedBy && !voided.has(current.id) && (!own || current.state !== "Approved");
  return {
    ...full,
    permissions: own ? ["formrecords.create"] : ["formrecords.read", "formrecords.amend", "formrecords.export", "whatsapp.read"],
    async handle(request: Request): Promise<Response | null> {
      const url = new URL(request.url), path = url.pathname;
      const voiding = /^\/api\/forms\/definitions\/[^/]+\/records\/([^/]+)\/void$/.exec(path);
      if (voiding && request.method === "POST") {
        full.calls.push({ method: request.method, path });
        const current = version(voiding[1]);
        if (!current || !canAmend(current)) return json({ code: "Forms.Record.AmendUnavailable" }, 409);
        voided.set(current.id, { atUtc: "2026-10-16T14:25:00Z", reason: (await request.json() as { reason: string }).reason });
        return new Response(null, { status: 204 });
      }
      const opening = /^\/api\/forms\/entries\/[^/]+\/records\/([^/]+)$/.exec(path);
      if (opening && request.method === "GET") {
        full.calls.push({ method: request.method, path });
        const current = version(opening[1]);
        return current && canAmend(current) ? json(correction(current.id)) : json({ code: "Forms.Record.AmendUnavailable" }, 409);
      }
      if (request.method === "POST" && /\/records\/(?:search|[^/]+\/navigation)$/.test(path)) {
        full.calls.push({ method: request.method, path });
        const query = await request.json() as ResponseQuery;
        const { sheet, items } = await rows(request, query);
        if (path.endsWith("/navigation")) {
          const recordId = path.split("/").at(-2)!;
          const index = items.findIndex(row => row.id === recordId);
          return index < 0 ? json({ code: "Forms.Record.NotFound" }, 404) : json({ recordId, previousId: items[index - 1]?.id ?? null, nextId: items[index + 1]?.id ?? null,
            position: index + 1, totalCount: items.length });
        }
        return json({ ...sheet, hasApproval: true, records: { ...sheet.records, items, totalCount: items.length, totalPages: 1, hasPrevious: false, hasNext: false } } satisfies ResponseSheet);
      }
      const workflowMatch = /^\/api\/forms\/records\/([^/]+)\/workflow$/.exec(path);
      if (workflowMatch && version(workflowMatch[1])) { full.calls.push({ method: request.method, path }); return json(workflow(workflowMatch[1])); }
      const detailMatch = /^\/api\/forms\/records\/([^/]+)$/.exec(path);
      const current = detailMatch ? version(detailMatch[1]) : undefined;
      if (current) {
        const response = await full.handle(new Request(new URL("/api/forms/records/" + current.base, request.url)));
        const base = await response!.json() as ResponseDetail;
        const replaced = current.correctionOf ? version(current.correctionOf)! : undefined;
        const voidedAs = voided.get(current.id);
        const detail: ResponseDetail = { ...base, id: current.id, values: withAnswers(base.values, current),
          ...replaced ? { correction: { previousRecordId: replaced.id, atUtc: correctedAtUtc, by: ana, reason: replaced.id === ids.pending ? reasons.pending : reasons.approved,
            previousState: replaced.state, previousDecidedAtUtc: replaced.state === "Approved" ? approvedAtUtc : null, previousDecidedBy: replaced.state === "Approved" ? laura : null,
            previousPdfAtUtc: replaced.state === "Approved" ? pdfAtUtc : null } } : {},
          ...current.replacedBy ? { replacedBy: { recordId: current.replacedBy, atUtc: correctedAtUtc } } : {},
          ...voidedAs ? { void: { atUtc: voidedAs.atUtc, by: ana, reason: voidedAs.reason } } : {},
          ...canAmend(current) ? { canAmend: true as const } : {} };
        return json(detail);
      }
      return full.handle(request);
    },
  };
}
