import type { FormOverview } from "@/features/business-forms/api/overview";
import type { ApprovalPage, ApprovalTask } from "@/features/business-forms/api/approvals";
import type { ResponseSheet } from "@/features/business-forms/api/responses";
import type { ResponseWorkflow } from "@/features/business-forms/api/workflow";
import { approvalTaskFixture } from "../approvalFixtures";
import { responseFormId, responseRecordId, responseSecondId, responseWorkflowFixture } from "../responseFixtures";
import { createResponseVisualFixtures } from "./responseFixtures";
import { samplePdf } from "./pdfFixtures";

const id = (n: number) => "0199a0c0-0000-7000-8000-" + String(n).padStart(12, "0");
export const responseFullFixtureIds = { form: responseFormId, first: responseRecordId, second: responseSecondId, document: id(380), pdfRun: id(390) };

// Synthetic transport for the real MF1, sheet, D2 and DC1 routes. It does not qualify backend persistence or providers.
export function createFormResponseFullFixtures(language: "es" | "en", scenario: string) {
  const en = language === "en";
  const decideOnly = scenario === "responses-full-decide";
  const readDecide = scenario === "responses-full-read-decide";
  const canDecide = decideOnly || readDecide;
  const name = en ? "Delivery report" : "Informe de entregas";
  const base = createResponseVisualFixtures(language, "responses-full");
  const pdf = samplePdf();
  const document: ResponseWorkflow["documents"][number] = { id: responseFullFixtureIds.document, runId: responseFullFixtureIds.pdfRun,
    culture: language, name: en ? "Receipt-TEST-000002.pdf" : "Comprobante-TEST-000002.pdf", size: pdf.length, createdAtUtc: "2026-10-16T14:01:00Z" };
  const tasks: ApprovalTask[] = [responseRecordId, responseSecondId].map((recordId, index) => ({ ...approvalTaskFixture(),
    id: id(370 + index), recordId, number: "TEST-00000" + (2 - index), formName: name,
    requestedAtUtc: "2026-10-16T1" + (2 + index) + ":00:00Z", role: { id: id(375), name: en ? "Supervision" : "Supervisión" } }));
  const calls: { method: string; path: string }[] = [];
  const json = (body: unknown, status = 200) => Response.json(body, { status });
  const approved = (): ResponseWorkflow => ({
    ...responseWorkflowFixture(responseRecordId), recordState: "Approved", ruleRevision: 3,
    task: { id: tasks[0].id, roleId: tasks[0].role.id, roleName: tasks[0].role.name, requestedAtUtc: tasks[0].requestedAtUtc,
      state: "Approved", revision: 2, decidedAtUtc: "2026-10-16T14:00:00Z", decidedBy: { userId: id(376), displayName: en ? "Alex Smith" : "Alex Pérez" }, reason: null },
    actions: [
      { id: id(389), ruleId: id(395), kind: "RequestApproval", event: "Received", order: 0, revision: 1, state: "Completed", reasonCode: null, reason: null,
        canConsult: false, canRetry: false, recipients: [], createdAtUtc: "2026-10-16T12:00:00Z", updatedAtUtc: "2026-10-16T12:00:01Z", completedAtUtc: "2026-10-16T12:00:01Z" },
      { id: document.runId, ruleId: id(396), kind: "GeneratePdf", event: "Approved", order: 0, revision: 1, state: "Completed", reasonCode: null, reason: null,
        canConsult: false, canRetry: false, recipients: [], createdAtUtc: "2026-10-16T14:00:00Z", updatedAtUtc: document.createdAtUtc, completedAtUtc: document.createdAtUtc },
    ], documents: [document],
  });
  return { permissions: decideOnly ? ["formapprovals.decide"] : readDecide ? ["formrecords.read", "formapprovals.decide"] : ["formrecords.read", "whatsapp.read"], calls, document,
    async handle(request: Request): Promise<Response | null> {
      const url = new URL(request.url), path = url.pathname;
      if (!path.startsWith("/api/forms/")) return null;
      calls.push({ method: request.method, path });
      const readingPost = request.method === "POST" && /^\/api\/forms\/definitions\/[^/]+\/records\/(?:search|[^/]+\/navigation)$/.test(path);
      if (request.method !== "GET" && !readingPost) return json({ code: "Test.ReadOnlyScenario" }, 405);
      if (path === "/api/forms/overview") {
        const result: FormOverview = { forms: { items: [{ id: responseFormId, name, prefix: "TEST", deactivatedAtUtc: null,
          pendingApprovalCount: canDecide ? 2 : null, responseCount: decideOnly ? null : 2,
          lastResponse: decideOnly ? null : { id: responseRecordId, number: "TEST-000002", submittedAtUtc: "2026-10-16T12:00:00Z", state: readDecide ? "PendingApproval" : "Approved" } }],
          page: 1, pageSize: 20, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false },
          filterCounts: { active: 1, deactivated: 0, deactivatedPending: canDecide ? 0 : null } };
        return json(result);
      }
      if (path === "/api/forms/approvals/count") return json({ count: tasks.length });
      if (path === "/api/forms/approvals") {
        const page = Number(url.searchParams.get("page") ?? 1), pageSize = Number(url.searchParams.get("pageSize") ?? 20);
        const selected = url.searchParams.get("definitionId") === responseFormId ? tasks : [];
        const result: ApprovalPage = { items: selected.slice((page - 1) * pageSize, page * pageSize), page, pageSize,
          totalCount: selected.length, totalPages: Math.ceil(selected.length / pageSize), hasPrevious: page > 1, hasNext: page * pageSize < selected.length };
        return json(result);
      }
      if (path.startsWith("/api/forms/approvals/")) {
        const task = tasks.find(task => path.endsWith("/" + task.id));
        return task ? json(task) : json({ code: "Forms.Task.NotFound" }, 404);
      }
      if (decideOnly && /^\/api\/forms\/(?:records\/|definitions\/[^/]+\/records)/.test(path)) return json({ code: "Authorization.Forbidden" }, 403);
      if (/\/documents\/[^/]+\/content$/.test(path)) return new Response(pdf, { headers: { "content-type": "application/pdf",
        "content-language": language, "content-disposition": 'inline; filename="' + document.name + '"' } });
      if (/\/files\/[^/]+\/content$/.test(path) && path.includes(id(72))) return new Response(pdf, { headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=comprobante.pdf" } });
      if (path.endsWith("/records/search")) {
        const response = await base.handle(request);
        const sheet = await response.json() as ResponseSheet;
        sheet.hasApproval = true;
        for (const row of sheet.records.items) { row.state = readDecide ? "PendingApproval" : row.id === responseRecordId ? "Approved" : "Received"; row.hasPdf = !readDecide && row.id === responseRecordId; }
        return json(sheet);
      }
      if (path.includes("/files/")) return null; // The common visual image transport supplies the existing sample JPEG.
      if (/\/records\/[^/]+\/workflow$/.test(path)) {
        if (readDecide) {
          const task = tasks.find(task => path.includes(task.recordId));
          if (!task) return json({ code: "Forms.Record.NotFound" }, 404);
          return json({ ...responseWorkflowFixture(task.recordId), recordState: "PendingApproval", ruleRevision: 3,
            task: { id: task.id, roleId: task.role.id, roleName: task.role.name, requestedAtUtc: task.requestedAtUtc,
              state: task.state, revision: task.revision, decidedAtUtc: null, decidedBy: null, reason: null } } satisfies ResponseWorkflow);
        }
        return json(path.includes(responseRecordId) ? approved() : responseWorkflowFixture(responseSecondId));
      }
      return base.handle(request);
    },
  };
}
