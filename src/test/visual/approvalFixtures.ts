import { approvalTaskFixture } from "../approvalFixtures";
import { responseSecondId, responseWorkflowFixture } from "../responseFixtures";
import type { ApprovalTask } from "@/features/business-forms/api/approvals";

export function createApprovalVisualFixtures(language: "es" | "en") {
  const en = language === "en";
  const base = approvalTaskFixture();
  base.formName = en ? "Delivery visit" : "Visita de entrega";
  base.role.name = en ? "Supervision" : "Supervisión";
  const tasks: ApprovalTask[] = [base,
    { ...base, id: "0199a0c0-0000-7000-8000-000000000071", recordId: responseSecondId, number: "VIS-00002", author: { ...base.author, displayName: "Luz" }, requestedAtUtc: "2026-10-16T13:00:00Z" },
    { ...base, id: "0199a0c0-0000-7000-8000-000000000072", number: "VIS-00003", canDecide: false, cannotDecideReason: "OwnResponse" },
  ];
  const writes: unknown[] = [];
  const reads: string[] = [];
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const rows = (url: URL) => tasks.filter(task => task.state === "Open" &&
    (!url.searchParams.get("definitionId") || task.definitionId === url.searchParams.get("definitionId")) &&
    (url.searchParams.get("onlyMine") === "false" || task.canDecide));
  return { reads, writes, async handle(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const path = url.pathname;
    reads.push(request.url);
    if (/^\/api\/forms\/records\/[^/]+\/workflow$/.test(path)) {
      const recordId = path.split("/").at(-2)!;
      const task = tasks.find(task => task.recordId === recordId);
      return json({ ...responseWorkflowFixture(recordId), recordState: task ? task.state === "Open" ? "PendingApproval" : task.state : "Received", ruleRevision: 1,
        task: task ? { id: task.id, roleId: task.role.id, roleName: task.role.name, requestedAtUtc: task.requestedAtUtc, revision: task.revision, state: task.state, decidedAtUtc: task.decidedAtUtc, decidedBy: task.decidedBy, reason: task.reason } : null });
    }
    if (!path.startsWith("/api/forms/approvals")) return null;
    if (path.endsWith("/count")) return json({ count: rows(url).length });
    if (path === "/api/forms/approvals") {
      const matching = rows(url);
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      const totalPages = Math.ceil(matching.length / pageSize);
      return json({ items: matching.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: matching.length, totalPages, hasPrevious: page > 1, hasNext: page < totalPages });
    }
    const taskId = /^\/api\/forms\/approvals\/([^/]+)(?:\/decisions)?$/.exec(path)?.[1];
    const task = tasks.find(task => task.id === taskId);
    if (!task) return json({ code: "Forms.Task.NotFound" }, 404);
    if (request.method === "POST") {
      const body = await request.json() as { decision: "Approved" | "Rejected"; reason?: string };
      writes.push(body);
      task.state = body.decision; task.revision++; task.canDecide = false; task.cannotDecideReason = "AlreadyDecided";
      task.decidedAtUtc = "2026-10-16T14:00:00Z";
      task.decidedBy = { userId: base.author.userId, displayName: en ? "Alex Smith" : "Alex Pérez" };
      task.reason = body.reason ?? null;
      return json({ taskId: task.id, recordId: task.recordId, revision: task.revision, state: task.state, decidedAtUtc: task.decidedAtUtc, decidedBy: task.decidedBy, reason: task.reason });
    }
    return json(task);
  } };
}
